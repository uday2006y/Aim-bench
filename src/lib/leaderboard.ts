import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import { computeAggregates, type RankSource, type ScenarioCutoffs } from "./aggregates";
import {
  primaryTierIds,
  scenariosInPrimaryTiers,
  type TierRef,
} from "./benchmarkTiers";
import { loadAllTierRefs } from "./tiers";

/**
 * Guard on the personal-bests read.
 *
 * easyaim_pbs only stores a row for a scenario that is attached to at least
 * one benchmark, so this is bounded by (accounts x benchmark scenarios)
 * rather than by how much anyone has ever played. Logged rather than
 * silently truncated: a short read here produces a leaderboard that is
 * quietly missing people, which is the exact bug this whole module exists
 * to remove.
 */
const PB_SCAN_LIMIT = 50000;

export interface LeaderboardEntry {
  account_id: string;
  username: string;
  score: number;
  rank: string | null;
  rank_index: number | null;
  maxed: boolean;
  benchmark_id: string;
  benchmark_title: string;
  platform: string;
  /** Hex from the benchmark's own rank_colors ladder, so it renames with it. */
  rank_color: string;
  /**
   * When this player last set one of the personal bests that make up the
   * score. Not a completion date — benchmark_scores used to supply one, but
   * that is exactly the table this stopped reading, and "when did you last
   * improve here" is the more useful column anyway.
   */
  last_improved_at: string | null;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  total: number;
  truncated: boolean;
}

interface AccountRow {
  id: string;
  username: string | null;
  profiles: { display_name: string | null } | null;
}

interface BenchmarkRow extends RankSource {
  title: string;
  platform: string;
  rank_colors: string[] | null;
}

/**
 * Standings computed from personal bests, for every account at once.
 *
 * The leaderboard used to read benchmark_scores, which is written by the
 * sync engine. That made it disagree with the benchmark cards by
 * construction: the cards derive a rank from easyaim_pbs the moment a PB
 * exists, while the board only showed people the sync had reached. A player
 * could see "Gold" on their card and be absent from the leaderboard, and
 * reasonably report it as broken.
 *
 * Both now call the same rank walk over the same source, so a card and a
 * leaderboard row cannot disagree — there is nothing left to disagree
 * about. benchmark_scores keeps its real job, which is history: it records
 * *when* someone completed something, which is what the rank history page
 * reads and what no amount of live arithmetic can reconstruct.
 *
 * `benchmarkId` narrows to one benchmark; omit it for standings across all
 * of them.
 */
