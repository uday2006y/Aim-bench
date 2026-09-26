import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Lets every linked EasyAim player re-scan their run history once, so
 * personal bests on scenarios that were just attached to (or removed
 * from) a benchmark show up on the leaderboard.
 *
 * Shared by the create and edit benchmark routes so both behave the same.
 * Failures are logged rather than thrown: a benchmark edit should still
 * succeed even if the re-scan nudge doesn't land — the next scheduled sync
 * will pick the change up anyway.
 */
export async function resetLinkedAccountsBackfill() {
  const { data: links, error: linksError } = await supabaseAdmin
    .from("easyaim_links")
    .select("account_id");

  if (linksError) {
    console.error("RESET BACKFILL: failed to load links:", linksError);
    return;
  }

  const accountIds = (links || []).map(
    (row) => (row as { account_id: string }).account_id
  );

  if (accountIds.length === 0) return;

  const { error } = await supabaseAdmin
    .from("easyaim_links")
    .update({
      last_run_id: null,
      backfill_cursor: null,
      backfill_done: false,
    })
    .in("account_id", accountIds);

  if (error) {
    console.error("RESET BACKFILL: failed to update links:", error);
  }
}
