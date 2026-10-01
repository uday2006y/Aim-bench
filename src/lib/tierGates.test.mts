/**
 * Sequential tier unlocking.
 *
 * The rule under test: a tier starts tracking only once every tier before it
 * is complete, and unlocking latches so going back does not re-lock.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeTierUnlocks,
  isTierComplete,
  isTierUnlocked,
  type GateScenario,
  type GateTier,
} from "./tierGates.ts";

/** A tier whose ladder is Iron -> Gold. `name` is the display name. */
function tier(slug: string, position: number, rankNames?: string[]): GateTier {
  return {
    id: slug,
    slug,
    position,
    // Display name, as an author would type it. The slug is the url segment.
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    rank_names: rankNames ?? ["Iron", "Gold"],
  };
}

/** One scenario requiring `req` for the top rank. */
function scenario(req: number, pb: number | null): GateScenario {
  return {
    cutoffs: { Iron: req / 2, Gold: req },
    pb,
  };
}

const NOVICE = tier("novice", 0);
const INTERMEDIATE = tier("intermediate", 1);
const ELITE = tier("elite", 2);

// ------------------------------------------------------------ completeness

test("a tier with no scenarios is not complete", () => {
  assert.equal(isTierComplete(NOVICE.rank_names, []), false);
});

test("clearing the top rank on every scenario completes the tier", () => {
  assert.equal(isTierComplete(NOVICE.rank_names, [scenario(200, 250)]), true);
});

test("missing the top rank on any scenario leaves it incomplete", () => {
  assert.equal(isTierComplete(NOVICE.rank_names, [scenario(200, 250), scenario(200, 100)]), false);
});

test("an unplayed scenario counts as zero, not as a pass", () => {
  assert.equal(isTierComplete(NOVICE.rank_names, [scenario(200, 250), scenario(200, null)]), false);
});

test("a rank nothing requires is skipped rather than granted", () => {
  // Only Iron is specified. Someone at 999 clears it, but the ladder's real
  // ceiling is Iron because nothing states a requirement for Gold.
  const onlyIron: GateScenario[] = [{ cutoffs: { Iron: 100 }, pb: 999 }];
  assert.equal(isTierComplete(NOVICE.rank_names, onlyIron), true);
});

test("a scenario stating nothing for the top rank does not block completion", () => {
  const mixed: GateScenario[] = [
    { cutoffs: { Iron: 100, Gold: 200 }, pb: 250 },
    { cutoffs: { Iron: 100 }, pb: 250 },
  ];
  assert.equal(isTierComplete(NOVICE.rank_names, mixed), true);
});

// ------------------------------------------------------------------ gating

test("the first tier is always unlocked", () => {
  const out = computeTierUnlocks([NOVICE], new Map([["novice", [scenario(200, 0)]]]));
  assert.equal(isTierUnlocked(out, "novice"), true);
});

test("a later tier is locked while the earlier one is incomplete", () => {
  const byTier = new Map([
    ["novice", [scenario(200, 150)]], // short of Gold (200)
    ["intermediate", [scenario(200, 250)]],
  ]);
  const out = computeTierUnlocks([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isTierUnlocked(out, "novice"), true);
  assert.equal(isTierUnlocked(out, "intermediate"), false);
});

test("completing the earlier tier unlocks the next one", () => {
  const byTier = new Map([
    ["novice", [scenario(200, 250)]],
    ["intermediate", [scenario(200, 0)]],
  ]);
  const out = computeTierUnlocks([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isTierUnlocked(out, "intermediate"), true);
});

test("locking cascades through every later tier", () => {
  const byTier = new Map([
    ["novice", [scenario(200, 0)]],
    ["intermediate", [scenario(200, 0)]],
    ["elite", [scenario(200, 0)]],
  ]);
  const out = computeTierUnlocks([NOVICE, INTERMEDIATE, ELITE], byTier);
  assert.equal(isTierUnlocked(out, "novice"), true);
  assert.equal(isTierUnlocked(out, "intermediate"), false);
  assert.equal(isTierUnlocked(out, "elite"), false);
});

test("unlocking latches: the gate stays unlocked once earned", () => {
  // Novice complete here, so Intermediate is open even though Intermediate is
  // itself far from complete.
  const byTier = new Map([
    ["novice", [scenario(200, 250)]],
    ["intermediate", [scenario(200, 0)]],
  ]);
  const out = computeTierUnlocks([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isTierUnlocked(out, "intermediate"), true);
});

test("the lock names the tier that has to be finished", () => {
  const byTier = new Map([
    ["novice", [scenario(200, 0)]],
    ["intermediate", [scenario(200, 0)]],
  ]);
  const out = computeTierUnlocks([NOVICE, INTERMEDIATE], byTier);
  const locked = out.find((u) => u.slug === "intermediate");
  assert.equal(locked?.blockedBySlug, "novice");
  assert.match(locked?.lockReason ?? "", /Finish Novice/);
});

test("tiers are gated in position order, not array order", () => {
  // Elite listed first. Position decides, so Novice is still the gate.
  const byTier = new Map([
    ["novice", [scenario(200, 0)]],
    ["elite", [scenario(200, 250)]],
  ]);
  const out = computeTierUnlocks([ELITE, NOVICE], byTier);
  assert.equal(isTierUnlocked(out, "novice"), true);
  assert.equal(isTierUnlocked(out, "elite"), false);
});

test("a tier with no scenarios locks itself and everything after", () => {
  const byTier = new Map<string, GateScenario[]>([["novice", []]]);
  const out = computeTierUnlocks([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isTierUnlocked(out, "intermediate"), false);
});

test("a tier missing only its top rank still completes at a lower rank", () => {
  // Nothing states Gold, so Gold is skipped and Iron becomes the ceiling. This
  // must NOT be treated as a deadlock.
  const byTier = new Map<string, GateScenario[]>([
    ["novice", [{ cutoffs: { Iron: 100 }, pb: 150 }]],
    ["intermediate", [scenario(200, 0)]],
  ]);
  const out = computeTierUnlocks([NOVICE, INTERMEDIATE], byTier);
  assert.equal(isTierUnlocked(out, "intermediate"), true);
});

test("a tier with no requirements at all says why instead of locking forever", () => {
  // Cutoffs empty everywhere: nothing is scorable, so Novice can never be
  // completed and Intermediate must explain the real cause.
  const deadlocked = new Map<string, GateScenario[]>([
    ["novice", [{ cutoffs: {}, pb: 0 }]],
    ["intermediate", [scenario(200, 0)]],
  ]);
  const out = computeTierUnlocks([NOVICE, INTERMEDIATE], deadlocked);
  const locked = out.find((u) => u.slug === "intermediate");
  assert.equal(locked?.unlocked, false);
  assert.match(locked?.lockReason ?? "", /cannot be completed/);
});

test("a tier with no scenarios says why rather than naming itself forever", () => {
  const byTier = new Map<string, GateScenario[]>([["novice", []]]);
  const out = computeTierUnlocks([NOVICE, INTERMEDIATE], byTier);
  const locked = out.find((u) => u.slug === "intermediate");
  assert.match(locked?.lockReason ?? "", /cannot be completed/);
});

test("an unknown slug is treated as locked", () => {
  const out = computeTierUnlocks([NOVICE], new Map());
  assert.equal(isTierUnlocked(out, "nope"), false);
});