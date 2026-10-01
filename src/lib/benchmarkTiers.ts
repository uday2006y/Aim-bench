/**
 * Tiers: a benchmark's named difficulty variants.
 *
 * A benchmark has up to six. Each one carries its own rank ladder and its own
 * per-scenario cutoffs, so "Novice" can ladder Iron → Bronze → Silver → Gold
 * while "Elite" ladders Nova → Astra → Celestial → Stellaris, off the same
 * scenarios. `/benchmarks/[id]/[tier]` renders one; the switcher in the header
 * moves between them.
 *
 * Pure and tested, like aggregates and benchmarkScenarios. Everything that
 * decides what a tier *is* — how many there can be, what a slug may be, what
 * a valid ladder is — lives here rather than in a route or a form, because
 * the create form, the edit form, the API routes and the switcher all have to
 * agree on it and four copies of a rule is how the rank ladder drifted twice
 * already.
 */

import {
  DEFAULT_RANK_NAMES as BENCHMARK_DEFAULT_NAMES,
  DEFAULT_RANK_COLORS as BENCHMARK_DEFAULT_COLORS,
} from "./benchmarkDefaults.ts";

/** Hard ceiling on tiers per benchmark. Six reads as a ladder, not a menu. */
export const MAX_TIERS = 6;

/** The slug every benchmark gets if it has exactly one tier. */
export const PRIMARY_SLUG = "primary";

export const MAX_TIER_NAME_LENGTH = 40;
export const MAX_TIER_SLUG_LENGTH = 48;
export const MAX_RANKS_PER_TIER = 12;

const DEFAULT_RANK_NAMES = BENCHMARK_DEFAULT_NAMES;

const DEFAULT_RANK_COLORS = BENCHMARK_DEFAULT_COLORS;

/** A tier as the API returns it. */
/**
 * Just enough of a tier row to identify the primary one. The full
 * Tier the pages use extends this.
 */
export interface TierRef {
  id: string;
  benchmark_id: string;
  slug: string;
  position: number;
  name: string;
}

/** A tier as the API returns it and the pages render it. */
export interface Tier extends TierRef {
  rank_names: string[];
  rank_colors: string[];
  is_official: boolean;
}

/** A tier as the create and edit forms handle it, before it has an id. */
export interface TierDraft {
  slug: string;
  name: string;
  isOfficial: boolean;
}

export const DEFAULT_LADDER = {
  rank_names: DEFAULT_RANK_NAMES,
  rank_colors: DEFAULT_RANK_COLORS,
};

/**
 * The url segment for a tier name.
 *
 * Lower-cased, anything that is not a letter or digit becomes a hyphen, and
 * runs of hyphens collapse. "Elite (Unofficial)" becomes "elite-unofficial".
 *
 * This is what makes `/benchmarks/<id>/<slug>` unambiguous: two tiers cannot
 * normalise to the same slug, because sanitizeTiers drops the second one. The
 * display name keeps its punctuation — only the address is slugified.
 */
export function slugifyTierName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TIER_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug;
}

/**
 * Normalises the tier list a form submits.
 *
 * - Drops anything without a usable name.
 * - Slugifies, and drops a tier whose slug collides with one already taken, so
 *   two tiers can never answer to the same url.
 * - Caps at MAX_TIERS.
 *
 * Returns an empty array for a bad input rather than throwing: a form that
 * sends nonsense should produce a benchmark with no tiers and a visible
 * warning, not a 500 on the create page.
 */
export function sanitizeTiers(input: unknown): TierDraft[] {
  if (!Array.isArray(input)) return [];

  const tiers: TierDraft[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const record = item as { name?: unknown; slug?: unknown; isOfficial?: unknown };

    const name =
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim().slice(0, MAX_TIER_NAME_LENGTH)
        : "";

    if (!name) continue;

    // A supplied slug is honoured if it is usable, so a rename that only
    // changes the capitalisation keeps its address.
    const supplied =
      typeof record.slug === "string" ? slugifyTierName(record.slug) : "";

    const slug = supplied || slugifyTierName(name);

    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    tiers.push({
      slug,
      name,
      isOfficial: record.isOfficial !== false,
    });

    if (tiers.length >= MAX_TIERS) break;
  }

  return tiers;
}

