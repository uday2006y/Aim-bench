import { test } from "node:test";
import assert from "node:assert/strict";

import { computeTierFills } from "./tierBars.ts";

/**
 * The tier bar fill rule.
 *
 * Extracted and tested after shipping wrong once: dividing the score by
 * each cutoff made every cleared tier read 100%-plus and left the top tier
 * at 60% for a player nowhere near it.
 *
 * The ladder and score throughout are the real ones from the "sih"
 * benchmark — Bronze 650 through Champion 1,694, scored 1,020.141 — so a
 * regression shows up as a number someone would actually see.
 *
 * Run with:  npm test
 */

const SIH = [650, 750, 850, 950, 1050, 1694];
const NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Champion"];

function percents(cutoffs: (number | null)[], score: number): number[] {
  return computeTierFills(cutoffs, score).map((f) => f.percent);
}

test("a cleared tier is full and the tier above shows real progress", () => {
  // The reported case.
  assert.deepEqual(percents(SIH, 1020.141), [100, 100, 100, 100, 70, 0]);
});

test("the top tier is empty until the tier below it is cleared", () => {
  // 1,020.141 is 674 short of Champion, so that bar must not read as
  // mostly-done the way score/cutoff made it (60%).
  const [, , , , , champion] = percents(SIH, 1020.141);
  assert.equal(champion, 0);
});

test("progress is measured across the gap, not from zero", () => {
  // Halfway between Platinum (950) and Diamond (1,050).
  assert.equal(percents(SIH, 1000)[4], 50);
  // One point short of Diamond.
  assert.equal(percents(SIH, 1049)[4], 99);
  // Exactly Diamond.
  assert.equal(percents(SIH, 1050)[4], 100);
});

test("clearing a tier starts the next one from empty", () => {
  const out = percents(SIH, 1050);
  assert.equal(out[4], 100, "Diamond is exactly met");
  assert.equal(out[5], 0, "Champion has not been started yet");
});

test("the whole ladder fills once the top rank is cleared", () => {
  assert.deepEqual(percents(SIH, 1800), [100, 100, 100, 100, 100, 100]);
});

test("a score above every cutoff never overflows a bar", () => {
  for (const percent of percents(SIH, 999999)) {
    assert.ok(percent <= 100, `bar overflowed to ${percent}%`);
  }
});

test("no score means no fill anywhere", () => {
  assert.deepEqual(percents(SIH, 0), [0, 0, 0, 0, 0, 0]);
});

test("a tier with no cutoff is skipped, and is not a baseline for the next", () => {
  // Diamond has no cutoff. Champion must measure from Platinum, not from a
  // missing Diamond that would otherwise read as zero and make Champion's
  // whole bar look empty.
  const out = percents([650, 750, 850, 950, null, 1694], 1000);

  assert.equal(out[4], 0, "the tier with no cutoff draws nothing");

  const [, , , , , champion] = computeTierFills(
    [650, 750, 850, 950, null, 1694],
    1000
  );
  assert.equal(champion.floor, 950, "measured up from Platinum");
  assert.equal(champion.percent, Math.round(((1000 - 950) / (1694 - 950)) * 100));
});

test("the first scorable tier measures from zero", () => {
  const [first] = computeTierFills(SIH, 325);
  assert.equal(first.floor, 0);
  assert.equal(first.percent, 50, "halfway to 650");
});

test("non-positive and absent cutoffs are both treated as absent", () => {
  assert.deepEqual(percents([650, 0, 850], 900), [100, 0, 100]);
  assert.deepEqual(percents([650, null, 850], 900), [100, 0, 100]);
});

test("a single-tier ladder is all or nothing", () => {
  assert.deepEqual(percents([1000], 1000), [100]);
  assert.deepEqual(percents([1000], 999), [100]);
  assert.deepEqual(percents([1000], 10), [1]);
});

test("cutoffs that do not ascend still produce a sane bar", () => {
  // Misconfigured ladder: the gap below is zero, so the tier cannot be
  // measured and must not divide by zero.
  const out = percents([1000, 1000, 2000], 1500);
  assert.equal(out[0], 100);
  assert.equal(out[1], 0, "degenerate gap, nothing to fill");
  assert.equal(out[2], 50);
});

test("every percentage is a whole number in range", () => {
  for (const score of [0, 1, 324, 649, 651, 949, 951, 1020.141, 1693, 1694, 5000]) {
    for (const [i, percent] of percents(SIH, score).entries()) {
      assert.ok(
        Number.isInteger(percent) && percent >= 0 && percent <= 100,
        `${NAMES[i]} at score ${score} produced ${percent}`
      );
    }
  }
});
