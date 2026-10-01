import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_TIERS,
  PRIMARY_SLUG,
  sanitizeLadder,
  sanitizeTiers,
  slugifyTierName,
  orderTiers,
  primaryTier,
  primaryTierIds,
  scenariosInPrimaryTiers,
  tierLabel,
  type Tier,
} from "./benchmarkTiers.ts";

/**
 * The rules that decide what a tier is.
 *
 * These four are load-bearing in a way that is easy to miss:
 *
 *   - the slug decides the url, so two tiers normalising to one slug would
 *     make /benchmarks/<id>/<slug> ambiguous;
 *   - a ladder's names are the keys its cutoffs are filed under, so two ranks
 *     sharing a name means one silently overwrites the other;
 *   - a tier count with no ceiling turns the header into an unusable menu.
 *
 * Run with:  npm test
 */

test("a tier name becomes a usable url segment", () => {
  assert.equal(slugifyTierName("Novice"), "novice");
  assert.equal(slugifyTierName("Intermediate"), "intermediate");
  assert.equal(slugifyTierName("Advanced"), "advanced");

  // The reference uses "Elite (Unofficial)" as a tier name, and the space and
  // brackets have to survive as a hyphen rather than blow up the route.
  assert.equal(slugifyTierName("Elite (Unofficial)"), "elite-unofficial");
});

test("slugifying collapses punctuation instead of dropping it", () => {
  assert.equal(slugifyTierName("  Hard   Mode!! "), "hard-mode");
  assert.equal(slugifyTierName("A/B Testing"), "a-b-testing");
  assert.equal(slugifyTierName("--edges--"), "edges");
});

test("a name with nothing sluggable in it has no slug", () => {
  assert.equal(slugifyTierName("!!!"), "");
  assert.equal(slugifyTierName("   "), "");
});

test("a slug never ends in a hyphen, however long the name", () => {
  const long = `${"x".repeat(MAX_TIERS * 12)} tail`;

  const slug = slugifyTierName(long);

  assert.equal(slug.endsWith("-"), false);
  assert.ok(slug.length <= 48);
});

test("tiers keep the name the author typed and slugify only the address", () => {
  const [tier] = sanitizeTiers([{ name: "Elite (Unofficial)" }]);

  assert.equal(tier.name, "Elite (Unofficial)", "punctuation stays on screen");
  assert.equal(tier.slug, "elite-unofficial", "punctuation does not stay in the url");
});

test("two tiers that slugify the same cannot both exist", () => {
  // Without this, /benchmarks/<id>/elite-unofficial answers to two different
  // ladders depending on which row the query happened to return first.
  const tiers = sanitizeTiers([
    { name: "Elite (Unofficial)" },
    { name: "Elite  Unofficial!" },
    { name: "Novice" },
  ]);

  assert.deepEqual(
    tiers.map((t) => t.slug),
    ["elite-unofficial", "novice"]
  );
});

test("tiers are capped at six", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ name: `Tier ${i + 1}` }));

  assert.equal(sanitizeTiers(many).length, MAX_TIERS);
  assert.equal(MAX_TIERS, 6, "six is the documented ceiling");
});

test("a tier with no name is dropped", () => {
  const tiers = sanitizeTiers([
    { name: "" },
    { name: "   " },
    { name: 42 },
    {},
    null,
    "Novice",
    { name: "Novice" },
  ]);

  assert.deepEqual(
    tiers.map((t) => t.slug),
    ["novice"]
  );
});

test("a rename that only changes capitalisation keeps its address", () => {
  // The form sends the existing slug back so that typing over "Novice" with
  // "NOVICE" does not orphan the tier's url.
  const [tier] = sanitizeTiers([{ name: "NOVICE", slug: "novice" }]);

  assert.equal(tier.slug, "novice");
  assert.equal(tier.name, "NOVICE");
});

test("a tier is official unless it says otherwise", () => {
  const [defaulted, flagged] = sanitizeTiers([
    { name: "Novice" },
    { name: "Elite", isOfficial: false },
  ]);

  assert.equal(defaulted.isOfficial, true);
  assert.equal(flagged.isOfficial, false);
});

test("bad input yields no tiers rather than throwing", () => {
  assert.deepEqual(sanitizeTiers(undefined), []);
  assert.deepEqual(sanitizeTiers("nope"), []);
  assert.deepEqual(sanitizeTiers(42), []);
});

test("an unofficial tier is labelled as one", () => {
  assert.equal(tierLabel({ name: "Novice", is_official: true }), "Novice");
  assert.equal(
    tierLabel({ name: "Elite", is_official: false }),
    "Elite (Unofficial)",
    "matches the reference switcher"
  );
});

// ------------------------------------------------------------------ ladder

test("a ladder keeps its names and colours index-aligned", () => {
  const ladder = sanitizeLadder(["Iron", "Bronze", "Gold"], ["#a1b2c3", "#d4af37", "#ffffff"]);

  assert.deepEqual(ladder.rank_names, ["Iron", "Bronze", "Gold"]);
  assert.deepEqual(ladder.rank_colors, ["#a1b2c3", "#d4af37", "#ffffff"]);
});

test("two ranks cannot share a name", () => {
  // Cutoffs are filed under the rank name. Two ranks called "Gold" would mean
  // one set of cutoffs quietly overwrote the other, and only one of the two
  // columns would ever be reachable.
  const ladder = sanitizeLadder(["Iron", "Gold", "Gold", "Bronze"], []);

  assert.deepEqual(ladder.rank_names, ["Iron", "Gold", "Bronze"]);
});

test("a rank name differing only in case still collides", () => {
  const ladder = sanitizeLadder(["Gold", "gold"], []);

  assert.deepEqual(ladder.rank_names, ["Gold"]);
});

