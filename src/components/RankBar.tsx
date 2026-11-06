import type { CSSProperties } from "react";

import { barStyleClass } from "@/lib/barStyles";
import { readableOn } from "@/lib/theme";

const HEX = /^#[0-9a-f]{6}$/i;

export interface RankBarProps {
  /** A style id from barStyles.ts. */
  style: string;
  /** What is written on the bar: normally the rank's cutoff. */
  label: string;
  /** 0-100: how far through this rank's own gap the score has climbed. */
  percent: number;
  /**
   * The rank's colour. `null` draws the neutral grey used while a scenario
   * has no rank cleared yet.
   */
  color: string | null;
  /** The score has reached this rank's cutoff. */
  cleared: boolean;
}

/**
 * One rank cell of a scenario row, in whichever style the visitor chose.
 *
 * The benchmark table and the /settings previews both draw through this, so
 * what is picked in Settings is exactly what shows up on a benchmark. It is
 * all CSS (see "Rank progress bars" in globals.css): the same markup serves
 * every style and only the rules differ.
 */
export default function RankBar({
  style,
  label,
  percent,
  color,
  cleared,
}: RankBarProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));

  // Text sitting on a fully lit bar takes whichever of black or white reads
  // on that rank colour; a gold bar with white text is unreadable.
  const onFill = color && HEX.test(color) ? readableOn(color) : "var(--accent-fg)";

  const vars = {
    "--rb-color": color ?? "var(--rb-unranked)",
    "--rb-fg": onFill,
    "--rb-pct": `${pct}%`,
  } as CSSProperties;

  return (
    <span
      className={`rb ${barStyleClass(style)}`}
      style={vars}
      data-cleared={cleared ? "" : undefined}
      role="img"
      aria-label={`${label}, ${Math.round(pct)}% of the way`}
    >
      <span className="rb-label">{label}</span>
      <span className="rb-track" aria-hidden="true">
        <span className="rb-fill" />
      </span>
    </span>
  );
}
