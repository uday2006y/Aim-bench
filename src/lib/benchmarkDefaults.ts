/**
 * The rank ladder a brand-new benchmark starts on.
 *
 * Kept apart from benchmarkTiers.ts because these are the *benchmark's*
 * defaults — the ladder stored on `benchmarks.rank_names` for rows written
 * before tiers existed — while benchmarkTiers owns the ladder on a tier. Both
 * start from the same eight rungs, and having them in one place is what stops
 * a new benchmark and a new tier disagreeing about what "no ladder given"
 * means.
 */
export const DEFAULT_RANK_NAMES = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Champion",
  "Radiant",
  "Immortal",
];

export const DEFAULT_RANK_COLORS = [
  "#b87333",
  "#c0c0c0",
  "#ffd700",
  "#e5e4e2",
  "#b9f2fe",
  "#ffd700",
  "#ff0000",
  "#9f9f9f",
];
