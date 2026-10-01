import { NextResponse } from "next/server";
import { syncEasyAimAccount } from "@/lib/easyaimSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Called by the Vercel cron (see vercel.json) with the CRON_SECRET as a
 * bearer token. Can also be triggered manually for testing.
 *
 * This used to read up to 200 links with no ordering and await one
 * `syncEasyAimAccount` after another. Two things were wrong with that:
 *
 *   - It could not finish. One account is up to twelve pages of EasyAim
 *     plus several database round trips, so two hundred of them in sequence
 *     is minutes of work in a function with a hard wall-clock limit. It
 *     died partway through and the accounts it never reached were simply
 *     never synced, with nothing recording that they had been skipped.
 *
 *   - Past two hundred links it starved. `.limit(200)` with no `order by`
 *     returns whichever rows the planner likes first, and that set does not
 *     change as the community grows, so everyone who joined later was
 *     invisible to the sync forever.
 *
 * So: a bounded batch, ordered by who has gone longest without a sync, with
 * a small amount of concurrency inside it. Every run advances whoever is
 * furthest behind, which converges for everyone instead of serving the same
 * two hundred rows daily.
 */

/** How many accounts one run attempts. */
const BATCH_SIZE = 100;

/**
 * Accounts synced at once. Each one holds several EasyAim connections open,
 * so this is a balance between finishing inside the function's time budget
 * and not hammering a third-party API.
 */
const CONCURRENCY = 5;

/**
 * Room for the batch to finish. The work is bounded by BATCH_SIZE and
 * CONCURRENCY rather than by the size of the community, so this is a real
 * ceiling rather than a hope. Anything that does not fit is picked up by the
 * next run — the ordering guarantees it — so running out of time costs
 * latency, never correctness.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Least-recently-synced first, never-synced included. nullsFirst matters:
  // without it a null last_synced_at sorts last on a descending sort and a
  // brand new account waits behind everyone who has run at least once.
  const { data: links, error } = await supabaseAdmin
    .from("easyaim_links")
    .select("account_id")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("EASYAIM SYNC-ALL ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load linked accounts" },
      { status: 500 }
    );
  }

  const accountIds = (links ?? []).map(
    (row) => (row as { account_id: string }).account_id
  );

  const failed: string[] = [];
  let synced = 0;

  // Fixed-size pool over the batch. Simple, and it bounds the number of
  // in-flight syncs no matter how long the batch is.
  let cursor = 0;

  async function worker() {
    while (cursor < accountIds.length) {
      const accountId = accountIds[cursor++];

      try {
        await syncEasyAimAccount(accountId);
        synced += 1;
      } catch (syncError) {
        console.error("EASYAIM SYNC-ALL ACCOUNT ERROR:", accountId, syncError);
        failed.push(accountId);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, accountIds.length) }, worker)
  );

  // Stamp the failures anyway. syncEasyAimAccount records progress before it
  // does the risky work, so most failures have already bumped the timestamp —
  // but a link that could not even be read has not, and without this it
  // would sit at the front of the ordering and be retried every single run
  // while everyone behind it waited. One broken account should not hold up
  // the rest of the community.
  if (failed.length > 0) {
    const { error: stampError } = await supabaseAdmin
      .from("easyaim_links")
      .update({ last_synced_at: new Date().toISOString() })
      .in("account_id", failed);

    if (stampError) {
      console.error("EASYAIM SYNC-ALL: could not stamp failures:", stampError);
    }
  }

  return NextResponse.json({
    attempted: accountIds.length,
    synced,
    failed,
    // False means there are more accounts waiting than this run had room for.
    // The next run picks them up first, so this is a progress signal rather
    // than a backlog that needs clearing by hand.
    caughtUp: accountIds.length < BATCH_SIZE,
    batchSize: BATCH_SIZE,
  });
}
