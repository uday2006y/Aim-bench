/**
 * Sequential tiers: a tier only starts tracking once the tier before it is
 * finished.
 *
 * Tiers are ordered by position (Novice, then Intermediate, then Elite). A
 * player works them in order, so a later tier showing a half-filled bar before
 * the earlier one is complete is not information -- it is a score earned out
 * of order against requirements they have not reached yet.
 *
 * The rule, stated once so every caller agrees:
 *
 *   A tier is UNLOCKED when every tier before it is COMPLETE. The first tier is
 *   always unlocked. Once a tier is unlocked it stays unlocked, so dropping
 *   back to Novice does not re-lock Intermediate.
 *
 * "Complete" means the viewer has reached the top rank that actually has
 * cutoffs on at least one scenario -- the same meaning `maxed` carries in
 * computeAggregates. A rank with no cutoffs anywhere is skipped rather than
 * auto-passed, so a tier whose top rung has no requirements can never be
 * completed and would lock everything after it. That is a configuration
 * problem the author can fix by setting a cutoff, and it must not silently
 * hide every later tier forever; `lockReason` says so in words.
 *
 * Pure and tested, like aggregates and tierBars: this decides whether a page
 * shows a score, and a second copy of the rule is how the tier ladder drifted
 * twice already.
 */

export interface GateTier {
  id: string;
  slug: string;
  position: number;
  name: string;
  rank_names: string[];
}

export interface GateScenario {
  cutoffs: Record<string, number> | null;
  /** The viewer's personal best on this scenario, or null if unplayed. */
  pb: number | null;
}

export interface TierUnlock {
  slug: string;
  unlocked: boolean;
  /**
   * Why it is locked, in words, so the page can say something better than an
   * empty table. Null when unlocked.
   */
  lockReason: string | null;
  /** The tier that must be finished first, when one exists. */
  blockedBySlug: string | null;
}

/** Whether a cutoff states a real requirement. Mirrors aggregates.ts. */
function statesRequirement(cutoffs: Record<string, number> | null, rank: string): boolean {
  const needed = cutoffs?.[rank];
  return typeof needed === "number" && needed > 0;
}

/**
 * Has the viewer cleared this tier's top rank?
 *
 * The top rank is the last one in the ladder that any scenario actually
 * requires. A rank nothing requires is skipped rather than granted, matching
 * computeAggregates: otherwise a player who opened the page would be handed
 * the top rank for free.
 */
export function isTierComplete(
  rankNames: string[],
  scenarios: GateScenario[]
): boolean {
  if (scenarios.length === 0) return false;

  const scorable = rankNames.filter((rank) =>
    scenarios.some((scenario) => statesRequirement(scenario.cutoffs, rank))
  );

  if (scorable.length === 0) return false;

  const topRank = scorable[scorable.length - 1];

  return scenarios.every((scenario) => {
    if (!statesRequirement(scenario.cutoffs, topRank)) return true;
    return (scenario.pb ?? 0) >= (scenario.cutoffs?.[topRank] as number);
  });
}

/**
 * Whether this tier states any requirement at all.
 *
 * False is the real deadlock: with no rank required anywhere, `isTierComplete`
 * has no scorable rank to test against and returns false forever, so every
 * tier behind this one stays locked with no way to earn them. An author who
 * filled in the rank names but no cutoffs produces exactly this.
 *
 * Note that a tier missing only its TOP rank is NOT deadlocked: the unstated
 * top rank is skipped, and the tier completes at the highest rank that does
 * carry a requirement.
 */
function tierStatesAnyRequirement(
  rankNames: string[],
  scenarios: GateScenario[]
): boolean {
  return rankNames.some((rank) =>
    scenarios.some((scenario) => statesRequirement(scenario.cutoffs, rank))
  );
}

/**
 * Per-tier unlock state, in tier order.
 *
 * `scenariosByTierSlug` supplies each tier's own scenarios; a tier with no
 * entry is treated as unplayed, which locks it and everything after.
 */
export function computeTierUnlocks(
  tiers: GateTier[],
  scenariosByTierSlug: Map<string, GateScenario[]>
): TierUnlock[] {
  const ordered = [...tiers].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name)
  );

  const result: TierUnlock[] = [];
  // Latches: once unlocked, a tier stays unlocked.
  let blockedBy: GateTier | null = null;
  // A Set, not an array: identity comparison is what we want and `includes`
  // on an array of objects compares references, which is fragile to copy.
  const unreachable = new Set<GateTier>();

  for (const tier of ordered) {
    const scenarios = scenariosByTierSlug.get(tier.slug) ?? [];
    const complete = isTierComplete(tier.rank_names, scenarios);
    const statesAnything = tierStatesAnyRequirement(tier.rank_names, scenarios);

    if (blockedBy) {
      // The tier we are waiting on may be one that can never be finished.
      // Say the real cause instead of "finish X" forever.
      const reason = unreachable.has(blockedBy)
        ? `${blockedBy.name} cannot be completed because no score requirement is set on it. Add one on the edit page to unlock this tier.`
        : `Finish ${blockedBy.name} to start tracking this tier.`;

      result.push({
        slug: tier.slug,
        unlocked: false,
        lockReason: reason,
        blockedBySlug: blockedBy.slug,
      });
      continue;
    }

    if (complete) {
      result.push({ slug: tier.slug, unlocked: true, lockReason: null, blockedBySlug: null });
      continue;
    }

    // Incomplete, so this tier is the gate for everything after it.
    blockedBy = tier;
    result.push({ slug: tier.slug, unlocked: true, lockReason: null, blockedBySlug: null });

    if (!statesAnything) {
      // Deadlocked as authored; remember it so the tiers behind it explain the
      // real cause instead of "finish Novice" forever.
      unreachable.add(tier);
    }
  }

  return result;
}

/** Convenience: is one slug unlocked? */
export function isTierUnlocked(unlocks: TierUnlock[], slug: string): boolean {
  return unlocks.find((u) => u.slug === slug)?.unlocked ?? false;
}