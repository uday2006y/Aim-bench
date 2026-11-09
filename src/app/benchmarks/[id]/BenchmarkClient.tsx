"use client";

import Link from "next/link";
import React from "react";

import PinButton from "@/components/PinButton";
import { useBarStyle } from "@/lib/useBarStyle";
import RankBar from "@/components/RankBar";
import { computeTierFills } from "@/lib/tierBars";
import TierSwitcher from "@/components/TierSwitcher";
import SyncBenchmarkButton from "@/components/SyncBenchmarkButton";
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
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
      <dd className={`mt-1 truncate text-xl font-extrabold tracking-tight ${capitalize ? "capitalize" : ""}`}>{value}</dd>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-zinc-600">{hint}</p> : null}
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
  tier: Tier;
  tiers: Tier[];
  scenarios: BenchmarkScenario[];
  isAuthorized: boolean;
  myPinned: boolean;
  loggedIn: boolean;
  gatedRows?: { easyaim_scenario_id: string; waitingFor: number | null }[];
  previousTierName: string | null;
}) {
  const rankOrder = tier.rank_names;
  const rankColors = tier.rank_colors;
  const [barStyle] = useBarStyle();

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

  const scenarioScores = new Map<string, number>();
  for (const scenario of scenarios) {
    scenarioScores.set(scenario.easyaim_scenario_id, scenario.best_score ?? 0);
  }

  const totalScenarios = scenarios.length;
  const trackedCount = scenarios.filter((s) => (s.best_score ?? 0) > 0).length;

  // Phones: the ranks sit in a small grid under each scenario instead of in
  // columns, so as many columns as fit without crowding. Six ranks make
  // two rows of three; four make two rows of two.
  const phoneColumns =
    rankOrder.length <= 3 ? Math.max(rankOrder.length, 1) : rankOrder.length === 4 ? 2 : 3;

  /** Everything one scenario row needs to draw, for the phone layout. */
  function phoneRow(scenario: BenchmarkScenario) {
    const score = scenarioScores.get(scenario.easyaim_scenario_id) ?? 0;
    const gate = gatedByScenario.get(scenario.easyaim_scenario_id);
    const isGated = gate != null && score === 0;
    const cutoffList = rankOrder.map((rank) => scenario.cutoffs?.[rank]);
    const fills = computeTierFills(cutoffList, score);
    const hasRank = cutoffList.some((c) => typeof c === "number" && c > 0 && score >= c);
    const topCutoff = rankOrder.reduce((m, r) => Math.max(m, scenario.cutoffs?.[r] ?? 0), 0);
    const pctOfTop = score > 0 && topCutoff > 0 ? Math.round((score / topCutoff) * 100) : null;

    return { score, gate, isGated, cutoffList, fills, hasRank, pctOfTop };
  }

  return (
    <main className="min-h-screen bg-bg text-text">
      {/* Hero */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/benchmarks"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-text"
        >
          <span aria-hidden="true">←</span> Back to benchmarks
        </Link>

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
              <PinButton benchmarkId={id} pinned={myPinned} loggedIn={loggedIn} size="md" />
              <SyncBenchmarkButton benchmarkId={id} />
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

          {/*
            Phones: one card per scenario. The category is a header, the
            scenario name and best score sit on top, and the rank bars follow in
            a grid. Everything is one column of content, so nothing scrolls
            sideways. From sm up the table below takes over.
          */}
          <div className="sm:hidden">
            {orderedCategories.map((cat) => {
              const catScenarios = groups.get(cat)!;
              const def = categoryMap.get(cat);

              return (
                <section key={cat}>
                  <div className="flex items-center gap-2 border-b border-line bg-white/[0.02] px-4 py-3">
                    {def ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold"
                        style={{ color: def.color, borderColor: withAlpha(def.color, 0.5) }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: def.color }} />
                        {cat}
                      </span>
                    ) : (
                      <span className="px-1 py-0.5 text-[10px] font-semibold text-zinc-500">{cat}</span>
                    )}
                    <span className="ml-auto text-[10px] font-medium text-zinc-600">
                      {catScenarios.length} scenario{catScenarios.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {catScenarios.map((scenario) => {
                    const { score, gate, isGated, cutoffList, fills, hasRank, pctOfTop } = phoneRow(scenario);

                    return (
                      <div
                        key={scenario.id}
                        className={`border-b border-line/50 px-4 py-4 ${isGated ? "bg-red-500/5" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-semibold leading-snug text-text">{scenario.title}</p>
                            {scenario.sub_category ? (
                              <p className="text-xs text-zinc-400">{scenario.sub_category}</p>
                            ) : null}
                            <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{scenario.easyaim_scenario_id}</p>
                          </div>

                          <div className="shrink-0 text-right">
                            {isGated ? (
                              <span className="text-[11px] font-medium text-red-400">locked</span>
                            ) : (
                              <>
                                <p className="font-mono text-base font-bold tracking-tight">
                                  {score ? score.toLocaleString() : "—"}
                                </p>
                                {pctOfTop != null ? (
                                  <p className="text-[10px] font-medium text-zinc-500">{pctOfTop}% of top</p>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>

                        <div
                          className="mt-3 grid gap-x-2 gap-y-3"
                          style={{ gridTemplateColumns: `repeat(${phoneColumns}, minmax(0, 1fr))` }}
                        >
                          {rankOrder.map((rank, rankIdx) => {
                            const cutoff = cutoffList[rankIdx] ?? null;
                            const hasCutoff = typeof cutoff === "number" && cutoff > 0;
                            const color = rankColors[rankIdx] ?? "var(--accent)";
                            const cleared = score > 0 && hasCutoff && score >= cutoff;

                            return (
                              <div key={rank} className="min-w-0">
                                <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                  <span className="truncate">{rank}</span>
                                </div>
                                <RankBar
                                  style={barStyle}
                                  label={hasCutoff ? cutoff.toLocaleString() : "—"}
                                  percent={fills[rankIdx]?.percent ?? 0}
                                  color={hasRank ? color : null}
                                  cleared={cleared}
                                />
                                {isGated ? (
                                  <p className="mt-1 text-center text-[9px] font-medium text-red-400/80">
                                    needs {gate?.toLocaleString()}
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}

            {orderedCategories.length === 0 && (
              <p className="px-6 py-12 text-center text-zinc-500">No scenarios in this tier yet.</p>
            )}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            {/*
              Fixed layout: with auto layout every rank column was sized by its
              own header text ("AVERAGE-NOOB" wide, "NOOB" and "GOD" narrow), so
              the bars under them came out uneven. Fixed layout gives the
              Scenario and Best columns their set widths and splits the rest
              equally between the ranks. The minimum width keeps each rank column
              wide enough to read; below that the container scrolls sideways.
            */}
            <table
              className="w-full table-fixed text-left border-collapse [--sc-w:14rem] sm:[--sc-w:22rem]"
              style={{ minWidth: `calc(var(--sc-w) + 6rem + ${rankOrder.length * 7.5}rem)` }}
            >
              <colgroup>
                <col style={{ width: "var(--sc-w)" }} />
                <col style={{ width: "6rem" }} />
                {rankOrder.map((rank) => (
                  <col key={rank} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-line">
                  <th className="px-3 sm:px-6 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sticky left-0 z-20 bg-app">
                    Scenario
                  </th>
                  <th className="px-3 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                    Best
                  </th>
                  {rankOrder.map((rank, rankIdx) => (
                    <th key={rank} className="px-1.5 py-3.5">
                      <div className="flex flex-col items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rankColors[rankIdx] ?? "var(--accent)" }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{rank}</span>
                      </div>
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
                        <td colSpan={3 + rankOrder.length} className="relative p-0 border-b border-line bg-white/[0.02]">
                          {/* Sticky, so the category label travels with the scenario names
                              instead of scrolling off to the left. */}
                          <div className="sticky left-0 flex w-fit items-center gap-2 px-3 sm:px-6 py-3">
                            {def ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold"
                                style={{ color: def.color, borderColor: withAlpha(def.color, 0.5) }}
                              >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: def.color }} />
                                {cat}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500">{cat}</span>
                            )}
                          </div>
                          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-medium text-zinc-600">{catScenarios.length} scenario{catScenarios.length === 1 ? "" : "s"}</span>
                        </td>
                      </tr>

                      {catScenarios.map((scenario) => {
                        const score = scenarioScores.get(scenario.easyaim_scenario_id) ?? 0;
                        const gate = gatedByScenario.get(scenario.easyaim_scenario_id);
                        const isGated = gate != null && score === 0;

                        // How far through each rank's own gap the score has
                        // climbed (tierBars.ts), so cleared ranks read full,
                        // the next one partial and the rest empty.
                        const cutoffList = rankOrder.map((rank) => scenario.cutoffs?.[rank]);
                        const fills = computeTierFills(cutoffList, score);

                        // Until a first rank is cleared the climb is drawn grey;
                        // it takes the rank colours once there is a rank.
                        const hasRank = cutoffList.some(
                          (c) => typeof c === "number" && c > 0 && score >= c
                        );

                        return (
                          <tr key={scenario.id} className={`border-b border-line/50 hover:bg-white/[0.02] transition-colors ${isGated ? "bg-red-500/5" : ""}`}>
                            <td className="px-3 sm:px-6 py-3.5 align-middle sticky left-0 z-20 bg-app">
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                  <span className="text-base font-semibold text-text">{scenario.title}</span>
                                  {scenario.sub_category ? (
                                    <span className="text-xs text-zinc-400">{scenario.sub_category}</span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="hidden font-mono text-[10px] text-zinc-500 sm:inline">{scenario.easyaim_scenario_id}</span>
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                              <div className="flex items-baseline gap-2">
                                {isGated ? (
                                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-red-400">locked</span>
                                ) : (
                                  <>
                                    <span className="font-mono text-sm font-bold tracking-tight sm:text-base">{score ? score.toLocaleString() : "—"}</span>
                                    <span className="text-[10px] font-medium text-zinc-500">{score > 0 ? `${Math.round((score / (rankOrder.reduce((m, r) => Math.max(m, scenario.cutoffs?.[r] ?? 0), 0))) * 100)}% of top` : ""}</span>
                                  </>
                                )}
                              </div>
                            </td>

                            {rankOrder.map((rank, rankIdx) => {
                              const cutoff = scenario.cutoffs?.[rank] ?? null;
                              const hasCutoff = typeof cutoff === "number" && cutoff > 0;
                              const color = rankColors[rankIdx] ?? "var(--accent)";
                              const cleared = score > 0 && hasCutoff && score >= cutoff;

                              return (
                                <td key={rank} className="px-0.5 py-3 align-middle">
                                  <div className="flex flex-col items-center gap-1">
                                    <RankBar
                                      style={barStyle}
                                      label={hasCutoff ? cutoff.toLocaleString() : "—"}
                                      percent={fills[rankIdx]?.percent ?? 0}
                                      color={hasRank ? color : null}
                                      cleared={cleared}
                                    />
                                    {isGated && (
                                      <span className="text-[9px] text-red-400/80 font-medium">needs {gate?.toLocaleString()}</span>
                                    )}
                                  </div>
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
            <p className="text-xs text-zinc-500">Each rank cell shows its cutoff as a bar or badge. Filled color means the rank is cleared.</p>
          </div>
        </div>
      </div>
    </main>
  );
}