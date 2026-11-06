/**
 * Progress-bar styles for the benchmark scenario table.
 *
 * This is a per-user cosmetic preference, not a theme: it changes how the
 * bar is drawn, never what it says. The fill colour still comes from the
 * benchmark's own rank_colors, and the widths still come from the real
 * cutoffs and scores (see tierBars.ts), so every visitor sees the same data
 * and only the shape differs.
 *
 * Stored in localStorage rather than the database so it needs no schema
 * change and applies instantly. The trade-off is that it follows the
 * device, not the account, so a preference set on a laptop won't show up
 * on a phone.
 */

export const BAR_STYLE_STORAGE_KEY = "aimbench-bar-style";

/**
 * Same-tab notification for a preference change.
 *
 * The browser's `storage` event only fires in *other* tabs, so writing the
 * preference here would not re-read it in the tab that wrote it. This is the
 * in-tab equivalent, dispatched by the hook that wraps this module.
 */
export const BAR_STYLE_EVENT = "aimbench-bar-style-change";

export interface BarStyle {
  id: string;
  label: string;
  description: string;
}

export const BAR_STYLES: BarStyle[] = [
  {
    id: "underline",
    label: "Underline",
    description:
      "The cutoff number with a thin line under it that fills as you climb.",
  },
  {
    id: "slanted",
    label: "Slanted bar",
    description:
      "A slanted bar behind each number that fills up toward the next rank.",
  },
  {
    id: "block",
    label: "Block",
    description:
      "A solid rectangular block per rank, lit up once you have cleared it.",
  },
];

export const DEFAULT_BAR_STYLE = "slanted";

/**
 * Ids from the first three styles. Someone who picked one of those keeps a
 * sensible choice instead of silently falling back to the default.
 */
const LEGACY_BAR_STYLES: Record<string, string> = {
  fill: "underline",
  parallelogram: "slanted",
  badge: "block",
};

export function isBarStyle(id: unknown): id is string {
  return (
    typeof id === "string" && BAR_STYLES.some((style) => style.id === id)
  );
}

/** Turns whatever was stored into a style that exists. Pure, so it is tested. */
export function migrateBarStyle(stored: string | null | undefined): string {
  if (isBarStyle(stored)) return stored;
  // Own properties only: `"constructor" in {}` is true, and a stored value
  // of that name would otherwise come back as a function instead of a style.
  if (
    typeof stored === "string" &&
    Object.prototype.hasOwnProperty.call(LEGACY_BAR_STYLES, stored)
  ) {
    return LEGACY_BAR_STYLES[stored];
  }
  return DEFAULT_BAR_STYLE;
}

/**
 * The CSS class for a style.
 *
 * Always prefixed, and that is not decoration. The class used to be built as
 * `bar-${id}`, and one style's id was "fill", which produced `bar-fill`: the
 * name of the rule for the INNER fill element, an absolutely positioned box
 * pinned to its parent. The track picked that rule up as well, lost its
 * place in the page, and the previews smeared across the whole screen. The
 * prefix makes a style id unable to name anything else.
 */
export function barStyleClass(id: string): string {
  return `rb-style-${migrateBarStyle(id)}`;
}

/** Reads the stored preference, falling back to the default. */
export function readBarStyle(): string {
  if (typeof window === "undefined") return DEFAULT_BAR_STYLE;

  try {
    return migrateBarStyle(window.localStorage.getItem(BAR_STYLE_STORAGE_KEY));
  } catch {
    // Private browsing or a blocked storage partition.
    return DEFAULT_BAR_STYLE;
  }
}

export function writeBarStyle(id: string) {
  if (typeof window === "undefined") return;
  if (!isBarStyle(id)) return;

  try {
    window.localStorage.setItem(BAR_STYLE_STORAGE_KEY, id);
  } catch {
    // Preference simply won't persist; the bar still renders.
  }
}
