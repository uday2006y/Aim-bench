import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import {
  MAX_TIERS,
  orderTiers,
  sanitizeLadder,
  type Tier,
  type TierDraft,
  type TierRef,
} from "./benchmarkTiers";
import type { TierScenarioInput } from "./benchmarkScenarios";

/**
 * Reading and writing a benchmark's tiers.
 *
 * Server-only, and the only module that knows the tier table names. Everything
 * above it deals in `Tier` objects and `TierScenarioInput`.
 *
 * A scenario belongs to a tier. That is the load-bearing decision here: it is
 * why there is no benchmark-wide scenario list to filter, why a tier's cutoffs
 * sit on its own scenario rows, and why adding a scenario is a row rather than
 * a copy of the whole benchmark.
 */

/** Cap on how many rows one read will pull. Logged when hit, never silent. */
const SCENARIO_LIMIT = 5000;

/** Cap on how many tier rows a cross-benchmark read will pull. */
const TIER_SCAN_LIMIT = 5000;

interface TierRow {
  id: string;
  benchmark_id: string;
  slug: string;
  name: string;
  position: number;
  rank_names: string[] | null;
  rank_colors: string[] | null;
  is_official: boolean | null;
}

function toTier(row: TierRow): Tier {
  // The ladder goes through the same validator the forms do, so a row written
  // by an older build — or by hand — cannot reach a table with a colour ladder
  // shorter than its name ladder.
  const ladder = sanitizeLadder(row.rank_names ?? [], row.rank_colors ?? []);

  return {
    id: row.id,
    benchmark_id: row.benchmark_id,
    slug: row.slug,
    name: row.name,
    position: row.position ?? 0,
    rank_names: ladder.rank_names,
    rank_colors: ladder.rank_colors,
    is_official: row.is_official !== false,
  };
}

export async function loadTiers(benchmarkId: string): Promise<Tier[]> {
  const { data, error } = await supabaseAdmin
    .from("benchmark_tiers")
    .select("id, benchmark_id, slug, name, position, rank_names, rank_colors, is_official")
    .eq("benchmark_id", benchmarkId);

  if (error) {
    console.error("TIERS: failed to load:", error);
    return [];
  }

  return orderTiers(((data ?? []) as TierRow[]).map(toTier));
}

/** A benchmark_scenarios row as the tier pages read it. */
export interface ScenarioRow {
  id: string;
  easyaim_scenario_id: string;
  title: string;
  position: number;
  category: string | null;
  sub_category: string | null;
  cutoffs: Record<string, number> | null;
}

/**
 * One tier's scenarios, ordered.
 *
 * Cutoffs live on the row now that a scenario is not shared between tiers.
 */
export async function loadTierScenarios(tierId: string): Promise<ScenarioRow[]> {
  const { data, error } = await supabaseAdmin
    .from("benchmark_scenarios")
    .select("id, easyaim_scenario_id, title, position, category, sub_category, cutoffs")
    .eq("tier_id", tierId)
    .order("position", { ascending: true })
    .limit(SCENARIO_LIMIT);

  if (error) {
    console.error("TIERS: failed to load scenarios:", error);
    return [];
  }

  return (data ?? []) as ScenarioRow[];
}

/**
 * Creates a benchmark's tiers and returns them.
 *
 * Returns the created rows, id and slug, because the caller needs the ids to
 * point scenarios at them — scenarios belong to a tier, so this has to run
 * before the scenario rows are written.
 *
 * Every tier starts on the benchmark's ladder. Cutoffs are not copied: there is
 * nothing to copy them from now that a scenario belongs to one tier. A tier with
 * no scenarios yet is correct and expected — the author adds them on the edit
 * page — and the page says so rather than showing a table of em-dashes.
 *
 * Best-effort: a database without the tier tables still gets its benchmark.
 * Failing the whole create over a missing table would be worse than a benchmark
 * with no tiers, which the tier page already explains in words.
 */
export async function createTiersForBenchmark(
  benchmarkId: string,
  drafts: TierDraft[],
  fallbackNames: string[],
  fallbackColors: string[]
): Promise<{ id: string; slug: string }[]> {
  // No tiers asked for still means one tier: every benchmark has a default
  // address, and /benchmarks/<id> forwards to it.
  const tiers: TierDraft[] =
    drafts.length > 0
      ? drafts
      : [{ slug: "primary", name: "Standard", isOfficial: true }];

  const ladder = sanitizeLadder(fallbackNames, fallbackColors);

  const rows = tiers.slice(0, MAX_TIERS).map((tier, index) => ({
    benchmark_id: benchmarkId,
    slug: tier.slug,
    name: tier.name,
    position: index,
    rank_names: ladder.rank_names,
    rank_colors: ladder.rank_colors,
    is_official: tier.isOfficial !== false,
  }));

  const { data, error } = await supabaseAdmin
    .from("benchmark_tiers")
    .insert(rows)
    .select("id, slug");

  if (error) {
    console.error("TIERS: could not create tiers:", error);
    return [];
  }

  return (data ?? []) as { id: string; slug: string }[];
}

/**
 * Every tier, across every benchmark, as just enough to find each one's first.
 *
 * The benchmark list and the leaderboard both need to narrow a flat scenario
 * read down to each benchmark's primary tier, and both read across all
 * benchmarks at once. Rather than teaching either one about tiers, they get
 * this one row-set and use scenariosInPrimaryTiers.
 */
export async function loadAllTierRefs(): Promise<TierRef[]> {
  const { data, error } = await supabaseAdmin
    .from("benchmark_tiers")
    .select("id, benchmark_id, slug, name, position")
    .limit(TIER_SCAN_LIMIT);

  if (error) {
    console.error("TIERS: failed to load tier refs:", error);
    return [];
  }

  return (data ?? []) as TierRef[];
}

/**
 * Replaces one tier's scenario list wholesale.
 *
 * Delete-then-insert rather than a diff, because a scenario removed from the
 * tier has to lose its row: an upsert leaves orphans behind that nothing reads
 * but that a later re-add would silently inherit.
 */
export async function replaceTierScenarios(
  tierId: string,
  rows: TierScenarioInput[]
): Promise<void> {
  const { error: deleteError } = await supabaseAdmin
    .from("benchmark_scenarios")
    .delete()
    .eq("tier_id", tierId);

  if (deleteError) throw deleteError;

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from("benchmark_scenarios").insert(
    rows.map((row) => ({
      tier_id: tierId,
      easyaim_scenario_id: row.easyaimScenarioId,
      title: row.title,
      position: row.position,
      category: row.category,
      sub_category: row.subCategory || null,
      cutoffs: row.cutoffs,
    }))
  );

  if (error) throw error;
}
