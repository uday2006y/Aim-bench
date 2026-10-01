import { test } from "node:test";
import assert from "node:assert/strict";

import { computeAggregates } from "./aggregates.ts";

/**
 * The rank walk, pinned down.
 *
 * This function has been rewritten four times to fix four separate bugs,
 * each of which shipped before it was caught. Every previous check was a
 * throwaway preview page rendered in a browser and read by eye, which does
 * not survive a refactor and cannot be run by anyone else. This is the same
 * coverage as a real test that runs in one command.
 *
 * Run with:  npm test
 */

const NAMES = ["Bronze", "Silver", "Gold", "Platinum"];
const FULL = { Bronze: 600, Silver: 800, Gold: 1000, Platinum: 1200 };

function ladder(
  rankNames: string[],
  scenarios: { id: number; cutoffs: Record<string, number> | null }[],
  pbs: [string, number][]
) {
  const result = computeAggregates(
    [{ id: "b1", rank_names: rankNames, rank_thresholds: {} }],
    scenarios.map((s) => ({
      benchmark_id: "b1",
      easyaim_scenario_id: String(s.id),
      cutoffs: s.cutoffs,
    })),
    new Map(pbs)
  );

  return result.get("b1")!;
}

test("a score above every cutoff but below the top is not 'complete'", () => {
  // The reported case: 1,012.667 against 600/800/1000/1200.
  const a = ladder(NAMES, [{ id: 2683, cutoffs: FULL }], [["2683", 1012.667]]);

  assert.equal(a.rank, "Gold");
  assert.equal(a.rankIndex, 2);
  assert.equal(a.maxed, false, "Gold is not the top rank, so not complete");
  assert.equal(a.score, 1012.667);
});

test("hitting the top cutoff exactly is complete", () => {
  const a = ladder(NAMES, [{ id: 1, cutoffs: FULL }], [["1", 1200]]);

  assert.equal(a.rank, "Platinum");
  assert.equal(a.maxed, true);
});

test("just missing a cutoff falls to the tier below", () => {
  const a = ladder(NAMES, [{ id: 1, cutoffs: FULL }], [["1", 999]]);

  assert.equal(a.rank, "Silver");
  assert.equal(a.maxed, false);
});

test("no personal best means no rank and no score", () => {
  const a = ladder(NAMES, [{ id: 1, cutoffs: FULL }], []);

  assert.equal(a.rank, null);
  assert.equal(a.rankIndex, null);
  assert.equal(a.score, 0);
  assert.equal(a.maxed, false);
});

test("a rank with no cutoff on any scenario is skipped, not auto-passed", () => {
  // Regression: with no Platinum cutoffs anywhere, Platinum used to
  // auto-pass, handing the top rank to anyone who opened the page.
  const a = ladder(
    NAMES,
    [
      { id: 1, cutoffs: { Bronze: 600, Gold: 1000 } },
      { id: 2, cutoffs: { Bronze: 600, Gold: 1000 } },
    ],
    [["1", 1200], ["2", 1500]]
  );

  assert.equal(a.rank, "Gold", "Platinum is unreachable, so Gold is the ceiling");
  assert.equal(a.maxed, true, "the ceiling is Gold, so Gold is complete");
});

test("a scenario with no cutoff for the tier in question does not count against it", () => {
  const a = ladder(
    NAMES,
    [
      { id: 1, cutoffs: { Bronze: 600, Gold: 1000 } },
      { id: 2, cutoffs: { Bronze: 600 } },
    ],
    [["1", 1500], ["2", 0]]
  );

  assert.equal(a.rank, "Gold", "scenario 2 has no Gold cutoff, so it cannot block Gold");
  assert.equal(a.score, 1500, "but it still contributes its zero to the score");
});

test("every scenario must clear a tier, not just one", () => {
  // The multi-scenario partial clear: one strong scenario must not carry a
  // player into a tier the rest of the benchmark fails.
  const a = ladder(
    NAMES,
    [
      { id: 1, cutoffs: { Bronze: 600, Silver: 800, Gold: 1000 } },
      { id: 2, cutoffs: { Bronze: 600, Silver: 800, Gold: 1000 } },
    ],
    [
      ["1", 1200],
      ["2", 400],
    ]
  );

  assert.equal(a.rank, null, "scenario 2 fails Bronze, so no tier is cleared");
  assert.equal(a.score, 1600, "the score is still the sum");
  assert.equal(a.maxed, false);
});

