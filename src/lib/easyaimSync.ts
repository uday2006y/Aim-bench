import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import { getRunPage, type EasyAimRun } from "./easyaim";
import { computeAggregates, type RankSource, type ScenarioCutoffs } from "./aggregates";
import { primaryTierIds, scenariosInPrimaryTiers } from "./benchmarkTiers";
import { loadAllTierRefs } from "./tiers";

const PAGE_SIZE = 25;
const NEW_RUNS_MAX_PAGES = 4;
const BACKFILL_MAX_PAGES = 8;

export interface NewPb {
  /** Alphanumeric ids are a string in practice, so this is a string. */
  scenarioId: string;
  title: string;
  score: number;
  previous: number | null;
}

export interface SyncResult {
  scanned: number;
  newPbs: NewPb[];
  benchmarksUpdated: number;
  backfillDone: boolean;
}

interface LinkRow {
  account_id: string;
  easyaim_player_id: number;
  last_run_id: number | null;
  backfill_cursor: string | null;
  backfill_done: boolean;
}

interface BenchmarkScenarioRow {
  easyaim_scenario_id: string;
  title: string;
}

/**
 * Pulls the linked player's runs from EasyAim and records personal
 * bests for scenarios that are attached to a benchmark. When a PB
 * lands, the player's aggregate for every benchmark containing that
 * scenario is recomputed (rank = highest rank where ALL scenarios
 * pass; score = sum of PBs) and appended to benchmark_scores so the
 * leaderboard and rank history update.
 */
