import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import { getRunPage, type EasyAimRun } from "./easyaim";

const PAGE_SIZE = 25;
const NEW_RUNS_MAX_PAGES = 4;
const BACKFILL_MAX_PAGES = 8;

export interface NewPb {
  scenarioId: number;
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
  easyaim_scenario_id: number;
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

  const attachedScenarios = new Map<number, string>();
  for (const row of scenarioRows || []) {
    const scenario = row as BenchmarkScenarioRow;
    if (!attachedScenarios.has(scenario.easyaim_scenario_id)) {
      attachedScenarios.set(scenario.easyaim_scenario_id, scenario.title);
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
  const bestRunByScenario = new Map<number, EasyAimRun>();
  for (const run of collected) {
    if (!attachedScenarios.has(run.scenarioId)) continue;

    const current = bestRunByScenario.get(run.scenarioId);
    if (!current || run.score > current.score) {
      bestRunByScenario.set(run.scenarioId, run);
    }
  }

  if (bestRunByScenario.size === 0) {
    return {
      scanned: collected.length,
      newPbs: [],
      benchmarksUpdated: 0,
      backfillDone,
    };
  }

  const scenarioIds = Array.from(bestRunByScenario.keys());

  const { data: pbRows, error: pbError } = await supabaseAdmin
    .from("easyaim_pbs")
    .select("scenario_id, score")
    .eq("account_id", accountId)
    .in("scenario_id", scenarioIds);

  if (pbError) throw pbError;

  const storedPbs = new Map<number, number>();
  for (const row of pbRows || []) {
    const pb = row as { scenario_id: number; score: number };
    storedPbs.set(pb.scenario_id, pb.score);
  }

  const changed: { scenario_id: number; score: number; run_id: number; achieved_at: string }[] = [];
  const newPbs: NewPb[] = [];

  for (const [scenarioId, run] of bestRunByScenario) {
    const previous = storedPbs.get(scenarioId) ?? null;
    if (previous !== null && run.score <= previous) continue;

    changed.push({
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

  if (changed.length === 0) {
    return {
      scanned: collected.length,
      newPbs,
      benchmarksUpdated: 0,
      backfillDone,
    };
  }

  const { error: upsertError } = await supabaseAdmin
    .from("easyaim_pbs")
    .upsert(changed, { onConflict: "account_id,scenario_id" });

  if (upsertError) throw upsertError;

  // 4. Recompute every benchmark that contains one of the updated
  // scenarios, and append the new aggregate when it changed.
  const changedScenarioIds = changed.map((pb) => pb.scenario_id);

  const { data: affectedRows, error: affectedError } = await supabaseAdmin
    .from("benchmark_scenarios")
    .select("benchmark_id")
    .in("easyaim_scenario_id", changedScenarioIds);

  if (affectedError) throw affectedError;

  const affectedBenchmarks = [
    ...new Set((affectedRows || []).map((row) => (row as { benchmark_id: string }).benchmark_id)),
  ];

  let benchmarksUpdated = 0;

  for (const benchmarkId of affectedBenchmarks) {
    const aggregate = await recomputeBenchmarkAggregate(accountId, benchmarkId);
    if (!aggregate) continue;

    const { data: lastRow } = await supabaseAdmin
      .from("benchmark_scores")
      .select("score, rank, rank_index")
      .eq("benchmark_id", benchmarkId)
      .eq("user_id", accountId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const last = lastRow as
      | { score: number; rank: string | null; rank_index: number | null }
      | null;

    if (
      last &&
      last.score === aggregate.score &&
      last.rank === aggregate.rank &&
      last.rank_index === aggregate.rankIndex
    ) {
      continue;
    }

    const { error: insertError } = await supabaseAdmin
      .from("benchmark_scores")
      .insert({
        benchmark_id: benchmarkId,
        user_id: accountId,
        score: aggregate.score,
        rank: aggregate.rank,
        rank_index: aggregate.rankIndex,
      });

    if (insertError) {
      console.error("EASYAIM AGGREGATE INSERT ERROR:", insertError);
      continue;
    }

    benchmarksUpdated += 1;
  }

  return {
    scanned: collected.length,
    newPbs,
    benchmarksUpdated,
    backfillDone,
  };
}

interface Aggregate {
  score: number;
  rank: string | null;
  rankIndex: number | null;
}

async function recomputeBenchmarkAggregate(
  accountId: string,
  benchmarkId: string
): Promise<Aggregate | null> {
  const { data: benchmarkData, error: benchmarkError } = await supabaseAdmin
    .from("benchmarks")
    .select("rank_names, rank_thresholds")
    .eq("id", benchmarkId)
    .maybeSingle();

  if (benchmarkError) throw benchmarkError;
  if (!benchmarkData) return null;

  const benchmark = benchmarkData as {
    rank_names: string[] | null;
    rank_thresholds: Record<string, number> | null;
  };

  const { data: scenarioData, error: scenariosError } = await supabaseAdmin
    .from("benchmark_scenarios")
    .select("easyaim_scenario_id, cutoffs")
    .eq("benchmark_id", benchmarkId);

  if (scenariosError) throw scenariosError;

  const scenarios = (scenarioData || []) as {
    easyaim_scenario_id: number;
    cutoffs: Record<string, number> | null;
  }[];

  if (scenarios.length === 0) return null;

  const scenarioIds = scenarios.map((scenario) => scenario.easyaim_scenario_id);

  const { data: pbData, error: pbError } = await supabaseAdmin
    .from("easyaim_pbs")
    .select("scenario_id, score")
    .eq("account_id", accountId)
    .in("scenario_id", scenarioIds);

  if (pbError) throw pbError;

  const pbs = new Map<number, number>();
  for (const row of pbData || []) {
    const pb = row as { scenario_id: number; score: number };
    pbs.set(pb.scenario_id, pb.score);
  }

  const rankNames = benchmark.rank_names?.length
    ? benchmark.rank_names
    : Object.entries(benchmark.rank_thresholds || {})
        .sort((a, b) => a[1] - b[1])
        .map(([name]) => name);

  const score = scenarioIds.reduce(
    (sum, scenarioId) => sum + (pbs.get(scenarioId) ?? 0),
    0
  );

  if (rankNames.length === 0) {
    return { score, rank: null, rankIndex: null };
  }

  let achieved = -1;

  for (let index = rankNames.length - 1; index >= 0; index--) {
    const rank = rankNames[index];

    const passesAll = scenarios.every((scenario) => {
      const needed = scenario.cutoffs?.[rank];
      if (needed === undefined || needed === null) return true;
      return (pbs.get(scenario.easyaim_scenario_id) ?? 0) >= needed;
    });

    if (passesAll) {
      achieved = index;
      break;
    }
  }

  return {
    score,
    rank: achieved >= 0 ? rankNames[achieved] : null,
    rankIndex: achieved >= 0 ? achieved : null,
  };
}