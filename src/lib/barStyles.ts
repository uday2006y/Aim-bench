/**
 * Progress-bar styles for the benchmark scenario table.
 *
 * This is a per-user cosmetic preference, not a theme: it changes how the
 * bar is drawn, never what it says. The fill colour still comes from the
 * benchmark's own rank_colors, and the widths still come from the real
 * cutoffs and scores, so every visitor sees the same data — they just see
 * it in a different shape.
 *
 * Stored in localStorage rather than the database so it needs no schema
 * change and applies instantly. The trade-off is that it follows the
 * device, not the account, so a preference set on a laptop won't show up
 * on a phone.
 */

export const BAR_STYLE_STORAGE_KEY = "aimbench-bar-style";

export interface BarStyle {
  id: string;
  label: string;
  description: string;
}

export const BAR_STYLES: BarStyle[] = [
  {
    id: "ribbon",
    label: "Ribbon",
    description: "Curved at both ends, symmetric.",
  },
  {
    id: "parallelogram",
    label: "Parallelogram",
    description: "Both edges slant, top shifted right.",
  },
  {
    id: "angled",
    label: "Angled",
    description: "Slanted right edge, straight left.",
  },
  {
    id: "flat",
    label: "Flat",
    description: "Plain rectangle. Maximum readability.",
  },
  {
    id: "rounded",
    label: "Rounded",
    description: "Pill shape, rounded at both ends.",
  },
  {
    id: "segmented",
    label: "Segmented",
    description: "Notched track, so partial progress reads as steps.",
  },
];

export const DEFAULT_BAR_STYLE = "ribbon";

export function isBarStyle(id: unknown): id is string {
  return (
    typeof id === "string" && BAR_STYLES.some((style) => style.id === id)
  );
}

/** Reads the stored preference, falling back to the default. */
export function readBarStyle(): string {
  if (typeof window === "undefined") return DEFAULT_BAR_STYLE;

  try {
    const stored = window.localStorage.getItem(BAR_STYLE_STORAGE_KEY);
    return isBarStyle(stored) ? stored : DEFAULT_BAR_STYLE;
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