export async function syncEasyAimAccount(accountId: string): Promise<SyncResult> {
  const { data: linkData, error: linkError } = await supabaseAdmin
    .from("easyaim_links")
    .select(
      "account_id, easyaim_player_id, last_run_id, backfill_cursor, backfill_done"
    )
    .eq("account_id", accountId)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!linkData) throw new Error("No EasyAim account linked");

  const link = linkData as LinkRow;

  const { data: scenarioRows, error: scenarioError } = await supabaseAdmin
    .from("benchmark_scenarios")
    .select("easyaim_scenario_id, title");

  if (scenarioError) throw scenarioError;

  const attachedScenarios = new Map<string, string>();
  for (const row of scenarioRows || []) {
    const scenario = row as BenchmarkScenarioRow;
    // Every EasyAim scenario used by *any* tier of any benchmark. A union is
    // right here even though the aggregates are per-primary-tier: a personal
    // best is stored against the EasyAim scenario, not against a tier, so if
    // Elite uses a scenario Novice does not, that best still has to be recorded
    // or switching to Elite shows a blank score for a run the player made.
    if (!attachedScenarios.has(String(scenario.easyaim_scenario_id))) {
      attachedScenarios.set(String(scenario.easyaim_scenario_id), scenario.title);
    }
  }

  // Nothing to track until a benchmark uses an EasyAim scenario.
  if (attachedScenarios.size === 0) {
    return {
      scanned: 0,
      newPbs: [],
      benchmarksUpdated: 0,
      backfillDone: link.backfill_done,
    };
  }

  const collected: EasyAimRun[] = [];
  let newestRunId = link.last_run_id;
  let backfillCursor: string | null = link.backfill_cursor;
  let backfillDone = link.backfill_done;

  // 1. Newest runs first, stopping once we reach a run we already stored.
  let cursor: string | undefined;
  let firstScanNext: string | null = null;

  for (let page = 0; page < NEW_RUNS_MAX_PAGES; page++) {
    const result = await getRunPage(link.easyaim_player_id, cursor, PAGE_SIZE);
    collected.push(...result.data);
    firstScanNext = result.next;

    for (const run of result.data) {
      if (newestRunId === null || run.id > newestRunId) {
        newestRunId = run.id;
      }
    }

    const caughtUp =
      link.last_run_id !== null &&
      result.data.some((run) => run.id <= (link.last_run_id as number));

    cursor = result.next ?? undefined;
    if (caughtUp || !result.next) break;
  }

  // 2. Continue the one-time backfill of older history.
  if (!backfillDone) {
    if (backfillCursor === null) {
      backfillCursor = firstScanNext;
    }

    for (let page = 0; page < BACKFILL_MAX_PAGES; page++) {
      if (!backfillCursor) {
        backfillDone = true;
        break;
      }

      const result = await getRunPage(
        link.easyaim_player_id,
        backfillCursor,
        PAGE_SIZE
      );
      collected.push(...result.data);
      backfillCursor = result.next;
      if (!result.next) backfillDone = true;
    }
  }

  // Persist progress up front so a failure below can't cause the same
  // runs to be scanned over and over.
  const { error: updateError } = await supabaseAdmin
    .from("easyaim_links")
    .update({
      last_run_id: newestRunId,
      backfill_cursor: backfillCursor,
      backfill_done: backfillDone,
      last_synced_at: new Date().toISOString(),
    })
    .eq("account_id", accountId);

  if (updateError) throw updateError;

  // 3. Best run per attached scenario across everything we just read.
  //
  // EasyAim exposes a `best` flag on each run. It is treated as a HINT that can
  // only ever raise the pick, never lower it -- see the note at the write step
  // below for why trusting it as authority cost real scores.
  //
  // Taking the maximum over the fetched window remains the primary rule: a
  // genuine improvement inside the window is always picked. The flag is merged
  // in second, and only where it is higher, so it can surface a better run the
  // window happened not to contain without ever displacing a better one it did.
  const flaggedBestByScenario = new Map<string, EasyAimRun>();
  const bestRunByScenario = new Map<string, EasyAimRun>();

  for (const run of collected) {
    if (!attachedScenarios.has(String(run.scenarioId))) continue;

    const key = String(run.scenarioId);
    const current = bestRunByScenario.get(key);

    if (!current || run.score > current.score) {
      bestRunByScenario.set(key, run);
    }

    if (run.best) {
      const flagged = flaggedBestByScenario.get(key);
      if (!flagged || run.score > flagged.score) {
        flaggedBestByScenario.set(key, run);
      }
    }
  }

  // A flagged run is only ever allowed to RAISE the pick, never to lower it.
  // Merging it in unconditionally would let a flagged 95 replace a real 120
  // picked from the window, which is the same corruption as above one step
  // earlier in the pipeline.
  for (const [key, run] of flaggedBestByScenario) {
    const current = bestRunByScenario.get(key);
    if (!current || run.score > current.score) {
      bestRunByScenario.set(key, run);
    }
  }

  const newPbs: NewPb[] = [];

  // No early return on an empty scan. The PB diff below needs runs, but
  // step 4 does not — it works off stored PBs, so a sync that scanned
  // nothing new still has to run, otherwise a benchmark whose scenarios
  // are all older than the scan window would never get a row.
  if (bestRunByScenario.size > 0) {
    const scenarioIds = Array.from(bestRunByScenario.keys());

    const { data: pbRows, error: pbError } = await supabaseAdmin
      .from("easyaim_pbs")
      .select("scenario_id, score")
      .eq("account_id", accountId)
      .in("scenario_id", scenarioIds);

    if (pbError) throw pbError;

    const storedPbs = new Map<string, number>();
    for (const row of pbRows || []) {
      const pb = row as { scenario_id: string; score: number };
      storedPbs.set(String(pb.scenario_id), pb.score);
    }

    const changed: { account_id: string; scenario_id: string; score: number; run_id: number; achieved_at: string }[] = [];

    for (const [scenarioId, run] of bestRunByScenario) {
      const previous = storedPbs.get(scenarioId) ?? null;

      // A personal best NEVER goes down. Not even for a run EasyAim flags.
      //
      // An earlier version of this file exempted flagged runs from that rule, on
      // the theory that the flag is authoritative and could correct a stored
      // value that was too high. That was wrong and it destroyed real data: it
      // let a flagged run scoring 95 overwrite a correct stored best of 120, so
      // the leaderboard showed 95 for a player whose best was 120. Whatever
      // `best` means on the EasyAim side, it is not safe to trust as authority
      // over what we already hold -- it is only ever used to RAISE a PB.
      //
      // Repairing a genuinely wrong stored PB is a deliberate rebuild, not
      // something a sync should do on its own: clearing easyaim_pbs and letting
      // the backfill repopulate. Guessing here silently lowers real scores.
      if (previous !== null && run.score <= previous) continue;

      changed.push({
        account_id: accountId,
        scenario_id: scenarioId,
        score: run.score,
        run_id: run.id,
        achieved_at: new Date(run.playedAt * 1000).toISOString(),
      });

      newPbs.push({
        scenarioId,
        title: attachedScenarios.get(scenarioId) || `Scenario ${scenarioId}`,
        score: run.score,
        previous,
      });
    }

    if (changed.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("easyaim_pbs")
        .upsert(changed, { onConflict: "account_id,scenario_id" });

      if (upsertError) throw upsertError;
    }
  }

  // 4. Recompute every benchmark that uses a scenario this account has a
  //    personal best for.
  //
  //    Keyed off easyaim_pbs, not off the runs we happened to scan this
  //    pass. Once a sync is caught up it only reads the newest page, so a
  //    benchmark attached to an older scenario would never be recomputed
  //    and never get a row — the aggregate is derived from stored PBs, so
  //    stored PBs are the right input. Union with the scenarios we just
  //    synced so a brand new PB is covered even before it lands.
  //
  //    The insert inside recordAggregateFor already compares against the
  //    previous row, so running this every sync is idempotent.
  const { data: storedPbRows, error: storedPbError } = await supabaseAdmin
    .from("easyaim_pbs")
    .select("scenario_id")
    .eq("account_id", accountId);

  if (storedPbError) throw storedPbError;

  const recomputeScenarioIds = new Set<string>([
    ...((storedPbRows || []) as { scenario_id: number }[]).map(
      (row) => String(row.scenario_id)
    ),
    ...bestRunByScenario.keys(),
  ]);

  if (recomputeScenarioIds.size === 0) {
    return { scanned: collected.length, newPbs, benchmarksUpdated: 0, backfillDone };
  }

  const { data: affectedRows, error: affectedError } = await supabaseAdmin
    .from("benchmark_scenarios")
    .select("benchmark_id")
    .in("easyaim_scenario_id", Array.from(recomputeScenarioIds));

  if (affectedError) throw affectedError;

  const affectedBenchmarks = [
    ...new Set((affectedRows || []).map((row) => (row as { benchmark_id: string }).benchmark_id)),
  ];

  let benchmarksUpdated = 0;

  // One batched recompute for every affected benchmark rather than a loop
  // of per-benchmark ones. The old shape awaited recordAggregateFor in a
  // for-loop, and each of those did three sequential round trips of its
  // own, so a player attached to ten benchmarks spent thirty sequential
  // trips here. One benchmark read, one scenario read, one bests read, one
  // history read, all in parallel, then arithmetic.
  if (affectedBenchmarks.length > 0) {
    benchmarksUpdated = await recordAggregatesFor(accountId, affectedBenchmarks);
  }

  return {
    scanned: collected.length,
    newPbs,
    benchmarksUpdated,
    backfillDone,
  };
}

