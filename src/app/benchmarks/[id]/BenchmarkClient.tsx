"use client";

import { useState } from "react";
import Link from "next/link";

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
  easyaim_scenario_id: number;
  title: string;
  position: number;
  category: string;
  sub_category?: string;
  cutoffs: Record<string, number>;
  best_score?: number;
}

const DEFAULT_CATEGORY = "Other";

/**
 * Turns a #rgb / #rrggbb colour into rgba() so we can reuse a category's
 * colour for its tinted label background. Falls back to a neutral grey for
 * anything unparseable rather than emitting broken CSS.
 */
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

export default function BenchmarkClient({
  id,
  benchmark,
  scenarios,
  myScores,
  isAuthorized,
}: {
  id: string;
  benchmark: Benchmark;
  scenarios: BenchmarkScenario[];
  myScores: { id: string; score: number; rank: string | null; completed_at: string }[];
  isAuthorized: boolean;
}) {
  const [scoreInput, setScoreInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmitScore() {
    setError("");
    setNotice("");
    const score = Number(scoreInput);
    if (!scoreInput || !Number.isFinite(score) || score < 0) {
      setError("Enter a valid score (0 or higher)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benchmarkId: id, score }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit score");
        return;
      }
      setNotice(
        `Score submitted: ${data.score.score}${
          data.score.rank ? ` — ${data.score.rank}` : ""
        }`
      );
      setScoreInput("");
      window.location.reload();
    } catch {
      setError("Could not connect to the server");
    } finally {
      setSubmitting(false);
    }
  }

  const rankOrder =
    benchmark.rank_names?.length
      ? benchmark.rank_names.map((name, i) => ({
          name,
          color: benchmark.rank_colors?.[i] || "#b87333",
        }))
      : [
          { name: "Bronze", color: "#b87333" },
          { name: "Silver", color: "#c0c0c0" },
          { name: "Gold", color: "#ffd700" },
          { name: "Platinum", color: "#e5e4e2" },
          { name: "Diamond", color: "#b9f2fe" },
          { name: "Champion", color: "#ffd700" },
          { name: "Radiant", color: "#ff0000" },
          { name: "Immortal", color: "#9f9f9f" },
        ];

  const hasScenarios = (scenarios || []).length > 0;
  const totalEnergy = scenarios.reduce((sum, s) => sum + (s.best_score ?? 0), 0);

  // A rank with no cutoff on any scenario can never be achieved, because
  // the aggregate walk treats a missing cutoff as "this scenario doesn't
  // count" and a rank is only granted when every scenario clears it.
  // Flag it rather than rendering a column of em-dashes with no
  // explanation.
  const ranksWithNoCutoffs = rankOrder
    .filter((rank) =>
      scenarios.every((scenario) => {
        const cutoff = scenario.cutoffs?.[rank.name];
        return !(typeof cutoff === "number" && cutoff > 0);
      })
    )
    .map((rank) => rank.name);

  function getCategoryColor(catName: string): string {
    const def = benchmark.category_defs?.find((c) => c.name === catName);
    return def?.color || "#7a7a7a";
  }

  // Categories render in the order the benchmark defines them, then any
  // category a scenario actually uses that isn't in category_defs. Same
  // idea for sub-categories inside each category. Previously this grouped
  // with one fallback string and filtered with another, so scenarios with
  // a blank category were built into the list and then silently dropped.
  const categoryOrder = (() => {
    const declared = (benchmark.category_defs ?? []).map((c) => c.name);
    const used = Array.from(
      new Set(scenarios.map((s) => s.category || DEFAULT_CATEGORY))
    );

    return [
      ...declared.filter((name) => used.includes(name)),
      ...used.filter((name) => !declared.includes(name)),
    ];
  })();

  const groups = categoryOrder
    .map((categoryName) => {
      const inCategory = scenarios.filter(
        (s) => (s.category || DEFAULT_CATEGORY) === categoryName
      );

      const declaredSubs =
        benchmark.category_defs?.find((c) => c.name === categoryName)
          ?.subCategories ?? [];
      const usedSubs = Array.from(
        new Set(inCategory.map((s) => s.sub_category || ""))
      );

      const subOrder = [
        ...declaredSubs.filter((s) => usedSubs.includes(s)),
        ...usedSubs.filter((s) => !declaredSubs.includes(s)),
      ];

      const subGroups = subOrder
        .map((subName) => {
          const rows = inCategory.filter(
            (s) => (s.sub_category || "") === subName
          );
          return {
            sub: subName,
            rows,
            energy: rows.reduce((sum, s) => sum + (s.best_score ?? 0), 0),
          };
        })
        .filter((group) => group.rows.length > 0);

      return {
        category: categoryName,
        color: getCategoryColor(categoryName),
        rowCount: inCategory.length,
        energy: inCategory.reduce((sum, s) => sum + (s.best_score ?? 0), 0),
        subGroups,
      };
    })
    .filter((group) => group.rowCount > 0);

  // Row offset for the staggered load-in animation. Precomputed rather
  // than a mutable counter during render, so the markup stays a pure
  // function of props.
  const rowOffsets = groups.map((group, index) => {
    const before = groups
      .slice(0, index)
      .reduce((sum, g) => sum + g.rowCount, 0);
    const subOffsets = group.subGroups.map((_, subIndex) =>
      group.subGroups
        .slice(0, subIndex)
        .reduce((sum, g) => sum + g.rows.length, 0)
    );
    return { before, subOffsets };
  });

  return (
    <main className="min-h-screen bg-app text-white">
      <div className="mx-auto max-w-full px-4 py-6">
        {/* Top nav bar */}
        <div className="mb-6 flex items-center justify-between px-2">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            Back
          </Link>
        </div>

        {/* Benchmark header */}
        <div className="animate-card-in mb-6 rounded-2xl border border-zinc-800 bg-surface p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {benchmark.title || "Benchmark"}
            </h1>
            {isAuthorized ? (
              <Link
                href={`/benchmarks/${id}/edit`}
                className="rounded bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-zinc-200"
              >
                Edit Benchmark
              </Link>
            ) : null}
          </div>

          {hasScenarios && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] uppercase tracking-wider text-zinc-500">
              <span>
                {scenarios.length} scenario{scenarios.length === 1 ? "" : "s"}
              </span>
              <span>{groups.length} categor{groups.length === 1 ? "y" : "ies"}</span>
              <span>
                Total energy{" "}
                <span className="font-mono text-zinc-300">
                  {totalEnergy.toLocaleString()}
                </span>
              </span>
            </div>
          )}

          {isAuthorized && ranksWithNoCutoffs.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-300/90">
              No score cutoffs are set for{" "}
              <span className="font-semibold">
                {ranksWithNoCutoffs.join(", ")}
              </span>
              , so{" "}
              {ranksWithNoCutoffs.length === 1 ? "that rank can" : "those ranks can"}{" "}
              never be reached. Add a required score per scenario to unlock{" "}
              {ranksWithNoCutoffs.length === 1 ? "it" : "them"}.
            </div>
          )}
        </div>

        {/* Scenario table */}
        {hasScenarios && (
          <div className="animate-fade-in overflow-hidden rounded-2xl border border-zinc-800 bg-raised shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs min-w-[1200px]">
                <thead className="border-b border-zinc-800 bg-app text-[10px] font-extrabold uppercase tracking-wider text-zinc-300">
                  <tr>
                    {/* Spacers for the vertical category / sub-category rails */}
                    <th className="w-6" />
                    <th className="w-6" />
                    <th className="text-left px-4 py-3 whitespace-nowrap">SCENARIO</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">SCORE</th>
                    {rankOrder.map((r) => (
                      <th
                        key={r.name}
                        className="text-center px-2 py-3 whitespace-nowrap text-[10px] tracking-wide"
                        style={{ color: r.color }}
                      >
                        {r.name.toUpperCase()}
                      </th>
                    ))}
                    <th className="text-left px-3 py-3 whitespace-nowrap">ENERGY</th>
                  </tr>
                </thead>

                {groups.map((group, groupIdx) => (
                  <tbody
                    key={group.category}
                    className={
                      groupIdx % 2 === 0 ? "bg-white/[0.015]" : "bg-transparent"
                    }
                  >
                    {group.subGroups.map((subGroup, subIdx) => {
                      const groupRows = subGroup.rows.length;

                      return subGroup.rows.map((scenario, rowIdx) => {
                        const score = scenario.best_score ?? 0;
                        const staggerIndex =
                          rowOffsets[groupIdx].before +
                          rowOffsets[groupIdx].subOffsets[subIdx] +
                          rowIdx;

                        const topCutoff = Math.max(
                          ...Object.values(scenario.cutoffs || {}).filter(
                            (v): v is number => typeof v === "number" && v > 0
                          ),
                          1
                        );
                        const pctStr = score
                          ? `${Math.min(100, Math.round((score / topCutoff) * 100))}%`
                          : "—";

                        // Colour the score with the highest rank it actually
                        // clears, so a 2,394 that beats the Platinum cutoff
                        // reads as Platinum rather than plain white.
                        let achieved = -1;
                        rankOrder.forEach((rank, index) => {
                          const cutoff = scenario.cutoffs?.[rank.name];
                          if (
                            typeof cutoff === "number" &&
                            cutoff > 0 &&
                            score >= cutoff
                          ) {
                            achieved = index;
                          }
                        });
                        const scoreColor =
                          achieved >= 0 ? rankOrder[achieved].color : undefined;

                        const isGroupStart = subIdx === 0 && rowIdx === 0;
                        const isSubStart = rowIdx === 0;

                        // A white rule between categories. It has to live on
                        // the cells rather than the <tbody>, because the table
                        // uses border-collapse: collapse, where a border on a
                        // row group is not painted. Each cell of the first row
                        // carries it so the line spans the full width,
                        // including the row-spanning category rail.
                        const groupDivider =
                          groupIdx > 0
                            ? "border-t-2 border-t-white/70"
                            : "";

                        return (
                          <tr
                            key={scenario.id}
                            className="animate-row-in border-b border-zinc-800/40 last:border-b-0 transition-colors hover:bg-white/[0.04]"
                            style={{ animationDelay: `${Math.min(staggerIndex, 14) * 22}ms` }}
                          >
                            {isGroupStart && (
                              <td
                                rowSpan={group.rowCount}
                                className={`border-r border-zinc-800/40 px-1 py-2 align-middle ${groupDivider}`}
                              >
                                <span
                                  className="inline-flex items-center justify-center rounded-sm border px-1 py-2 text-[9px] font-extrabold uppercase tracking-[0.2em]"
                                  style={{
                                    writingMode: "vertical-rl",
                                    textOrientation: "mixed",
                                    color: group.color,
                                    borderColor: group.color,
                                    backgroundColor: withAlpha(group.color, 0.1),
                                  }}
                                >
                                  {group.category.toUpperCase()}
                                </span>
                              </td>
                            )}

                            {isSubStart && (
                              <td
                                rowSpan={groupRows}
                                className={`border-r border-zinc-800/40 px-1 py-2 align-middle ${isGroupStart ? groupDivider : ""}`}
                              >
                                {subGroup.sub ? (
                                  <span
                                    className="inline-flex items-center justify-center rounded-sm border px-1 py-2 text-[9px] font-bold uppercase tracking-[0.15em]"
                                    style={{
                                      writingMode: "vertical-rl",
                                      textOrientation: "mixed",
                                      color: withAlpha(group.color, 0.85),
                                      borderColor: withAlpha(group.color, 0.35),
                                      backgroundColor: "transparent",
                                    }}
                                  >
                                    {subGroup.sub.toUpperCase()}
                                  </span>
                                ) : null}
                              </td>
                            )}

                            <td className={`px-4 py-2.5 align-middle ${rowIdx === 0 ? groupDivider : ""}`}>
                              <div className="flex min-w-[160px] flex-col gap-0.5">
                                <span className="truncate text-sm font-semibold leading-tight text-white">
                                  {scenario.title}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-zinc-500">
                                    {scenario.easyaim_scenario_id}
                                  </span>
                                  <span className="text-[9px] text-zinc-600">▶</span>
                                </div>
                              </div>
                            </td>

                            <td className={`px-3 py-2.5 align-middle whitespace-nowrap ${rowIdx === 0 ? groupDivider : ""}`}>
                              <div className="flex items-baseline gap-2">
                                <span
                                  className="font-mono text-base font-bold tracking-tight"
                                  style={{ color: scoreColor || "#ffffff" }}
                                >
                                  {score ? score.toLocaleString() : "—"}
                                </span>
                                <span className="text-[10px] font-medium text-zinc-500">
                                  {pctStr}
                                </span>
                              </div>
                            </td>

                            {rankOrder.map((rank) => {
                              const cutoff = scenario.cutoffs?.[rank.name];
                              const hasCutoff =
                                typeof cutoff === "number" && cutoff > 0;
                              const fillPct = hasCutoff
                                ? Math.min(
                                    100,
                                    Math.max(0, Math.round((score / cutoff) * 100))
                                  )
                                : 0;

                              return (
                                <td
                                  key={rank.name}
                                  className={`px-1.5 py-2 align-middle min-w-[100px] ${rowIdx === 0 ? groupDivider : ""}`}
                                >
                                  <div className="relative h-6 w-full overflow-hidden rounded-[3px] border border-white/[0.06] bg-white/[0.04]">
                                    {hasCutoff && score > 0 && (
                                      <div
                                        className="absolute inset-y-0 left-0 transition-all"
                                        style={{
                                          width: `${fillPct}%`,
                                          backgroundColor: rank.color,
                                          // Slanted right edge instead of a
                                          // rounded cap, evxl-style.
                                          clipPath:
                                            "polygon(0 0, calc(100% + 12px) 0, 100% 100%, 0 100%)",
                                        }}
                                      />
                                    )}
                                    <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-mono font-bold text-white">
                                      {hasCutoff ? cutoff.toLocaleString() : "—"}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}

                            {isSubStart && (
                              <td
                                rowSpan={groupRows}
                                className={`px-3 py-2.5 whitespace-nowrap align-middle ${isGroupStart ? groupDivider : ""}`}
                              >
                                <span
                                  className="font-mono text-sm font-bold"
                                  style={{ color: withAlpha(group.color, 0.95) }}
                                >
                                  {subGroup.energy.toLocaleString()}
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
