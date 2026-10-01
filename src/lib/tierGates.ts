/**
 * Sequential tier gating, per scenario.
 *
 * Tiers are worked in order, and a scenario only begins tracking in the next
 * tier once that SAME scenario has passed the previous tier's final rank.
 *
 * Worked example, which is the whole rule:
 *
 *   A scenario has a best of 780. In tier 1 its final rank, Gold, requires
 *   860. 780 < 860, so this scenario does not track in tier 2 at all. Once the
 *   best passes 860, tier 2 starts tracking it.
 *
 * This is deliberately PER SCENARIO. An earlier version gated whole tiers on
 * every scenario clearing its top rank, which is a different and much harsher
 * rule: one scenario left unfinished would freeze the entire next tier, so a
 * player who had genuinely finished most of tier 1 saw nothing in tier 2 at
 * all. One row's state decides that row.
 *
 * What counts as "the previous tier's final rank" for a scenario is the highest
 * rank in that tier's ladder that THIS scenario actually has a requirement for.
 * A scenario the author left without a cutoff on the top rungs is gated by
 * whichever rung it does state -- grading against a requirement that was never
 * set would lock a row that can never open.
 *
 * No requirement stated at all means no gate: the row tracks. A gate that can
 * never be satisfied is worse than no gate, because the row would be frozen
 * with nothing to fix.
 *
 * Pure and tested, like aggregates and tierBars. This decides whether a row
 * shows a score, and the rank calculation stays in computeAggregates -- this
 * module never computes a rank of its own.
 */

/** A scenario as the gate needs it: which EasyAim scenario, what it requires,
 *  and the viewer's best. */
export interface GateScenario {
  easyaim_scenario_id: string;
  cutoffs: Record<string, number> | null;
  pb: number | null;
}

export interface GateTier {
  id: string;
  slug: string;
  position: number;
  name: string;
  rank_names: string[];
}

function statesRequirement(cutoffs: Record<string, number> | null, rank: string): boolean {
  const needed = cutoffs?.[rank];
  return typeof needed === "number" && needed > 0;
}

/**
 * The cutoff that gates this scenario into the next tier: the highest rank in
 * the ladder that the scenario actually states a requirement for.
 *
 * Null when the scenario states nothing, which means it is not gated.
 */
export function finalRankCutoff(
  rankNames: string[],
  cutoffs: Record<string, number> | null
): number | null {
  for (let i = rankNames.length - 1; i >= 0; i--) {
    if (statesRequirement(cutoffs, rankNames[i])) {
      return cutoffs?.[rankNames[i]] as number;
    }
  }
  return null;
}

/** Tiers in switcher order. Position decides, name breaks ties. */
export function orderGateTiers<T extends { position: number; name: string }>(tiers: T[]): T[] {
  return [...tiers].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/**
 * For each tier, the set of EasyAim scenario ids that are currently tracking.
 *
 * Returns tierSlug -> Set<easyaim_scenario_id>. A tier missing from the result
 * tracks nothing, which is the safe reading: an unknown tier has no gate
 * computed for it.
 */
export function computeTrackedScenarios(
  tiers: GateTier[],
  scenariosByTierSlug: Map<string, GateScenario[]>
): Map<string, Set<string>> {
  const ordered = orderGateTiers(tiers);
  const tracked = new Map<string, Set<string>>();

  // Index every tier's scenarios by EasyAim id so the previous tier can be
  // consulted per row rather than the whole tier being gated at once.
  const byTierId = new Map<string, Map<string, GateScenario>>();
  for (const tier of ordered) {
    const index = new Map<string, GateScenario>();
    for (const scenario of scenariosByTierSlug.get(tier.slug) ?? []) {
      index.set(scenario.easyaim_scenario_id, scenario);
    }
    byTierId.set(tier.id, index);
  }

  for (let i = 0; i < ordered.length; i++) {
    const tier = ordered[i];
    const previous = i > 0 ? ordered[i - 1] : null;
    const previousScenarios = previous ? byTierId.get(previous.id) : null;

    const active = new Set<string>();

    for (const scenario of scenariosByTierSlug.get(tier.slug) ?? []) {
      const id = scenario.easyaim_scenario_id;

      // The first tier has nothing before it, so it always tracks.
      if (!previous || !previousScenarios) {
        active.add(id);
        continue;
      }

      const gate = previousScenarios.get(id);
      if (!gate) {
        // Not in the previous tier: the author asked nothing of it here, so
        // there is no gate to clear.
        active.add(id);
        continue;
      }

      const cutoff = finalRankCutoff(previous.rank_names, gate.cutoffs);

      // No requirement stated for this scenario in the previous tier, so there
      // is nothing to have passed.
      if (cutoff === null) {
        active.add(id);
        continue;
      }

      if ((scenario.pb ?? 0) >= cutoff) {
        active.add(id);
      }
    }

    tracked.set(tier.slug, active);
  }

  return tracked;
}

/** Does this scenario track in this tier? Unknown tiers and ids are not tracking. */
export function isScenarioTracked(
  tracked: Map<string, Set<string>> | undefined,
  tierSlug: string,
  easyaimScenarioId: string
): boolean {
  if (!tracked) return true; // no gating supplied: behave as before
  return tracked.get(tierSlug)?.has(easyaimScenarioId) ?? false;
}

/**
 * The cutoff a scenario is waiting on, for the "locked" hint on a row.
 *
 * Returns the gate value so the page can say what it is waiting for, which is
 * more use than a padlock alone.
 */
export function scenarioGate(
  tiers: GateTier[],
  scenariosByTierSlug: Map<string, GateScenario[]>,
  tierSlug: string,
  easyaimScenarioId: string
): number | null {
  const ordered = orderGateTiers(tiers);
  const index = ordered.findIndex((tier) => tier.slug === tierSlug);

  if (index <= 0) return null;

  const previous = ordered[index - 1];
  const gate = (scenariosByTierSlug.get(previous.slug) ?? []).find(
    (scenario) => scenario.easyaim_scenario_id === easyaimScenarioId
  );

  if (!gate) return null;
  return finalRankCutoff(previous.rank_names, gate.cutoffs);
}