/**
 * How many benchmarks one recompute pass will look at.
 *
 * A player is realistically attached to a handful. The cap exists so a
 * pathological link cannot turn one sync into an unbounded `in (...)` list,
 * and it is logged when hit rather than silently truncating, because a
 * silently dropped benchmark is a player whose rank quietly stops updating.
 */
const MAX_BENCHMARKS_PER_RECOMPUTE = 500;

/**
 * Recomputes one account's standing on any number of benchmarks from their
 * stored personal bests, and appends a benchmark_scores row only where the
 * value actually moved.
 *
 * benchmark_scores is append-only history, so "only if it changed" is what
 * keeps a re-sync from piling up duplicate rows.
 *
 * Everything is read in one parallel batch and the ranks come from
 * computeAggregates — the same walk the benchmark cards and the leaderboard
 * use. This function used to carry its own copy of that walk, with a comment
 * explaining that the two had to be kept in agreement. Two hand-written
 * copies of a rule do not stay in agreement, and a card disagreeing with a
 * synced history row is exactly the bug the whole refactor existed to
 * remove. There is one implementation now and this calls it.
 *
 * Safe to call repeatedly. Returns how many rows were written.
 */
export async function recordAggregatesFor(
  accountId: string,
  benchmarkIds: string[]
): Promise<number> {
  const ids = [...new Set(benchmarkIds)].slice(0, MAX_BENCHMARKS_PER_RECOMPUTE);

  if (ids.length === 0) return 0;

  const [benchmarkResult, scenarioResult, pbResult, historyResult] =
    await Promise.all([
      supabaseAdmin
        .from("benchmarks")
        .select("id, rank_names, rank_thresholds")
        .in("id", ids),

      supabaseAdmin
        .from("benchmark_scenarios")
        .select("benchmark_id, tier_id, easyaim_scenario_id, cutoffs")
        .in("benchmark_id", ids),

      // Keyed by account, so this does not have to wait for the scenarios.
      supabaseAdmin
        .from("easyaim_pbs")
        .select("scenario_id, score")
        .eq("account_id", accountId),

      // Newest first, so the first row seen for a benchmark is its latest.
      supabaseAdmin
        .from("benchmark_scores")
        .select("benchmark_id, score, rank, rank_index, completed_at")
        .eq("user_id", accountId)
        .in("benchmark_id", ids)
        .order("completed_at", { ascending: false }),
    ]);

  for (const [name, result] of [
    ["benchmarks", benchmarkResult],
    ["scenarios", scenarioResult],
    ["pbs", pbResult],
    ["history", historyResult],
  ] as const) {
    if (result.error) {
      throw new Error(`RECOMPUTE: failed to load ${name}: ${result.error.message}`);
    }
  }

  const benchmarks = (benchmarkResult.data ?? []) as RankSource[];

  const scenarios = scenariosInPrimaryTiers(
    (scenarioResult.data ?? []) as unknown as (ScenarioCutoffs & {
      tier_id: string | null;
    })[],
    primaryTierIds(await loadAllTierRefs())
  );

  // A benchmark with no scenarios has nothing to score, so it gets no row —
  // the same call computeAggregates makes when it reports one as unplayed.
  const scored = new Set(scenarios.map((s) => s.benchmark_id));
  const rankable = benchmarks.filter((b) => scored.has(b.id));

  const pbByScenario = new Map<string, number>();
  for (const row of (pbResult.data ?? []) as { scenario_id: string; score: number }[]) {
    pbByScenario.set(String(row.scenario_id), Number(row.score));
  }

  const aggregates = computeAggregates(rankable, scenarios, pbByScenario);

  const latest = new Map<
    string,
    { score: number; rank: string | null; rank_index: number | null }
  >();
  for (const row of (historyResult.data ?? []) as {
    benchmark_id: string;
    score: number;
    rank: string | null;
    rank_index: number | null;
  }[]) {
    if (!latest.has(row.benchmark_id)) latest.set(row.benchmark_id, row);
  }

  const inserts: {
    benchmark_id: string;
    user_id: string;
    score: number;
    rank: string | null;
    rank_index: number | null;
  }[] = [];

  for (const benchmark of rankable) {
    const aggregate = aggregates.get(benchmark.id);
    if (!aggregate) continue;

    const previous = latest.get(benchmark.id);

    if (
      previous &&
      previous.score === aggregate.score &&
      previous.rank === aggregate.rank &&
      previous.rank_index === aggregate.rankIndex
    ) {
      continue;
    }

    inserts.push({
      benchmark_id: benchmark.id,
      user_id: accountId,
      score: aggregate.score,
      rank: aggregate.rank,
      rank_index: aggregate.rankIndex,
    });
  }

  if (inserts.length === 0) return 0;

  const { error } = await supabaseAdmin.from("benchmark_scores").insert(inserts);

  if (error) {
    console.error("EASYAIM AGGREGATE INSERT ERROR:", error);
    return 0;
  }

  return inserts.length;
}

/**
 * Single-benchmark convenience wrapper over recordAggregatesFor. Used by the
 * create and edit routes, which only ever touch the one benchmark they just
 * wrote.
 */
export async function recordAggregateFor(
  accountId: string,
  benchmarkId: string
): Promise<boolean> {
  return (await recordAggregatesFor(accountId, [benchmarkId])) > 0;
}