test("a missing or malformed colour falls back rather than shifting the ladder", () => {
  const ladder = sanitizeLadder(["A", "B", "C"], ["#ffffff", "not-a-colour", undefined]);

  assert.deepEqual(ladder.rank_names, ["A", "B", "C"], "no rank was dropped");
  assert.equal(ladder.rank_colors[0], "#ffffff");
  assert.match(ladder.rank_colors[1], /^#[0-9a-f]{3,8}$/i);
  assert.match(ladder.rank_colors[2], /^#[0-9a-f]{3,8}$/i);
});

test("a colour of the wrong length is rejected", () => {
  const ladder = sanitizeLadder(["A", "B"], ["#ff", "#zzzzzz"]);

  assert.match(ladder.rank_colors[0], /^#[0-9a-f]{3,8}$/i);
  assert.match(ladder.rank_colors[1], /^#[0-9a-f]{3,8}$/i);
});

test("an empty ladder falls back to the default rather than rendering nothing", () => {
  const ladder = sanitizeLadder([], []);

  assert.ok(ladder.rank_names.length > 0, "a tier always has a ladder to draw");
  assert.equal(ladder.rank_names.length, ladder.rank_colors.length);
});

test("blank rank names are dropped without leaving a gap", () => {
  const ladder = sanitizeLadder(["Iron", "", "  ", "Gold"], []);

  assert.deepEqual(ladder.rank_names, ["Iron", "Gold"]);
});

test("a ladder is capped", () => {
  const ladder = sanitizeLadder(
    Array.from({ length: 30 }, (_, i) => `Rank ${i + 1}`),
    []
  );

  assert.ok(ladder.rank_names.length <= 12);
});

// ------------------------------------------------------------------ order

test("tiers come back in switcher order", () => {
  const ordered = orderTiers([
    { position: 2, name: "Advanced" },
    { position: 0, name: "Standard" },
    { position: 1, name: "Novice" },
  ]);

  assert.deepEqual(
    ordered.map((t) => t.name),
    ["Standard", "Novice", "Advanced"]
  );
});

test("two tiers at the same position order by name, so the switcher is stable", () => {
  const ordered = orderTiers([
    { position: 0, name: "Beta" },
    { position: 0, name: "Alpha" },
  ]);

  assert.deepEqual(
    ordered.map((t) => t.name),
    ["Alpha", "Beta"]
  );
});

test("a benchmark with no tiers has no primary", () => {
  assert.equal(primaryTier([]), null);
});

// ------------------------------------------------- primary-tier scoping

test("only the first tier's scenarios count towards a benchmark", () => {
  // The bug this prevents: scenarios belong to a tier, so a benchmark with
  // three tiers has three times the rows. Summing them all added a player's
  // Novice score to their Elite score and called the total neither — a card
  // and a leaderboard row both wrong, silently.
  const tiers = [
    { id: "t-novice", benchmark_id: "b1", slug: "novice", position: 0, name: "Novice" },
    { id: "t-elite", benchmark_id: "b1", slug: "elite", position: 1, name: "Elite" },
  ];

  const scenarios = [
    { benchmark_id: "b1", tier_id: "t-novice" },
    { benchmark_id: "b1", tier_id: "t-elite" },
    { benchmark_id: "b1", tier_id: "t-elite" },
  ];

  const kept = scenariosInPrimaryTiers(scenarios, primaryTierIds(tiers));

  assert.equal(kept.length, 1);
  assert.equal(kept[0].tier_id, "t-novice");
});

test("each benchmark gets its own primary tier", () => {
  const ids = primaryTierIds([
    { id: "t-a", benchmark_id: "b1", slug: "a", position: 0, name: "A" },
    { id: "t-b", benchmark_id: "b1", slug: "b", position: 1, name: "B" },
    { id: "t-c", benchmark_id: "b2", slug: "c", position: 0, name: "C" },
    { id: "t-d", benchmark_id: "b2", slug: "d", position: 1, name: "D" },
  ]);

  assert.deepEqual([...ids].sort(), ["t-a", "t-c"]);
});

test("tier order, not array order, decides which is primary", () => {
  const ids = primaryTierIds([
    { id: "second", benchmark_id: "b1", slug: "s", position: 1, name: "Second" },
    { id: "first", benchmark_id: "b1", slug: "f", position: 0, name: "First" },
  ]);

  assert.deepEqual([...ids], ["first"]);
});

test("scenarios with no tier are kept, not dropped", () => {
  // A database that has not had the tier block run still has rows. Dropping
  // them would empty every card rather than showing one honest one.
  const kept = scenariosInPrimaryTiers(
    [{ benchmark_id: "b1", tier_id: null }],
    new Set(["some-other-tier"])
  );

  assert.equal(kept.length, 1);
});

test("with no tiers at all, every scenario is kept", () => {
  const scenarios = [{ benchmark_id: "b1", tier_id: "x" }];

  assert.equal(scenariosInPrimaryTiers(scenarios, new Set()).length, 1);
});

test("the primary tier is the first one in switcher order", () => {
  const stub = (over: Partial<Tier>): Tier => ({
    id: "t1",
    benchmark_id: "b",
    slug: "primary",
    name: "Standard",
    position: 0,
    rank_names: [],
    rank_colors: [],
    is_official: true,
    ...over,
  });

  const primary = primaryTier([
    stub({ id: "t2", name: "Elite", slug: "elite", position: 3 }),
    stub({ id: "t3", slug: PRIMARY_SLUG, position: 0 }),
  ]);

  assert.equal(primary?.slug, "primary");
});
