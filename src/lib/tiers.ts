import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import {
  MAX_TIERS,
  orderTiers,
  sanitizeLadder,
  type Tier,
  type TierDraft,
} from "./benchmarkTiers";

/**
 * Reading and writing a benchmark's tiers.
 *
 * Server-only, and the only place that knows the table names. Everything
 * above it deals in `Tier` objects.
 */

/** Cap on how many scenario cutoff rows one read will pull. */
const CUTOFF_SCAN_LIMIT = 5000;

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
  // by an older build ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â or by hand ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â cannot reach a table with a colour ladder
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

export async function loadTier(benchmarkId: string, slug: string): Promise<Tier | null> {
  const { data, error } = await supabaseAdmin
    .from("benchmark_tiers")
    .select("id, benchmark_id, slug, name, position, rank_names, rank_colors, is_official")
    .eq("benchmark_id", benchmarkId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("TIERS: failed to load tier:", error);
    return null;
  }

  return data ? toTier(data as TierRow) : null;
}

/**
 * Cutoffs for one tier, as scenario id -> cutoffs.
 *
 * Keyed by scenario id rather than returned as rows so the caller can hang it
 * straight off the scenario list it already has.
 */
export async function loadTierCutoffs(tierId: string): Promise<Map<string, Record<string, number>>> {
  const { data, error } = await supabaseAdmin
    .from("benchmark_tier_cutoffs")
    .select("easyaim_scenario_id, cutoffs")
    .eq("tier_id", tierId)
    .limit(CUTOFF_SCAN_LIMIT);

  if (error) {
    console.error("TIERS: failed to load cutoffs:", error);
    return new Map();
  }

  const result = new Map<string, Record<string, number>>();

  for (const row of (data ?? []) as {
    easyaim_scenario_id: number;
    cutoffs: Record<string, number> | null;
  }[]) {
    result.set(String(row.easyaim_scenario_id), row.cutoffs ?? {});
  }

  return result;
}

/**
 * Creates a benchmark's tiers, each seeded with a copy of the same cutoffs.
 *
 * Seeding matters. A tier whose scenarios have no cutoffs has no rank that can
 * be reached, so creating six tiers and leaving them empty would hand the
 * author six pages of "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â". Copying the benchmark's own requirements means each
 * tier is immediately real and can be tuned from there.
 *
 * Best-effort: a database without the tier tables still gets its benchmark.
 * Failing the whole create over a missing table would be a worse outcome than
 * a benchmark with no tiers, which the tier page already explains in words.
 */
export async function createTiersForBenchmark(
  benchmarkId: string,
  drafts: TierDraft[],
  fallbackNames: string[],
  fallbackColors: string[],
  seedCutoffs: { easyaimScenarioId: string; cutoffs: Record<string, number> }[]
): Promise<void> {
  // No tiers asked for still means one tier: every benchmark has a default
  // address, and /benchmarks/<id> forwards to it.
  const tiers = drafts.length > 0 ? drafts : [{ slug: "primary", name: "Standard", isOfficial: true }];

  if (tiers.length > MAX_TIERS) {
    console.error(`TIERS: ${tiers.length} requested, capped at ${MAX_TIERS}`);
  }

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

  const { data: created, error } = await supabaseAdmin
    .from("benchmark_tiers")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("TIERS: could not create tiers:", error);
    return;
  }

  if (seedCutoffs.length === 0) return;

  const cutoffRows = (created ?? []).flatMap((tier) =>
    seedCutoffs.map((cutoff) => ({
      tier_id: (tier as { id: string }).id,
      easyaim_scenario_id: String(cutoff.easyaimScenarioId),
      cutoffs: cutoff.cutoffs,
    }))
  );

  const { error: cutoffError } = await supabaseAdmin
    .from("benchmark_tier_cutoffs")
    .insert(cutoffRows);

  if (cutoffError) {
    console.error("TIERS: could not seed tier cutoffs:", cutoffError);
  }
}

/**
 * Replaces one tier's cutoffs wholesale.
 *
 * Delete-then-insert rather than an upsert keyed on the scenario, because a
 * scenario removed from the benchmark has to lose its row too. An upsert would
 * leave orphans behind that nothing reads but that a later re-add would
 * silently inherit.
 */
export async function replaceTierCutoffs(
  tierId: string,
  cutoffs: { easyaimScenarioId: string; cutoffs: Record<string, number> }[]
): Promise<void> {
  const { error: deleteError } = await supabaseAdmin
    .from("benchmark_tier_cutoffs")
    .delete()
    .eq("tier_id", tierId);

  if (deleteError) throw deleteError;

  if (cutoffs.length === 0) return;

  const { error } = await supabaseAdmin.from("benchmark_tier_cutoffs").insert(
    cutoffs.map((row) => ({
      tier_id: tierId,
      easyaim_scenario_id: String(row.easyaimScenarioId),
      cutoffs: row.cutoffs,
    }))
  );

  if (error) throw error;
}