/**
 * A validated, index-aligned rank ladder for one tier.
 *
 * Names must be non-empty and distinct, colours must be hex, and the two
 * arrays are the same length — a colour ladder shorter than the name ladder
 * leaves trailing ranks with no colour of their own, which the table renders
 * as whatever the fallback happens to be.
 */
export function sanitizeLadder(
  names: unknown,
  colors: unknown
): { rank_names: string[]; rank_colors: string[] } {
  const nameList = Array.isArray(names) ? names : [];
  const colorList = Array.isArray(colors) ? colors : [];

  const rank_names: string[] = [];
  const rank_colors: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < nameList.length && rank_names.length < MAX_RANKS_PER_TIER; index++) {
    const raw = nameList[index];
    const name = typeof raw === "string" ? raw.trim().slice(0, 40) : "";

    if (!name) continue;

    // Cutoffs are keyed by rank name, so two ranks cannot share one — the
    // second would write its cutoffs over the first's.
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    rank_names.push(name);
    rank_colors.push(
      typeof colorList[index] === "string" && /^#[0-9a-f]{3,8}$/i.test(colorList[index].trim())
        ? (colorList[index] as string).trim()
        : DEFAULT_RANK_COLORS[index % DEFAULT_RANK_COLORS.length]
    );
  }

  if (rank_names.length === 0) {
    return { rank_names: [...DEFAULT_RANK_NAMES], rank_colors: [...DEFAULT_RANK_COLORS] };
  }

  return { rank_names, rank_colors };
}

/** Tiers in switcher order: by position, then by name for a stable tie. */
export function orderTiers<T extends { position: number; name: string }>(tiers: T[]): T[] {
  return [...tiers].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name)
  );
}

/** The tier a bare `/benchmarks/[id]` should show. */
export function primaryTier(tiers: Tier[]): Tier | null {
  return orderTiers(tiers)[0] ?? null;
}

/** A scenario row carrying the two columns needed to scope it to a tier. */
export interface TierScopedScenario {
  benchmark_id: string;
  tier_id: string | null;
}

/**
 * The ids of each benchmark's first tier.
 *
 * Scenarios belong to a tier, so a benchmark with three tiers has three times
 * the rows. Summing them all into one aggregate would add a player's Novice
 * score to their Elite score and call the total neither — the card, the
 * leaderboard and the benchmark's own rank all describe the first tier until
 * one of them grows a tier picker of its own.
 *
 * Tiers with no rows at all are skipped: `has("b")` returning false means
 * "fall back to everything", which is what a database that has not had the
 * tier block run needs.
 */
export function primaryTierIds(tiers: TierRef[]): Set<string> {
  const first = new Map<string, TierRef>();

  for (const tier of tiers) {
    const held = first.get(tier.benchmark_id);
    const current = orderTiers([held ?? tier, tier])[0];
    // orderTiers puts the earlier position first; when they tie it falls back
    // to the name, so two tiers inserted in the same statement still get one
    // deterministic winner.
    if (!held || current.id === tier.id) {
      first.set(tier.benchmark_id, tier);
    }
  }

  return new Set(Array.from(first.values()).map((tier) => tier.id));
}

/**
 * Narrows a flat scenario list to each benchmark's primary tier.
 *
 * Pure and tested, because getting it wrong is silent: a benchmark whose tiers
 * share scenarios shows a score roughly double the real one, and no error is
 * raised anywhere.
 */
export function scenariosInPrimaryTiers<T extends TierScopedScenario>(
  scenarios: T[],
  primaryIds: Set<string>
): T[] {
  if (primaryIds.size === 0) return scenarios;

  return scenarios.filter(
    (scenario) =>
      scenario.tier_id === null || primaryIds.has(scenario.tier_id)
  );
}

/** The address one tier lives at. */
export function tierHref(benchmarkId: string, slug: string): string {
  return `/benchmarks/${benchmarkId}/${slug}`;
}

/**
 * The pill label, matching the reference: an unofficial tier is marked in the
 * name itself rather than by a badge beside it, so the switcher stays a single
 * row of words at any width.
 */
export function tierLabel(tier: Pick<Tier, "name" | "is_official">): string {
  return tier.is_official ? tier.name : `${tier.name} (Unofficial)`;
}
