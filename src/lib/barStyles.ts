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
    id: "pulse",
    label: "Pulse",
    description: "Animated breathing fill that glows as it progresses.",
  },
  {
    id: "neon",
    label: "Neon",
    description: "Bright tube light with a soft glow halo.",
  },
  {
    id: "candy",
    label: "Candy",
    description: "Diagonal striped candy-cane fill.",
  },
  {
    id: "ghost",
    label: "Ghost",
    description: "Hollow outline only — no fill, just the track shape.",
  },
  {
    id: "pixels",
    label: "Pixels",
    description: "Blocky stepped edges, like a retro HUD.",
  },
  {
    id: "wave",
    label: "Wave",
    description: "Sine-wave top edge that undulates as it fills.",
  },
  {
    id: "glass",
    label: "Glass",
    description: "Frosted frosted-glass bar with backdrop blur.",
  },
  {
    id: "rail",
    label: "Rail",
    description: "Parallel train-track lines with center divider.",
  },
  {
    id: "ember",
    label: "Ember",
    description: "Gradient fire fill that shifts from orange to red.",
  },
  {
    id: "void",
    label: "Void",
    description: "Dark inverted bar with a thin luminous edge.",
  },
];

export const DEFAULT_BAR_STYLE = "pulse";

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
