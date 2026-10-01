"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { BAR_STYLES } from "@/lib/barStyles";
import { useBarStyle, useHydrated } from "@/lib/useBarStyle";

/** Small standalone bar used for the previews, same classes as the table. */
function BarPreview({
  style,
  color,
  fillPct,
  label,
}: {
  style: string;
  color: string;
  fillPct: number;
  label: string;
}) {
  return (
    <div className={`bar-track bar-${style}`}>
      <div
        className="bar-fill"
        style={{ width: `${fillPct}%`, backgroundColor: color }}
      />
      <span className="bar-label">{label}</span>
    </div>
  );
}

export default function SettingsForm({ loggedIn }: { loggedIn: boolean }) {
  // The stored preference, read as a subscription.
  const [barStyle, choose] = useBarStyle();

  // Only exists to word the caption honestly: before the browser takes over
  // there is no stored value to describe, and claiming "saved on this device"
  // would be asserting something the server-rendered markup cannot know.
  const hydrated = useHydrated();

  // Three sample rows showing partial, mostly-full and full, using the
  // default rank colours so the previews look like the real table.
  const samples = [
    { name: "Bronze", color: "#b87333", fill: 100, label: "600" },
    { name: "Gold", color: "#ffd700", fill: 84, label: "1,000" },
    { name: "Platinum", color: "#e5e4e2", fill: 62, label: "1,200" },
  ];

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

                  <div className="mt-4 space-y-2">
                    {samples.map((sample) => (
                      <div key={sample.name} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 truncate text-[10px] uppercase tracking-wider text-zinc-500">
                          {sample.name}
                        </span>
                        <div className="min-w-0 flex-1">
                          <BarPreview
                            style={style.id}
                            color={sample.color}
                            fillPct={sample.fill}
                            label={sample.label}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
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
