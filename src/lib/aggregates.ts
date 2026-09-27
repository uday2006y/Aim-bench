import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";

export interface Aggregate {
  score: number;
  rank: string | null;
  rankIndex: number | null;
  /**
   * True only when the viewer reached the top rank that has cutoffs
   * defined. "Complete" is reserved for this: clearing a middle rank is
   * progress, not completion, so a card showing "Gold" on a benchmark whose
   * top rank is Platinum should not also claim to be complete.
   */
  maxed: boolean;
}

/**
 * Recomputes standings for several benchmarks in a fixed number of
 * queries, straight from easyaim_pbs.
 *
 * The benchmark list needs the viewer's rank on every card, and reading it
 * from benchmark_scores made the card depend on a sync having run. That is
 * fragile: benchmark_scores is only written when the sync engine reaches a
 * benchmark, and it deliberately ignores scenarios older than the recent
 * run window, so a benchmark created after someone's last sync had no row
 * at all and the card said "Not played" for a player who had cleared it.
 *
 * Two queries total regardless of how many benchmarks are on screen:
 *   1. every scenario belonging to the requested benchmarks
 *   2. the viewer's PB for those scenarios
 * then the rank walk runs in memory.
 *
 * The same walk is used by the sync engine's recomputeBenchmarkAggregate,
 * so a card and a synced row can never disagree.
 */

/**
 * Highest rank that every scenario clears.
 *
 * A rank with no cutoff set on any scenario is skipped rather than
 * auto-passed. "No cutoff for this scenario" means the scenario doesn't
 * count for that rank, but a rank with no requirement defined anywhere has
 * nothing to clear, so granting it would hand the top rank to everyone
 * who opened the page. The benchmark table warns about exactly this case.
 */
function resolveRank(
  rankNames: string[],
  scenarios: { cutoffs: Record<string, number> | null; pb: number | null }[]
): { rank: string | null; rankIndex: number | null } {
  const scorable = rankNames.filter((rank) =>
    scenarios.some((scenario) => {
      const needed = scenario.cutoffs?.[rank];
      return typeof needed === "number";
    })
  );

  for (let index = scorable.length - 1; index >= 0; index--) {
    const rank = scorable[index];

    const passesAll = scenarios.every((scenario) => {
      const needed = scenario.cutoffs?.[rank];
      // A scenario with no cutoff for this rank doesn't count against it.
      if (needed === undefined || needed === null) return true;
      return (scenario.pb ?? 0) >= needed;
    });

    if (passesAll) return { rank, rankIndex: rankNames.indexOf(rank) };
  }

  return { rank: null, rankIndex: null };
}

export async function computeAggregatesFor(
  accountId: string | null,
  benchmarkIds: string[]
): Promise<Map<string, Aggregate>> {
  const result = new Map<string, Aggregate>();

  if (benchmarkIds.length === 0) return result;

  const { data: benchmarkRows, error: benchmarkError } = await supabaseAdmin
    .from("benchmarks")
    .select("id, rank_names, rank_thresholds")
    .in("id", benchmarkIds);

  if (benchmarkError) {
    console.error("AGGREGATES: failed to load benchmarks:", benchmarkError);
    return result;
  }

  const { data: scenarioRows, error: scenarioError } = await supabaseAdmin
    .from("benchmark_scenarios")
    .select("benchmark_id, easyaim_scenario_id, cutoffs")
    .in("benchmark_id", benchmarkIds);

  if (scenarioError) {
    console.error("AGGREGATES: failed to load scenarios:", scenarioError);
    return result;
  }

  const scenarioIds = [
    ...new Set(
      (scenarioRows || []).map((row) =>
        Number(
          (row as { easyaim_scenario_id: number }).easyaim_scenario_id
        )
      )
    ),
  ];

  // The viewer's PBs for the scenarios in play.
  const pbByScenario = new Map<number, number>();

  if (accountId && scenarioIds.length > 0) {
    const { data: pbRows, error: pbError } = await supabaseAdmin
      .from("easyaim_pbs")
      .select("scenario_id, score")
      .eq("account_id", accountId)
      .in("scenario_id", scenarioIds);

    if (pbError) {
      console.error("AGGREGATES: failed to load personal bests:", pbError);
    } else {
      for (const row of pbRows || []) {
        const pb = row as { scenario_id: number; score: number };
        pbByScenario.set(pb.scenario_id, pb.score);
      }
    }
  }

  const scenariosByBenchmark = new Map<
    string,
    { easyaim_scenario_id: number; cutoffs: Record<string, number> | null }[]
  >();

  for (const row of scenarioRows || []) {
    const scenario = row as {
      benchmark_id: string;
      easyaim_scenario_id: number;
      cutoffs: Record<string, number> | null;
    };

    const list = scenariosByBenchmark.get(scenario.benchmark_id) ?? [];
    list.push({
      easyaim_scenario_id: Number(scenario.easyaim_scenario_id),
      cutoffs: scenario.cutoffs ?? {},
    });
    scenariosByBenchmark.set(scenario.benchmark_id, list);
  }

  for (const row of benchmarkRows || []) {
    const benchmark = row as {
      id: string;
      rank_names: string[] | null;
      rank_thresholds: Record<string, number> | null;
    };

    const scenarios = scenariosByBenchmark.get(benchmark.id) ?? [];

    if (scenarios.length === 0) {
      result.set(benchmark.id, {
        score: 0,
        rank: null,
        rankIndex: null,
        maxed: false,
      });
      continue;
    }

    const withPbs = scenarios.map((scenario) => ({
      cutoffs: scenario.cutoffs,
      pb: pbByScenario.get(scenario.easyaim_scenario_id) ?? null,
    }));

    const score = withPbs.reduce((sum, scenario) => sum + (scenario.pb ?? 0), 0);

    const rankNames = benchmark.rank_names?.length
      ? benchmark.rank_names
      : Object.entries(benchmark.rank_thresholds || {})
          .sort((a, b) => a[1] - b[1])
          .map(([name]) => name);

    const { rank, rankIndex } =
      rankNames.length > 0
        ? resolveRank(rankNames, withPbs)
        : { rank: null, rankIndex: null };

    // The top rank that actually has cutoffs — the ceiling for "Complete".
    const scorable = rankNames.filter((name) =>
      withPbs.some((scenario) => typeof scenario.cutoffs?.[name] === "number")
    );
    const topRank = scorable.length > 0 ? scorable[scorable.length - 1] : null;

    result.set(benchmark.id, {
      score,
      rank,
      rankIndex,
      maxed: rank !== null && rank === topRank,
    });
  }

  return result;
}
