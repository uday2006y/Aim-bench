"use client";

import Link from "next/link";
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
      <dd
        className={`mt-1 truncate text-xl font-extrabold tracking-tight ${
          capitalize ? "capitalize" : ""
        }`}
      >
        {value}
      </dd>
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
  /** The tier being viewed. Its ladder names and colours drive every column. */
  tier: Tier;
  /** Every tier on this benchmark, for the switcher. */
  tiers: Tier[];
  scenarios: BenchmarkScenario[];
  isAuthorized: boolean;
  myPinned: boolean;
  loggedIn: boolean;
  /**
   * Scenarios in this tier that have not started tracking yet, each with the
   * score it is waiting on.
   *
   * Gating is per scenario, not per tier: a row opens once that same scenario
   * cleared the previous tier's final rank. So this is a list of rows, not a
   * single flag for the whole tier.
   */
  gatedRows?: { easyaim_scenario_id: string; waitingFor: number | null }[];
  /** Name of the tier before this one, for the wording. Null on the first tier. */
  previousTierName?: string | null;
}) {
  // The stored preference, read as a subscription rather than copied into
  // state on mount. Remounting this component for a different benchmark
  // re-reads it for free, which is what the old effect's [id] dependency was
  // doing by hand.
  const [barStyle] = useBarStyle();

  /**
   * Scenario ids in this tier that have not started tracking yet.
   *
   * A Set, because the table asks once per row per render and the list is
   * looked up by id rather than scanned.
   */
  const gated = new Set(gatedRows.map((row) => row.easyaim_scenario_id));

  /** What a row is waiting on, for its tooltip. Null when ungated. */
  const waitingFor = new Map(
    gatedRows.map((row) => [row.easyaim_scenario_id, row.waitingFor] as const)
  );

  /**
   * The ladder for this tier.
   *
   * Read from the tier rather than the benchmark: that is the whole point of
   * tiers. Novice can be Iron → Bronze → Silver → Gold while Elite is Nova →
   * Astra → Celestial, off the same scenarios, and the columns below have to
   * change with it.
   */
  const rankOrder = tier.rank_names.map((name, i) => ({
    name,
    color: tier.rank_colors?.[i] || "#b87333",
  }));

  const hasScenarios = (scenarios || []).length > 0;

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

  // Numbers for the header tiles. Display only: read from the same inputs
  // the table uses, never saved or sent anywhere.
  const summary = (() => {
    const topRankName = rankOrder[rankOrder.length - 1]?.name;
    let tracked = 0;
    let scored = 0;
    let topCleared = 0;

    for (const scenario of scenarios) {
      if (gated.has(String(scenario.easyaim_scenario_id))) continue;

      tracked += 1;
      const score = scenario.best_score ?? 0;
      if (score > 0) scored += 1;

      const top = topRankName ? scenario.cutoffs?.[topRankName] : undefined;
      if (typeof top === "number" && top > 0 && score >= top) topCleared += 1;
    }

    return { tracked, scored, topCleared, topRankName };
  })();

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
          };
        })
        .filter((group) => group.rows.length > 0);

      return {
        category: categoryName,
        color: getCategoryColor(categoryName),
        rowCount: inCategory.length,
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
    <main className="min-h-screen text-white benchmark-detail-page">
      <div className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        {/* Top nav bar. The benchmark table is reached from the benchmark
            list, so Back goes there rather than to the home page. */}
        <nav className="mb-5 flex items-center justify-between px-1">
          <Link
            href="/benchmarks"
            className="group inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            Back
          </Link>
        </nav>

        {/* Benchmark header */}
        <header className="animate-card-in card relative mb-5 overflow-hidden p-5 sm:mb-6 sm:p-7">
          {/* The ladder as a thin strip across the top, in the tier's own
              colours, so each tier carries its identity into the header. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1">
            {rankOrder.map((rank, index) => (
              <span
                key={`${rank.name}-${index}`}
                className="flex-1"
                style={{ backgroundColor: rank.color }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="eyebrow">
                {benchmark.platform === "easyaim" ? "EasyAim" : benchmark.platform}{" "}
                benchmark
              </p>

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-4xl">
                {benchmark.title || "Benchmark"}
              </h1>

              {benchmark.description ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  {benchmark.description}
                </p>
              ) : null}

            </div>

            {/* Star sits with the title rather than the Edit button: it is
                something any visitor can do, so it must not read as part of
                the owner's controls. */}
            <div className="flex items-start gap-3">
              <PinButton
                benchmarkId={id}
                pinned={myPinned}
                loggedIn={loggedIn}
                size="md"
              />
              {loggedIn ? <SyncBenchmarkButton benchmarkId={id} /> : null}
              {isAuthorized ? (
                <Link
                  href={`/benchmarks/${id}/edit?tab=${encodeURIComponent(tier.slug)}`}
                  className="btn btn-primary px-4 py-2 text-xs"
                >
                  Edit Benchmark
                </Link>
              ) : null}
            </div>
          </div>

          {hasScenarios ? (
            <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Scenarios" value={String(scenarios.length)} />
              <Stat label="Categories" value={String(groups.length)} />
              {loggedIn ? (
                <>
                  <Stat
                    label="Scored"
                    value={`${summary.scored} / ${summary.tracked}`}
                    hint="scenarios you have played"
                  />
                  <Stat
                    label="Top rank cleared"
                    value={String(summary.topCleared)}
                    hint={summary.topRankName}
                  />
                </>
              ) : (
                <>
                  <Stat label="Tiers" value={String(tiers.length)} />
                  <Stat
                    label="Difficulty"
                    value={benchmark.difficulty || "medium"}
                    capitalize
                  />
                </>
              )}
            </dl>
          ) : null}

          {/* The ladder in order, so the colours in the table below have a
              key and the climb reads left to right. */}
          {rankOrder.length > 0 ? (
            <ol
              aria-label="Rank ladder"
              className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] font-semibold uppercase tracking-wider"
            >
              {rankOrder.map((rank, index) => (
                <li key={`${rank.name}-${index}`} className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: rank.color }}
                    />
                    <span style={{ color: rank.color }}>{rank.name}</span>
                  </span>
                  {index < rankOrder.length - 1 ? (
                    <span aria-hidden="true" className="text-zinc-700">
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          {/* The switcher. Below the title rather than beside it because the
              benchmark title is variable length and the pills are not: side by
              side, a long title would push the switcher into a second row at a
              width where it still had room. */}
          {tiers.length > 1 ? (
            <div className="mt-5 border-t border-line pt-5">
              <TierSwitcher benchmarkId={id} tiers={tiers} activeSlug={tier.slug} />
            </div>
          ) : null}

          {/* Tiers are worked in order, and it is per scenario: a row here starts
              tracking once that same scenario cleared the previous tier's final
              rank. Rows that have not show no score. */}
          {gatedRows.length > 0 ? (
            <div className="mt-4 rounded-xl border border-line bg-white/[0.03] px-4 py-3 text-xs leading-5 text-zinc-400">
              {gatedRows.length === 1
                ? "1 scenario has not"
                : `${gatedRows.length} scenarios have not`}{" "}
              started tracking in {tier.name}
              {previousTierName ? (
                <>
                  {" "}
                  yet — each one opens when it passes {previousTierName}&apos;s
                  final rank.
                </>
              ) : null}
            </div>
          ) : null}

          {isAuthorized && ranksWithNoCutoffs.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-xs leading-5 text-amber-300/90">
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
        </header>

        {/* Scenario table. A tier with no scenarios yet is a normal state
            (the author is mid-build), so it says so instead of rendering an
            empty frame. */}
        {!hasScenarios && isAuthorized ? (
          <div className="mb-6 rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
            <p className="text-sm text-zinc-500">
              This tier has no scenarios yet, so nothing can be scored against it.
            </p>
            <Link
              href={`/benchmarks/${id}/edit?tab=${encodeURIComponent(tier.slug)}`}
              className="btn btn-primary mt-5"
            >
              Add scenarios to {tier.name}
            </Link>
          </div>
        ) : null}

        {hasScenarios && (
          <div className="animate-fade-in card overflow-hidden">
            <p className="border-b border-line px-4 py-2 text-[11px] text-zinc-600 md:hidden">
              Swipe sideways to see every rank.
            </p>
            <div className="overflow-x-auto">
              {/* table-fixed, because under the default auto layout every
                  column sizes itself to its own header text: CHAMPION is
                  eight characters and BRONZE is six, so the bars came out
                  different widths and the ladder did not read as a ladder.

                  The rank columns are deliberately left with no width. Under
                  fixed layout, columns that specify no width split what is
                  left over equally, so they stay identical at any ladder
                  length and any screen size. Pinning them to a fixed
                  150px each looked right at six rungs and overflowed at
                  eight, squeezing the scenario name to zero width. The
                  columns that do have a fixed width are the ones whose
                  content is a known length. */}
              {/* min-width sized so the widest default ladder — eight
                  rungs — still gets a column wide enough for its cutoff
                  number. Below this the table scrolls sideways, which it
                  already did. */}
              <table
                className="w-full table-fixed border-collapse text-xs"
                style={{ minWidth: `${480 + rankOrder.length * 112}px` }}
              >
                <thead className="border-b border-line bg-white/[0.03] text-[11px] font-extrabold uppercase tracking-[0.14em] text-zinc-400">
                  <tr>
                    {/* Spacers for the vertical category / sub-category rails */}
                    <th className="w-6" />
                    <th className="w-6" />
                    <th className="w-[190px] px-3 py-4 text-left whitespace-nowrap sm:w-[260px] sm:px-4">SCENARIO</th>
                    <th className="w-[120px] px-3 py-4 text-left whitespace-nowrap sm:w-[168px]">SCORE</th>
                    {rankOrder.map((r) => (
                      <th
                        key={r.name}
                        className="text-center px-2 py-4 whitespace-nowrap text-[11px] tracking-[0.14em]"
                        style={{ color: r.color }}
                      >
                        <span
                          className="inline-block border-b-2 pb-1"
                          style={{ borderColor: r.color }}
                        >
                          {r.name.toUpperCase()}
                        </span>
                      </th>
                    ))}
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
                        // A scenario that has not cleared the previous tier's final rank reports no
                        // score at all. Reading the real best here would draw a
                        // filled bar, which is the out-of-order progress the
                        // gate exists to hide.
                        const scenarioId = String(scenario.easyaim_scenario_id);
                        const isGated = gated.has(scenarioId);
                        const gate = waitingFor.get(scenarioId) ?? null;
                        const score = isGated ? 0 : scenario.best_score ?? 0;
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

                        // One pass for the whole row, rather than walking the
                        // ladder again inside every cell.
                        const fills = computeTierFills(
                          rankOrder.map(
                            (rank) => scenario.cutoffs?.[rank.name] ?? null
                          ),
                          score
                        ).map((fill) => fill.percent);
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
                            ? "border-t-2 border-t-white"
                            : "";

                        // A quieter rule where one sub-category ends and the
                        // next begins, so FLICK and CLICKING read as two groups
                        // rather than one long list. 20% white: visible without
                        // competing with the category rule above it, which is a
                        // heavier 70% because categories are the coarser split.
                        //
                        // Not on the first sub-group of a category -- that
                        // boundary is already drawn by groupDivider, and two
                        // stacked borders would read as one thick line.
                        const subDivider =
                          rowIdx === 0 && subIdx > 0
                            ? "border-t border-t-white/20"
                            : "";

                        return (
                          <tr
                            key={scenario.id}
                            className="animate-row-in border-b border-line last:border-b-0 transition-colors hover:bg-white/[0.05]"
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
                                className={`border-r border-zinc-800/40 px-1 py-2 align-middle ${isGroupStart ? groupDivider : ""} ${isSubStart ? subDivider : ""}`}
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

                            <td className={`px-3 py-2.5 align-middle sm:px-4 ${rowIdx === 0 ? groupDivider : ""} ${subDivider}`}>
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

                            <td className={`px-3 py-2.5 align-middle whitespace-nowrap ${rowIdx === 0 ? groupDivider : ""} ${subDivider}`}>
                              <div className="flex items-baseline gap-2">
                                <span
                                  className="font-mono text-sm font-bold tracking-tight sm:text-base"
                                  style={{ color: scoreColor || "#ffffff" }}
                                >
                                  {score ? score.toLocaleString() : "—"}
                                </span>
                                <span className="text-[10px] font-medium text-zinc-500">
                                  {isGated && gate ? (
                                    <span
                                      title={`Pass ${gate.toLocaleString()} to start tracking this tier`}
                                      className="text-zinc-600"
                                    >
                                      needs {gate.toLocaleString()}
                                    </span>
                                  ) : (
                                    pctStr
                                  )}
                                </span>
                              </div>
                            </td>

                            {rankOrder.map((rank, rankIdx) => {
                              const cutoff = scenario.cutoffs?.[rank.name];
                              const hasCutoff =
                                typeof cutoff === "number" && cutoff > 0;
                              const fillPct = fills[rankIdx];

                              return (
                                <td
                                  key={rank.name}
                                  className={`px-1.5 py-2 align-middle ${rowIdx === 0 ? groupDivider : ""} ${subDivider}`}
                                >
                                  <div className={`bar-track bar-${barStyle}`}>
                                    {hasCutoff && score > 0 && (
                                      <div
                                        className="bar-fill"
                                        style={{
                                          width: `${fillPct}%`,
                                          backgroundColor: rank.color,
                                        }}
                                      />
                                    )}
                                    <span className="bar-label">
                                      {hasCutoff ? cutoff.toLocaleString() : "—"}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
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
