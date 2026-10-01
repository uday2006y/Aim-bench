import { test } from "node:test";
import assert from "node:assert/strict";

import {
  renameCutoffKey,
  sanitizeScenarios,
  sanitizeCategoryDefs,
  syncSubCategoriesIntoDefs,
  MAX_SCENARIOS_PER_BENCHMARK,
  type CategoryDef,
} from "./benchmarkScenarios.ts";

/**
 * The normalisers and the cutoff-key rule.
 *
 * renameCutoffKey is here because of a shipped data-loss bug: the edit form
 * renamed a rank without moving its cutoffs, so every score requirement for
 * that tier stayed filed under a name no rank matched. The tier silently
 * became unreachable and the benchmark was saved that way. The create form
 * did the remap and the edit form did not — two copies of one rule, which is
 * how they drifted.
 *
 * Run with:  npm test
 */

test("renaming a rank takes its cutoffs with it", () => {
  const cutoffs = { Bronze: 600, Gold: 1000, Platinum: 1200 };

  assert.deepEqual(renameCutoffKey(cutoffs, "Gold", "Silver"), {
    Bronze: 600,
    Silver: 1000,
    Platinum: 1200,
  });
});

test("the old key is gone, not merely shadowed", () => {
  // The whole failure mode: if "Gold" survived alongside "Silver", the row
  // would still be written with a dead key in it and the tier would still be
  // unreachable.
  const renamed = renameCutoffKey({ Gold: 1000 }, "Gold", "Silver");

  assert.equal("Gold" in renamed, false);
  assert.equal(renamed.Silver, 1000);
});

test("renaming a rank no scenario has a cutoff for changes nothing", () => {
  const cutoffs = { Bronze: 600 };

  // Same object back: no copy, so React's identity check on state can skip
  // the re-render this would otherwise cause on every keystroke.
  assert.equal(renameCutoffKey(cutoffs, "Diamond", "Jade"), cutoffs);
});

test("renaming a rank to itself is a no-op", () => {
  const cutoffs = { Gold: 1000 };

  assert.equal(renameCutoffKey(cutoffs, "Gold", "Gold"), cutoffs);
});

test("renaming one rank leaves every other rank's cutoffs alone", () => {
  const cutoffs = { Bronze: 600, Silver: 800, Gold: 1000, Diamond: 1400 };
  const renamed = renameCutoffKey(cutoffs, "Silver", "Platinum");

  assert.deepEqual(renamed, {
    Bronze: 600,
    Platinum: 800,
    Gold: 1000,
    Diamond: 1400,
  });
  // And the input is not mutated.
  assert.equal(cutoffs.Silver, 800);
});

test("renaming a rank moves its cutoff even when that cutoff is zero", () => {
  // Pure key handling: whatever is under the old key goes to the new one. A
  // zero should never reach here from a form (sanitizeScenarios drops it), but
  // a row written before that was fixed still has zeros in it, and this
  // function is what an author renaming a tier touches.
  const renamed = renameCutoffKey({ Bronze: 0, Gold: 1000 }, "Bronze", "Entry");

  assert.deepEqual(renamed, { Entry: 0, Gold: 1000 });
});

test("renaming into a name that already exists overwrites it", () => {
  // Deliberate: the author asked one rank to become the other, and there is
  // no way to keep both sets under one name.
  const renamed = renameCutoffKey({ Silver: 800, Gold: 1000 }, "Gold", "Silver");

  assert.deepEqual(renamed, { Silver: 1000 });
});

// ---------------------------------------------------------------- scenarios

test("scenarios are capped at the documented maximum", () => {
  const many = Array.from({ length: MAX_SCENARIOS_PER_BENCHMARK + 20 }, (_, i) => ({
    id: i + 1,
    title: `Scenario ${i + 1}`,
    cutoffs: {},
  }));

  assert.equal(sanitizeScenarios(many).length, MAX_SCENARIOS_PER_BENCHMARK);
});

test("duplicate scenario ids are dropped, not written twice", () => {
  // These rows are deleted and re-inserted wholesale on every edit, and the
  // table has a unique constraint on (benchmark_id, easyaim_scenario_id).
  const result = sanitizeScenarios([
    { id: 7, title: "First" },
    { id: 7, title: "Second" },
    { id: 8, title: "Third" },
  ]);

  assert.deepEqual(
    result.map((s) => s.easyaimScenarioId),
    [7, 8]
  );
  assert.equal(result[0].title, "First");
});

test("a non-numeric or negative scenario id is rejected", () => {
  const result = sanitizeScenarios([
    { id: "not-a-number" },
    { id: -3 },
    { id: 0 },
    { id: null },
    {},
    null,
    "nonsense",
    { id: 12 },
  ]);

  assert.deepEqual(
    result.map((s) => s.easyaimScenarioId),
    [12]
  );
});