export async function buildLeaderboard(
  benchmarkId?: string | null
): Promise<LeaderboardResult> {
  const [accountResult, benchmarkResult, scenarioResult, tierRefs, pbResult] =
    await Promise.all([
      supabaseAdmin.from("accounts").select("id, username, profiles(display_name)"),

      (() => {
        let query = supabaseAdmin
          .from("benchmarks")
          .select("id, title, platform, rank_names, rank_thresholds, rank_colors");

        if (benchmarkId) query = query.eq("id", benchmarkId);

        return query;
      })(),

      supabaseAdmin
        .from("benchmark_scenarios")
        .select("benchmark_id, tier_id, easyaim_scenario_id, cutoffs")
        .limit(5000),

      // Tier ids for every benchmark, so the scenario rows above can be
      // narrowed to each benchmark's first tier. The board describes a
      // benchmark, and a benchmark's score is its first tier's score.
      loadAllTierRefs(),

      supabaseAdmin
        .from("easyaim_pbs")
        .select("account_id, scenario_id, score, achieved_at")
        .limit(PB_SCAN_LIMIT),
    ]);

  for (const [name, result] of [
    ["accounts", accountResult],
    ["benchmarks", benchmarkResult],
    ["scenarios", scenarioResult],
    ["pbs", pbResult],
  ] as const) {
    if (result.error) {
      console.error(`LEADERBOARD: failed to load ${name}:`, result.error);
    }
  }

  const truncated = (pbResult.data?.length ?? 0) >= PB_SCAN_LIMIT;

  if (truncated) {
    console.error(
      `LEADERBOARD: hit the ${PB_SCAN_LIMIT}-row personal-bests cap — the board is incomplete. ` +
        "Raise PB_SCAN_LIMIT."
    );
  }

  const benchmarks = (benchmarkResult.data || []) as BenchmarkRow[];

  // Scenarios belong to a tier, so a benchmark with three tiers has three
  // times the rows. Summing them all would add a player's Novice score to their
  // Elite score and call the total neither.
  const scenarios = scenariosInPrimaryTiers(
    (scenarioResult.data || []) as unknown as (ScenarioCutoffs & {
      tier_id: string | null;
    })[],
    primaryTierIds((tierRefs || []) as TierRef[])
  );

  const accounts = (accountResult.data || []) as unknown as AccountRow[];

  // One map of account -> scenario -> { score, achieved_at }, reused for
  // every benchmark.
  const pbsByAccount = new Map<
    string,
    Map<string, { score: number; achievedAt: string | null }>
  >();

  for (const row of pbResult.data || []) {
    const pb = row as {
      account_id: string;
      scenario_id: number;
      score: number;
      achieved_at: string | null;
    };

    let byScenario = pbsByAccount.get(pb.account_id);
    if (!byScenario) {
      byScenario = new Map();
      pbsByAccount.set(pb.account_id, byScenario);
    }

    byScenario.set(String(pb.scenario_id), {
      score: pb.score,
      achievedAt: pb.achieved_at ?? null,
    });
  }

  // Which scenarios belong to each benchmark, so "last improved" only
  // counts the PBs that actually count toward that benchmark's score.
  //
  // Built once, above the account loop. It used to be rebuilt inside it,
  // which made this section cost (accounts x scenarios) instead of
  // scenarios — invisible with three players, quadratic with three hundred.
  const scenarioIdsByBenchmark = new Map<string, Set<string>>();
  for (const scenario of scenarios) {
    let ids = scenarioIdsByBenchmark.get(scenario.benchmark_id);
    if (!ids) {
      ids = new Set();
      scenarioIdsByBenchmark.set(scenario.benchmark_id, ids);
    }
    ids.add(String(scenario.easyaim_scenario_id));
  }

  // The rank walk only needs the ladder columns, so project once rather than
  // rebuilding an object per account.
  const rankSources = benchmarks.map((b) => ({
    id: b.id,
    rank_names: b.rank_names,
    rank_thresholds: b.rank_thresholds,
  }));

  const entries: LeaderboardEntry[] = [];

  for (const account of accounts) {
    const pbs = pbsByAccount.get(account.id);
    if (!pbs || pbs.size === 0) continue;

    // Every account is scored against every benchmark in scope. The walk
    // is pure and in-memory, so the cost is arithmetic rather than queries.
    const standings = computeAggregates(
      rankSources,
      scenarios,
      // computeAggregates takes a plain score map; the timestamps are read
      // separately below.
      new Map(Array.from(pbs, ([id, value]) => [id, value.score]))
    );

    for (const benchmark of benchmarks) {
      const standing = standings.get(benchmark.id);
      if (!standing || standing.score <= 0) continue;

      const ownScenarios = scenarioIdsByBenchmark.get(benchmark.id) ?? new Set<string>();

      let lastImproved: string | null = null;
      for (const scenarioId of ownScenarios) {
        const pb = pbs.get(scenarioId);
        if (!pb?.achievedAt) continue;
        if (!lastImproved || pb.achievedAt > lastImproved) {
          lastImproved = pb.achievedAt;
        }
      }

      const colorIndex = standing.rankIndex ?? -1;

      entries.push({
        account_id: account.id,
        username: account.profiles?.display_name || account.username || "Anonymous",
        score: standing.score,
        rank: standing.rank,
        rank_index: standing.rankIndex,
        maxed: standing.maxed,
        benchmark_id: benchmark.id,
        benchmark_title: benchmark.title,
        platform: benchmark.platform,
        rank_color:
          colorIndex >= 0 && benchmark.rank_colors?.[colorIndex]
            ? benchmark.rank_colors[colorIndex]
            : "#ffffff",
        last_improved_at: lastImproved,
      });
    }
  }

  // Rank first, then score, so a higher tier always outranks a bigger
  // number. Accounts with no rank sort last, still ordered by score.
  entries.sort((a, b) => {
    const rankA = a.rank_index ?? -1;
    const rankB = b.rank_index ?? -1;
    if (rankA !== rankB) return rankB - rankA;
    return b.score - a.score;
  });

  return { entries, total: entries.length, truncated };
}