test("scenarios belonging to other benchmarks are ignored", () => {
  // The list endpoint reads cutoffs for every benchmark in one query, so a
  // foreign scenario leaking in would corrupt an unrelated card.
  const result = computeAggregates(
    [{ id: "b1", rank_names: NAMES, rank_thresholds: {} }],
    [
      { benchmark_id: "b1", easyaim_scenario_id: "1", cutoffs: FULL },
      { benchmark_id: "b2", easyaim_scenario_id: "9", cutoffs: { Bronze: 99999 } },
    ],
    new Map([
      ["1", 700],
      ["9", 5000],
    ])
  );

  assert.equal(result.get("b1")!.rank, "Bronze");
  assert.equal(result.get("b1")!.score, 700, "b2's scenario must not add to b1's score");
  assert.equal(result.has("b2"), false, "b2 was not asked about");
});

test("a benchmark with no scenarios is unplayed, not zero-ranked", () => {
  const a = ladder(NAMES, [], []);

  assert.equal(a.rank, null);
  assert.equal(a.score, 0);
  assert.equal(a.maxed, false);
});

test("rows with only rank_thresholds still produce a ladder", () => {
  const result = computeAggregates(
    [{ id: "b1", rank_names: null, rank_thresholds: { Bronze: 0, Silver: 500, Gold: 1000 } }],
    [
      {
        benchmark_id: "b1",
        easyaim_scenario_id: "1",
        cutoffs: { Bronze: 0, Silver: 500, Gold: 1000 },
      },
    ],
    new Map([["1", 1200]])
  );

  assert.equal(result.get("b1")!.rank, "Gold");
  assert.equal(result.get("b1")!.maxed, true);
});

test("the top rank name is whatever the benchmark calls it", () => {
  // Ranks are renamed by benchmark authors, so nothing may assume the
  // ladder's names.
  const a = ladder(
    ["plank", "askdhajsdhajsgd"],
    [{ id: 1, cutoffs: { plank: 600, askdhajsdhajsgd: 5000 } }],
    [["1", 6000]]
  );

  assert.equal(a.rank, "askdhajsdhajsgd");
  assert.equal(a.maxed, true, "the ceiling is reached whatever it is named");
});

test("a missing scenario counts as zero rather than being skipped", () => {
  const a = ladder(
    NAMES,
    [
      { id: 1, cutoffs: { Bronze: 600, Gold: 1000 } },
      { id: 2, cutoffs: { Bronze: 600, Gold: 1000 } },
    ],
    [["1", 5000]]
  );

  assert.equal(a.rank, null, "scenario 2 has no PB, which is a zero against Gold");
  assert.equal(a.score, 5000);
});

test("a cutoff of zero is no cutoff, not a requirement of nothing", () => {
  // Regression, and it started in storage rather than here. Clearing a number
  // input sent "" (or null), sanitizeScenarios ran it through Number(), and
  // Number("") is 0 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â so every untouched cutoff field was written as 0. The
  // walk tested `typeof cutoff === "number"`, so those ranks counted as
  // scorable, and `pb >= 0` passed on every scenario. A benchmark author was
  // handed the top rank for leaving a field blank, while the detail page's
  // own warning said that same rank could never be reached.
  //
  // computeTierFills and the UI both already treated 0 as absent; this makes
  // the rank walk agree with them.
  const a = ladder(
    NAMES,
    [
      { id: 1, cutoffs: { Bronze: 600, Gold: 0 } },
      { id: 2, cutoffs: { Bronze: 600, Gold: 0 } },
    ],
    [["1", 700], ["2", 700]]
  );

  assert.equal(
    a.rank,
    "Bronze",
    "Gold's cutoffs are all zero, so Gold states no requirement and is skipped"
  );
  assert.equal(a.maxed, true, "Bronze is then the ceiling");
});

test("a zero cutoff does not make an otherwise-empty tier reachable", () => {
  // The top rank of the ladder, with only zero cutoffs set.
  const a = ladder(
    ["Bronze", "Gold"],
    [{ id: 1, cutoffs: { Bronze: 600, Gold: 0 } }],
    []
  );

  assert.equal(a.rank, null, "no PB and no real requirement anywhere");
  assert.equal(a.maxed, false);
});

test("a positive cutoff still counts after the zero rule", () => {
  const a = ladder(
    NAMES,
    [{ id: 1, cutoffs: { Bronze: 600, Silver: 0, Gold: 1000 } }],
    [["1", 1500]]
  );

  assert.equal(a.rank, "Gold", "Silver being zero does not block Gold");
  assert.equal(a.maxed, true);
});