test("cutoffs are stored as finite positive numbers", () => {
  // The comment in aggregates.ts calls out a string landing in this jsonb as
  // the thing that quietly breaks rank comparison during sync.
  const [scenario] = sanitizeScenarios([
    {
      id: 1,
      cutoffs: {
        Bronze: "600",
        Gold: 1000.5,
        Diamond: -20,
        Radiant: "",
        Immortal: null,
        Champion: "not a number",
        Jade: NaN,
        // Number(null) and Number("") are both 0. If empties are coerced
        // instead of dropped they land as a cutoff of zero, and a cutoff of
        // zero is a requirement every scenario passes — so an untouched rank
        // silently becomes reachable.
        Copper: "0",
        Cobalt: 0,
      },
    },
  ]);

  assert.deepEqual(scenario.cutoffs, { Bronze: 600, Gold: 1000.5 });
});

test("a cleared cutoff field is dropped rather than stored as zero", () => {
  // Regression: the edit form sends every rank key, with "" for the ones the
  // author never filled in.
  const [scenario] = sanitizeScenarios([
    { id: 1, cutoffs: { Bronze: 600, Silver: "", Gold: null } },
  ]);

  assert.deepEqual(scenario.cutoffs, { Bronze: 600 });
  assert.equal("Silver" in scenario.cutoffs, false);
  assert.equal("Gold" in scenario.cutoffs, false);
});

test("a scenario with no title gets a readable fallback", () => {
  const [scenario] = sanitizeScenarios([{ id: 42, title: "   " }]);

  assert.equal(scenario.title, "EasyAim Scenario 42");
  assert.equal(scenario.category, "Other");
});

// ------------------------------------------------------------ category defs

/**
 * sanitizeCategoryDefs returns undefined for a non-array, which every test
 * here is not. Asserting once keeps the assertions about behaviour rather
 * than about the return type.
 */
function defs(input: unknown): CategoryDef[] {
  const result = sanitizeCategoryDefs(input);
  assert.ok(result, "expected an array back");
  return result;
}

test("category colours must look like hex, or fall back to grey", () => {
  const parsed = defs([
    { name: "Clicking", color: "#ff6b35", subCategories: ["Static"] },
    { name: "Tracking", color: "red; background: url(x)" },
    { name: "Smooth", color: "  #ABCDEF  " },
  ]);

  assert.equal(parsed[0].subCategories[0], "Static");
  assert.equal(parsed[0].color, "#ff6b35");

  // The injection attempt is replaced rather than written to the database.
  assert.equal(
    defs([{ name: "Tracking", color: "red; background: url(x)" }])[0].color,
    "#7a7a7a"
  );
  assert.equal(defs([{ name: "Smooth", color: "  #ABCDEF  " }])[0].color, "#ABCDEF");
});

test("duplicate category names collapse to one", () => {
  const parsed = defs([
    { name: "Clicking", color: "#111111" },
    { name: "Clicking", color: "#222222" },
  ]);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].color, "#111111");
});

test("a typed sub-category is folded into its category's list", () => {
  // The edit form takes a free-text sub-category, so one can arrive that
  // category_defs has never heard of. Without this the detail table's rail
  // renders blank, because the rail reads its labels from category_defs.
  const scenarios = sanitizeScenarios([
    { id: 1, category: "Clicking", subCategory: "Flick" },
  ]);

  const parsed = syncSubCategoriesIntoDefs(
    defs([{ name: "Clicking", color: "#ff6b35", subCategories: ["Static"] }]),
    scenarios
  );

  assert.deepEqual(parsed[0].subCategories, ["Static", "Flick"]);
});

test("folding a sub-category in does not reorder or duplicate", () => {
  const scenarios = sanitizeScenarios([
    { id: 1, category: "Clicking", subCategory: "Static" },
    { id: 2, category: "Clicking", subCategory: "Flick" },
  ]);

  const parsed = syncSubCategoriesIntoDefs(
    defs([{ name: "Clicking", color: "#ff6b35", subCategories: ["Static", "Flick"] }]),
    scenarios
  );

  assert.deepEqual(parsed[0].subCategories, ["Static", "Flick"]);
});

test("folding leaves categories no scenario uses alone", () => {
  const scenarios = sanitizeScenarios([{ id: 1, category: "Clicking" }]);

  const parsed = syncSubCategoriesIntoDefs(
    defs([
      { name: "Clicking", color: "#ff6b35" },
      { name: "Tracking", color: "#00ff00", subCategories: ["Micro"] },
    ]),
    scenarios
  );

  assert.deepEqual(parsed[1].subCategories, ["Micro"]);
});
