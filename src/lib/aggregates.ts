/**
 * Working out where a viewer stands on a benchmark, from rows that have
 * already been fetched.
 *
 * Deliberately pure. This used to own its own database access, which made
 * it four sequential round trips to Postgres on another continent — and
 * the benchmark list was paying for every one of them before it could
 * paint a single card. Fetching is now the caller's job, done in parallel;
 * the rank walk itself is arithmetic and belongs here where it can be
 * tested without a database.
 *
 * The list needs the viewer's rank on every card, and reading it from
 * benchmark_scores made the card depend on a sync having run. That is
 * fragile: benchmark_scores is only written when the sync engine reaches a
 * benchmark, and it deliberately ignores scenarios older than the recent
 * run window, so a benchmark created after someone's last sync had no row
 * at all and the card said "Not played" for a player who had cleared it.
 */

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

/** The columns a benchmark row must supply. */
export interface RankSource {
  id: string;
  rank_names: string[] | null;
  rank_thresholds: Record<string, number> | null;
}

export interface ScenarioCutoffs {
  benchmark_id: string;
  easyaim_scenario_id: number;
  cutoffs: Record<string, number> | null;
}

/**
 * Whether a cutoff actually states a requirement.
 *
 * `> 0`, not "is a number". A cutoff of zero is indistinguishable from an
 * empty form field at the storage layer — sanitizeScenarios drops both — and
 * even where a zero does survive, "score zero or more" is not a requirement
 * anyone sets on purpose. computeTierFills and the detail page's
 * unreachable-rank warning both test `> 0`; this keeps the rank walk in
 * agreement with them instead of treating a blank tier as auto-passed.
 */
function statesRequirement(cutoffs: Record<string, number> | null, rank: string): boolean {
  const needed = cutoffs?.[rank];
  return typeof needed === "number" && needed > 0;
}

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
    scenarios.some((scenario) => statesRequirement(scenario.cutoffs, rank))
  );

  for (let index = scorable.length - 1; index >= 0; index--) {
    const rank = scorable[index];

    const passesAll = scenarios.every((scenario) => {
      // A scenario with no cutoff for this rank doesn't count against it.
      if (!statesRequirement(scenario.cutoffs, rank)) return true;
      return (scenario.pb ?? 0) >= (scenario.cutoffs?.[rank] as number);
    });

    if (passesAll) return { rank, rankIndex: rankNames.indexOf(rank) };
  }

  return { rank: null, rankIndex: null };
}

/**
 * Rank ladder to walk. Older rows stored thresholds only, so both are
 * accepted and the names win when present.
 */
function rankLadderOf(benchmark: RankSource): string[] {
  if (benchmark.rank_names?.length) return benchmark.rank_names;

  return Object.entries(benchmark.rank_thresholds || {})
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);
}

/**
 * Resolve the viewer's standing on every supplied benchmark.
 *
 * `pbByScenario` is the viewer's personal best per EasyAim scenario id. Any
 * scenario missing from it counts as zero, which is the same thing the
 * cutoffs compare against.
 */
export function computeAggregates(
  benchmarks: RankSource[],
  scenarios: ScenarioCutoffs[],
  pbByScenario: Map<number, number>
): Map<string, Aggregate> {
  const result = new Map<string, Aggregate>();

  const scenariosByBenchmark = new Map<string, ScenarioCutoffs[]>();

  for (const scenario of scenarios) {
    const list = scenariosByBenchmark.get(scenario.benchmark_id) ?? [];
    list.push(scenario);
    scenariosByBenchmark.set(scenario.benchmark_id, list);
  }

  for (const benchmark of benchmarks) {
    const own = scenariosByBenchmark.get(benchmark.id) ?? [];

    if (own.length === 0) {
      result.set(benchmark.id, {
        score: 0,
        rank: null,
        rankIndex: null,
        maxed: false,
      });
      continue;
    }

    const withPbs = own.map((scenario) => ({
      cutoffs: scenario.cutoffs,
      pb: pbByScenario.get(scenario.easyaim_scenario_id) ?? null,
    }));

    const score = withPbs.reduce((sum, scenario) => sum + (scenario.pb ?? 0), 0);

    const rankNames = rankLadderOf(benchmark);

    const { rank, rankIndex } =
      rankNames.length > 0
        ? resolveRank(rankNames, withPbs)
        : { rank: null, rankIndex: null };

    // The top rank that actually has cutoffs — the ceiling for "Complete".
    const scorable = rankNames.filter((name) =>
      withPbs.some((scenario) => statesRequirement(scenario.cutoffs, name))
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
