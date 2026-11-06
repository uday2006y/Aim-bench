"use client";

import Link from "next/link";
import React from "react";

import { useBarStyle } from "@/lib/useBarStyle";
import PinButton from "@/components/PinButton";
import TierSwitcher from "@/components/TierSwitcher";
import SyncBenchmarkButton from "@/components/SyncBenchmarkButton";
import { computeTierFills } from "@/lib/tierBars";
import type { Tier } from "@/lib/benchmarkTiers";

interface CategoryDef {
  name: string;
  color: string;
  subCategories: string[];
}

interface Benchmark {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  difficulty: string;
  rank_names: string[];
  rank_colors: string[];
  rank_thresholds: Record<string, number>;
  scenario_count: number;
  user_id?: string;
  category_defs?: CategoryDef[];
}

interface BenchmarkScenario {
  id: string;
  /** A string: EasyAim ids are alphanumeric and the column is `text`. */
  easyaim_scenario_id: string;
  title: string;
  position: number;
  category: string;
  sub_category?: string;
  cutoffs: Record<string, number>;
  best_score?: number;
}

const DEFAULT_CATEGORY = "Other";

/** Turns a #rgb / #rrggbb colour into rgba() so we can reuse a category's
 * colour for its tinted label background. Falls back to a neutral grey for
 * anything unparseable rather than emitting broken CSS. */
function withAlpha(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || "").trim());

  if (!match) return `rgba(122, 122, 122, ${alpha})`;

  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const packed = parseInt(value, 16);
  return `rgba(${(packed >> 16) & 255}, ${(packed >> 8) & 255}, ${packed & 255}, ${alpha})`;
}

/** One number in the header. Presentation only. */
function Stat({
  label,
  value,
  hint,
  capitalize = false,
}: {
  label: string;
  value: string;
  hint?: string;
  capitalize?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white/[0.03] px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </dt>
      <dd className={`mt-1 truncate text-xl font-extrabold tracking-tight ${
        capitalize ? "capitalize" : ""
      }`}>
        {value}
      </dd>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-zinc-600">{hint}</p> : null}
    </div>
  );
}

/** A rank cell: the cutoff label with a subtle tinted badge. */
function RankPill({ cutoff, color }: { cutoff: number | null; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold"
      style={{ color }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {cutoff != null ? cutoff.toLocaleString() : "—"}
    </span>
  );
}

/** Badge-style rank cell: colored dot, separator dash, cutoff value.
 * No progress bar — matches the "Badge" bar style in settings. */
function BadgeRankCell({
  cutoff,
  color,
  score,
  cleared,
}: {
  cutoff: number | null;
  color: string;
  score: number;
  cleared: boolean;
}) {
  const hasCutoff = typeof cutoff === "number" && cutoff > 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-white/10 bg-white/[0.03]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="w-px h-2 bg-white/20 shrink-0" />
      <span
        className="text-[10px] font-semibold leading-none"
        style={{ color: cleared ? color : "var(--text)" }}
      >
        {hasCutoff ? cutoff.toLocaleString() : "—"}
      </span>
      {score > 0 && hasCutoff && cleared && (
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      )}
    </div>
  );
}

