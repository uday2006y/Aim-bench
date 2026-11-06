"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { BAR_STYLES } from "@/lib/barStyles";
import { useBarStyle, useHydrated } from "@/lib/useBarStyle";
import RankBar from "@/components/RankBar";
import { computeTierFills } from "@/lib/tierBars";

/**
 * Sample ladder for the previews. Three players on four ranks: one who has
 * cleared three and is climbing the fourth, one climbing the second, and one
 * who has not reached the first yet (drawn grey).
 */
const SAMPLE_RANKS = [
  { name: "Bronze", color: "#b87333", cutoff: 600 },
  { name: "Silver", color: "#c0c0c0", cutoff: 800 },
  { name: "Gold", color: "#ffd700", cutoff: 1000 },
  { name: "Platinum", color: "#e5e4e2", cutoff: 1200 },
];

const SAMPLE_SCORES = [1040, 700, 410];

/**
 * A few rows of the real thing. It draws through the same RankBar and the
 * same fill maths (tierBars.ts) as the benchmark table, so what is picked
 * here is exactly what shows up on a benchmark.
 *
 * Spans rather than divs: it sits inside a <button>, which may only hold
 * phrasing content.
 */
function StylePreview({ styleId }: { styleId: string }) {
  const cutoffs = SAMPLE_RANKS.map((rank) => rank.cutoff);

  return (
    <span className="mt-4 block">
      <span className="mb-2 grid grid-cols-4 gap-1">
        {SAMPLE_RANKS.map((rank) => (
          <span
            key={rank.name}
            className="truncate text-center text-[10px] font-bold uppercase tracking-wider"
            style={{ color: rank.color }}
          >
            {rank.name}
          </span>
        ))}
      </span>

      <span className="block space-y-2.5">
        {SAMPLE_SCORES.map((score) => {
          const fills = computeTierFills(cutoffs, score);
          const hasRank = cutoffs.some((cutoff) => score >= cutoff);

          return (
            <span key={score} className="grid grid-cols-4 gap-1">
              {SAMPLE_RANKS.map((rank, index) => (
                <RankBar
                  key={rank.name}
                  style={styleId}
                  label={rank.cutoff.toLocaleString()}
                  percent={fills[index]?.percent ?? 0}
                  color={hasRank ? rank.color : null}
                  cleared={score >= rank.cutoff}
                />
              ))}
            </span>
          );
        })}
      </span>
    </span>
  );
}

export default function SettingsForm({ loggedIn }: { loggedIn: boolean }) {
  // The stored preference, read as a subscription.
  const [barStyle, choose] = useBarStyle();

  // Only exists to word the caption honestly: before the browser takes over
  // there is no stored value to describe, and claiming "saved on this device"
  // would be asserting something the server-rendered markup cannot know.
  const hydrated = useHydrated();


  return (
    <main className="min-h-screen text-white">
      <SiteHeader loggedIn={loggedIn} />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-500 transition-colors hover:text-white"
        >
          ← Back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Personal preferences for how AIMBENCH looks on this device. Nobody
          else sees these — every visitor sees the same scores and ranks.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Progress bar style</h2>
          <p className="mt-1 text-sm text-zinc-500">
            How rank progress bars are drawn on benchmark tables. Fill
            colours still come from each benchmark&apos;s own ranks, and
            widths still come from the real cutoffs.
          </p>

          <div className="mt-5 space-y-3" role="radiogroup" aria-label="Progress bar style">
            {BAR_STYLES.map((style) => {
              const selected = barStyle === style.id;

              return (
                <button
                  key={style.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(style.id)}
                  className={`w-full rounded-2xl border p-5 text-left transition ${
                    selected
                      ? "border-white/30 bg-white/[0.05]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {style.label}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {style.description}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                        selected
                          ? "border-white bg-white text-black"
                          : "border-white/15 text-zinc-500"
                      }`}
                    >
                      {selected ? "Selected" : "Choose"}
                    </span>
                  </div>
                  <StylePreview styleId={style.id} />
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-zinc-600" aria-live="polite">
            {hydrated
              ? "Saved on this device. It will apply to every benchmark table you open."
              : "Loading your preference…"}
          </p>
        </section>

        <section className="mt-12 border-t border-white/10 pt-8">
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {loggedIn
              ? "You are signed in. Logging out clears nothing on this device."
              : "You are not signed in."}
          </p>
          <div className="mt-4 flex gap-3">
            {loggedIn ? (
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Log Out
                </button>
              </form>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
