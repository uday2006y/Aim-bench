/**
 * How full each rank's bar should be.
 *
 * A tier's bar fills across the gap between the rung below it and its own
 * cutoff — not from zero. Dividing the score by the cutoff alone made every
 * cleared tier read as a meaningless 100%-plus, and left the top tier
 * sitting at 60% for a player nowhere near it, so the one bar that should
 * have carried real progress was the one carrying the least.
 *
 * With the ladder 650 / 750 / 850 / 950 / 1,050 / 1,694 and a score of
 * 1,020.141, the old rule drew Diamond at 97% and Champion at 60%. The new
 * one draws Diamond at 70% (seventy of the hundred points between Platinum
 * and Diamond) and Champion at 0%, because that climb has not started.
 */
export interface TierFill {
  /** 0-100, whole percent. */
  percent: number;
  /** The cutoff this bar measures up from. Zero for the first scorable tier. */
  floor: number;
  /** False when this tier has no cutoff, or the gap below it is degenerate. */
  drawable: boolean;
}

/**
 * @param cutoffs Cutoff per rank, index-aligned with the rank ladder. `null`
 *   or non-positive means that tier has no cutoff for this scenario and is
 *   skipped rather than treated as zero.
 * @param score The scenario's score.
 */
export function computeTierFills(
  cutoffs: (number | null | undefined)[],
  score: number
): TierFill[] {
  return cutoffs.map((cutoff, rankIdx) => {
    const hasCutoff = typeof cutoff === "number" && cutoff > 0;

    // The floor walks down past any tier this scenario has no cutoff for.
    // An absent cutoff means the tier is skipped, not that it sits at zero
    // and silently becomes the baseline for the next one up.
    let floor = 0;
    for (let below = rankIdx - 1; below >= 0; below--) {
      const belowCutoff = cutoffs[below];
      if (typeof belowCutoff === "number" && belowCutoff > 0) {
        floor = belowCutoff;
        break;
      }
    }

    const span = hasCutoff ? (cutoff as number) - floor : 0;

    if (!hasCutoff || score <= 0 || span <= 0) {
      return { percent: 0, floor, drawable: hasCutoff && score > 0 };
    }

    const raw = ((score - floor) / span) * 100;

    return {
      // Clamped rather than allowed past the end: a score above the cutoff
      // has cleared the tier, and a bar at 180% is not a thing.
      percent: Math.min(100, Math.max(0, Math.round(raw))),
      floor,
      drawable: true,
    };
  });
}