export default function BenchmarkClient({
  id,
  benchmark,
  tier,
  tiers,
  scenarios,
  isAuthorized,
  myPinned,
  loggedIn,
  gatedRows = [],
  previousTierName = null,
}: {
  id: string;
  benchmark: Benchmark;
  /** The tier being viewed. Its ladder names and colours drive every column. */
  tier: Tier;
  /** Every tier on this benchmark, for the switcher. */
  tiers: Tier[];
  scenarios: BenchmarkScenario[];
  isAuthorized: boolean;
  myPinned: boolean;
  loggedIn: boolean;
  /** Scenarios in this tier that have not started tracking yet, each with the score it is waiting on. */
  gatedRows?: { easyaim_scenario_id: string; waitingFor: number | null }[];
  previousTierName: string | null;
}) {
  const [barStyle, chooseBarStyle] = useBarStyle();

  const rankOrder = tier.rank_names;
  const rankColors = tier.rank_colors;

  const gatedByScenario = new Map(
    gatedRows.map((g) => [g.easyaim_scenario_id, g.waitingFor])
  );

  /** Group scenarios by category, preserving category_defs order when available. */
  const categoryOrder: string[] = [];
  const categoryMap = new Map<string, CategoryDef>();
  (benchmark.category_defs ?? []).forEach((def) => {
    categoryOrder.push(def.name);
    categoryMap.set(def.name, def);
  });

  const groups = new Map<string, BenchmarkScenario[]>();
  for (const scenario of scenarios) {
    const cat = scenario.category || DEFAULT_CATEGORY;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(scenario);
  }

  for (const cat of groups.keys()) {
    if (!categoryOrder.includes(cat)) categoryOrder.push(cat);
  }

  const orderedCategories = categoryOrder.filter((c) => groups.has(c));

  const scenarioFills = new Map<string, { score: number; fills: number[] }>();
  for (const scenario of scenarios) {
    const score = scenario.best_score ?? 0;
    const cutoffs = rankOrder.map((rank) => scenario.cutoffs?.[rank] ?? null);
    const fills = computeTierFills(cutoffs, score).map((f) => f.percent);
    scenarioFills.set(scenario.easyaim_scenario_id, { score, fills });
  }

  const totalScenarios = scenarios.length;
  const trackedCount = scenarios.filter((s) => (s.best_score ?? 0) > 0).length;

  return (
    <main className="min-h-screen bg-bg text-text">
      {/* Hero */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-2xl border border-line bg-surface px-6 py-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="chip">{benchmark.platform}</span>
                <span className="chip capitalize">{benchmark.difficulty}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{benchmark.title}</h1>
              {benchmark.description ? (
                <p className="text-sm text-zinc-400">{benchmark.description}</p>
              ) : null}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <PinButton
                benchmarkId={id}
                pinned={myPinned}
                loggedIn={loggedIn}
                size="md"
              />
              {isAuthorized && (
                <SyncBenchmarkButton benchmarkId={id} />
              )}
              {isAuthorized && (
                <Link
                  href={`/benchmarks/${id}/edit`}
                  className="rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 hover:border-white/20"
                >
                  Edit benchmark
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-line pt-6">
            <Stat label="Scenarios" value={totalScenarios.toLocaleString()} />
            <Stat label="Tracked" value={trackedCount.toLocaleString()} hint="Scenarios with a recorded score" />
            <Stat label="Tier" value={tier.name} capitalize hint={tier.is_official ? "Official" : "Unofficial"} />
            <Stat label="Ladder" value={rankOrder.length.toLocaleString()} hint="Ranks in this tier" />
          </div>
        </div>

        {/* Tier switcher */}
        <div className="mt-6 mb-8">
          <TierSwitcher benchmarkId={id} tiers={tiers} activeSlug={tier.slug ?? null} />
        </div>

        {/* Scenarios table */}
        <div className="rounded-2xl border border-line bg-card shadow-lg overflow-hidden">
          <div className="border-b border-line bg-surface px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Scenarios — {tier.name}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sticky left-0 z-10 bg-card">
                    Scenario
                  </th>
                  <th className="px-3 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                    Best
                  </th>
                  {rankOrder.map((rank, rankIdx) => (
                    <th
                      key={rank}
                      className="px-1.5 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                    >
                      <RankPill cutoff={null} color={rankColors[rankIdx] ?? "var(--accent)"} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm">
                {orderedCategories.map((cat) => {
                  const catScenarios = groups.get(cat)!;
                  const def = categoryMap.get(cat);
                  return (
                    <React.Fragment key={cat}>
                      {/* Category header */}
                      <tr>
                        <td
                          colSpan={3 + rankOrder.length}
                          className="px-6 py-3 border-b border-line bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-2">
                            {def ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold"
                                style={{
                                  color: def.color,
                                  borderColor: withAlpha(def.color, 0.5),
                                }}
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: def.color }}
                                />
                                {cat}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                                {cat}
                              </span>
                            )}
                            <span className="ml-auto text-[10px] font-medium text-zinc-600">
                              {catScenarios.length} scenario{catScenarios.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {catScenarios.map((scenario) => {
                        const { score, fills } = scenarioFills.get(scenario.easyaim_scenario_id) ?? {
                          score: 0,
                          fills: rankOrder.map(() => 0),
                        };
                        const gate = gatedByScenario.get(scenario.easyaim_scenario_id);
                        const isGated = gate != null && score === 0;
                        const subDivider =
                          scenario.sub_category && catScenarios.some((s) => s.sub_category === scenario.sub_category && s !== scenario)
                            ? "border-l border-line/50"
                            : "";

                        return (
                          <tr
                            key={scenario.id}
                            className={`border-b border-line/50 hover:bg-white/[0.02] transition-colors ${isGated ? "bg-red-500/5" : ""}`}
                          >
                            <td className="px-6 py-3.5 align-middle sticky left-0 z-20 bg-card">
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                  <span className="font-medium text-text">
                                    {scenario.title}
                                  </span>
                                  {scenario.sub_category ? (
                                    <span className="text-[10px] text-zinc-500">{scenario.sub_category}</span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-[10px] text-zinc-500">
                                    {scenario.easyaim_scenario_id}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                              <div className="flex items-baseline gap-2">
                                {isGated ? (
                                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-red-400">
                                    locked
                                  </span>
                                ) : (
                                  <>
                                    <span
                                      className="font-mono text-sm font-bold tracking-tight sm:text-base"
                                      style={{ color: score > 0 ? "var(--text)" : "var(--text)" }}
                                    >
                                      {score ? score.toLocaleString() : "—"}
                                    </span>
                                    <span className="text-[10px] font-medium text-zinc-500">
                                      {score > 0 ? `${Math.round((score / (rankOrder.reduce((m, r) => Math.max(m, scenario.cutoffs?.[r] ?? 0), 0))) * 100)}% of top` : ""}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>

                            {rankOrder.map((rank, rankIdx) => {
                              const cutoff = scenario.cutoffs?.[rank] ?? null;
                              const hasCutoff = typeof cutoff === "number" && cutoff > 0;
                              const fillPct = fills[rankIdx] ?? 0;
                              const color = rankColors[rankIdx] ?? "var(--accent)";
                              const cleared = score > 0 && hasCutoff && score >= cutoff;

                              return (
                                <td key={rank} className="px-1.5 py-3.5 align-middle">
                                  {barStyle === "badge" ? (
                                    <BadgeRankCell
                                      cutoff={cutoff}
                                      color={color}
                                      score={score}
                                      cleared={cleared}
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center gap-1.5">
                                      <div
                                        className="bar-track"
                                        style={{ backgroundColor: withAlpha(color, 0.15) }}
                                      >
                                        {hasCutoff && score > 0 && (
                                          <div
                                            className="bar-fill"
                                            style={{
                                              width: `${Math.min(100, fillPct)}%`,
                                              backgroundColor: color,
                                              boxShadow: cleared
                                                ? `0 0 14px ${withAlpha(color, 0.6)}`
                                                : "none",
                                            }}
                                          />
                                        )}
                                        <span className="bar-label text-[10px] font-medium">
                                          {hasCutoff ? cutoff.toLocaleString() : "—"}
                                        </span>
                                      </div>
                                      {isGated && (
                                        <span className="text-[9px] text-red-400/80 font-medium">
                                          needs {gate?.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                {orderedCategories.length === 0 && (
                  <tr>
                    <td colSpan={3 + rankOrder.length} className="px-6 py-12 text-center text-zinc-500">
                      No scenarios in this tier yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line bg-surface px-6 py-3">
            <p className="text-xs text-zinc-500">
              {barStyle === "badge"
                ? "Each rank shows its cutoff value as a colored badge. Filled dot means the rank is cleared."
                : "Bars show your progress toward each rank's cutoff, measured from the previous cleared rank. Filled bars mean the rank is cleared."}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
