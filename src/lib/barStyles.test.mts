import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BAR_STYLES,
  DEFAULT_BAR_STYLE,
  barStyleClass,
  isBarStyle,
  migrateBarStyle,
} from "./barStyles.ts";

/**
 * The parts a bar is drawn from. A style class that equalled one of these
 * would pick up that part's rules, which is exactly how the settings previews
 * once smeared across the whole page: a style called "fill" became the class
 * `bar-fill`, the rule for the inner fill box.
 */
const PART_CLASSES = ["rb", "rb-label", "rb-track", "rb-fill"];

test("a style class can never be the name of a part of the bar", () => {
  for (const style of BAR_STYLES) {
    const cls = barStyleClass(style.id);

    assert.ok(cls.startsWith("rb-style-"), `${style.id} -> ${cls}`);
    assert.ok(!PART_CLASSES.includes(cls), `${cls} collides with a part`);
  }
});

test("even a hostile id is turned into a safe class", () => {
  for (const id of ["fill", "track", "label", "rb-fill", "", "../x"]) {
    const cls = barStyleClass(id);

    assert.ok(cls.startsWith("rb-style-"));
    assert.ok(!PART_CLASSES.includes(cls));
    assert.ok(isBarStyle(cls.replace("rb-style-", "")));
  }
});

test("there are exactly the three designs", () => {
  assert.deepEqual(
    BAR_STYLES.map((s) => s.id),
    ["underline", "slanted", "block"]
  );
  assert.ok(isBarStyle(DEFAULT_BAR_STYLE));
});

test("a stored preference from the old styles carries over", () => {
  assert.equal(migrateBarStyle("fill"), "underline");
  assert.equal(migrateBarStyle("parallelogram"), "slanted");
  assert.equal(migrateBarStyle("badge"), "block");
});

test("current ids pass through and anything else falls back", () => {
  for (const style of BAR_STYLES) {
    assert.equal(migrateBarStyle(style.id), style.id);
  }

  assert.equal(migrateBarStyle(null), DEFAULT_BAR_STYLE);
  assert.equal(migrateBarStyle(undefined), DEFAULT_BAR_STYLE);
  assert.equal(migrateBarStyle("nonsense"), DEFAULT_BAR_STYLE);
  assert.equal(migrateBarStyle("constructor"), DEFAULT_BAR_STYLE);
});
