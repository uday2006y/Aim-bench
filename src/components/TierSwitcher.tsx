"use client";

import Link from "next/link";

import { orderTiers, tierHref, tierLabel, type Tier } from "@/lib/benchmarkTiers";

/**
 * Moves between a benchmark's tiers.
 *
 * The reference this is drawn from puts the pills in the header bar beside
 * "Back", each one a word, with the current tier marked two ways at once: a
 * lighter plate and a cyan rule down its left edge. Two signals rather than
 * one, because the plate alone is a very quiet difference on a dark
 * background and this is the control that says which ladder the whole table
 * below is being scored against.
 *
 * Real links, not buttons with an onClick. Each tier is an address you can
 * share, and the back button has to work.
 */
export default function TierSwitcher({
  benchmarkId,
  tiers,
  activeSlug,
}: {
  benchmarkId: string;
  tiers: Tier[];
  activeSlug: string | null;
}) {
  const ordered = orderTiers(tiers);

  if (ordered.length <= 1) {
    // One tier is not a choice. Rendering a single pill would spend header
    // space telling the visitor something they can already see.
    return null;
  }

  return (
    <nav
      aria-label="Benchmark tiers"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-1"
    >
      {ordered.map((tier) => {
        const active = tier.slug === activeSlug;

        return (
          <Link
            key={tier.id}
            href={tierHref(benchmarkId, tier.slug)}
            aria-current={active ? "page" : undefined}
            className={[
              "relative shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              // The rule is a pseudo-element rather than a border so it can
              // sit inside the pill's rounded corner instead of squarely
              // against it.
              "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:content-['']",
              active
                ? "bg-white/[0.07] text-white before:bg-accent"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-white before:bg-transparent",
            ].join(" ")}
          >
            {tierLabel(tier)}
          </Link>
        );
      })}
    </nav>
  );
}
