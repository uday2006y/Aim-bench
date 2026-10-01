/**
 * Per-scenario sequential tier gating.
 *
 * The rule, in the terms the author used: a scenario with a best of 780, whose
 * tier-1 final rank requires 860, does not track in tier 2. Past 860 it does.
 * Per scenario, never per tier.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeTrackedScenarios,
  finalRankCutoff,
  isScenarioTracked,
  scenarioGate,
  type GateScenario,
  type GateTier,
} from "./tierGates.ts";

/** Novice: Iron 640, Bronze 700, Silver 780, Gold 860. */
const CUTOFFS = { Iron: 640, Bronze: 700, Silver: 780, Gold: 860 };

function tier(slug: string, position: number): GateTier {
  return {
    id: slug,
    slug,
    position,
    name: slug,
    rank_names: ["Iron", "Bronze", "Silver", "Gold"],
  };
}

const NOVICE = tier("novice", 0);
const INTERMEDIATE = tier("intermediate", 1);

function scenario(
  id: string,
  pb: number | null,
  cutoffs: Record<string, number> = CUTOFFS
): GateScenario {
  return { easyaim_scenario_id: id, cutoffs, pb };
}

// ---------------------------------------------------------- final rank

test("the final rank cutoff is the top rung the scenario states", () => {
  assert.equal(finalRankCutoff(NOVICE.rank_names, CUTOFFS), 860);
});

test("an unstated top rank is skipped, not treated as a gate", () => {
  // Gold says nothing, so Silver is the rung that actually gates.
  const partial = { Iron: 640, Bronze: 700, Silver: 780 };
  assert.equal(finalRankCutoff(NOVICE.rank_names, partial), 780);
});

test("a scenario stating nothing is not gated", () => {
  assert.equal(finalRankCutoff(NOVICE.rank_names, {}), null);
});

test("a zero cutoff is not a requirement", () => {
  assert.equal(finalRankCutoff(NOVICE.rank_names, { Iron: 0, Gold: 0 }), null);
});

// ------------------------------------------------------------- the example

test("780 does not track in tier 2 while tier 1's final rank is 860", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 780)]],
    ["intermediate", [scenario("mira", 780)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE], byTier);

  assert.equal(isScenarioTracked(tracked, "intermediate", "mira"), false);
});

test("past 860 it starts tracking in tier 2", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 900)]],
    ["intermediate", [scenario("mira", 900)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE], byTier);

  assert.equal(isScenarioTracked(tracked, "intermediate", "mira"), true);
});

test("exactly 860 is enough", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 860)]],
    ["intermediate", [scenario("mira", 860)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isScenarioTracked(tracked, "intermediate", "mira"), true);
});

test("859 is not enough", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 859)]],
    ["intermediate", [scenario("mira", 859)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isScenarioTracked(tracked, "intermediate", "mira"), false);
});

// ------------------------------------------------------ the first tier

test("the first tier always tracks", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 0)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE], byTier);
  assert.equal(isScenarioTracked(tracked, "novice", "mira"), true);
});

// ------------------------------------------- per scenario, NOT per tier

test("one finished row does not unlock the others", () => {
  // The whole point. "mira" has passed Gold, "little" has not. Only "mira"
  // tracks in tier 2 -- gating the tier as a whole was the earlier, wrong rule.
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 900), scenario("little", 780)]],
    ["intermediate", [scenario("mira", 900), scenario("little", 780)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE], byTier);

  assert.equal(isScenarioTracked(tracked, "intermediate", "mira"), true);
  assert.equal(isScenarioTracked(tracked, "intermediate", "little"), false);
});

test("one unfinished row does not freeze the whole tier", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("a", 0)]],
    ["intermediate", [scenario("a", 0), scenario("b", 900)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE], byTier);

  assert.equal(isScenarioTracked(tracked, "intermediate", "a"), false);
  // "b" is not in Novice at all, so nothing was asked of it there.
  assert.equal(isScenarioTracked(tracked, "intermediate", "b"), true);
});

// ------------------------------------------------------------ edge cases

test("a scenario with no best does not track past the gate", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", null)]],
    ["intermediate", [scenario("mira", null)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isScenarioTracked(tracked, "intermediate", "mira"), false);
});

test("a scenario the previous tier never stated tracks, rather than freezing", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("other", 0)]],
    ["intermediate", [scenario("fresh", 0)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isScenarioTracked(tracked, "intermediate", "fresh"), true);
});

test("a previous tier that states no requirement for this scenario does not gate it", () => {
  // Novice has the scenario but set no cutoff on it, so there is nothing to
  // have passed. A gate that can never be satisfied would freeze the row with
  // nothing the author could fix.
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 0, {})]],
    ["intermediate", [scenario("mira", 0)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isScenarioTracked(tracked, "intermediate", "mira"), true);
});

test("gating follows position order, not array order", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 900)]],
    ["intermediate", [scenario("mira", 0)]],
  ]);
  const tracked = computeTrackedScenarios([INTERMEDIATE, NOVICE], byTier);
  // Novice is first by position, so it gates Intermediate.
  assert.equal(isScenarioTracked(tracked, "intermediate", "mira"), false);
});

test("three tiers chain: each is gated by the one before it", () => {
  const ELITE = tier("elite", 2);
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 900)]],
    // Intermediate's own final rank for this scenario is 860 too.
    ["intermediate", [scenario("mira", 900)]],
    ["elite", [scenario("mira", 900)]],
  ]);
  const tracked = computeTrackedScenarios([NOVICE, INTERMEDIATE, ELITE], byTier);

  assert.equal(isScenarioTracked(tracked, "novice", "mira"), true);
  assert.equal(isScenarioTracked(tracked, "intermediate", "mira"), true);
  assert.equal(isScenarioTracked(tracked, "elite", "mira"), true);
});

test("an unknown tier is not treated as tracking", () => {
  const tracked = computeTrackedScenarios([NOVICE], new Map());
  assert.equal(isScenarioTracked(tracked, "nope", "mira"), false);
});

test("no gating supplied means track, so callers stay backwards compatible", () => {
  assert.equal(isScenarioTracked(undefined, "intermediate", "mira"), true);
});

// ------------------------------------------------------------ gate readout

test("scenarioGate reports the cutoff the row is waiting on", () => {
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [scenario("mira", 780)]],
    ["intermediate", [scenario("mira", 780)]],
  ]);
  assert.equal(scenarioGate([NOVICE, INTERMEDIATE], byTier, "intermediate", "mira"), 860);
});

test("scenarioGate is null in the first tier, which has nothing to wait for", () => {
  const byTier = new Map<string, GateScenario[]>([["novice", [scenario("mira", 780)]]]);
  assert.equal(scenarioGate([NOVICE], byTier, "novice", "mira"), null);
});