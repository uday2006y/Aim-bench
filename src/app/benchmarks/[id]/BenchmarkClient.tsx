"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
}

interface BenchmarkScenario {
  id: string;
  easyaim_scenario_id: number;
  title: string;
  position: number;
  cutoffs: Record<string, number>;
  best_score?: number;
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
  const [accent, setAccent] = useState("#b9f2fe");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("aimbench-theme");
      if (stored) {
        const t = JSON.parse(stored);
        if (t.accent) setAccent(t.accent);
      }
    } catch {
      // ignore
    }
  }, []);

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
      ? benchmark.rank_names
      : [
          "Bronze",
          "Silver",
          "Gold",
          "Platinum",
          "Diamond",
          "Champion",
          "Radiant",
          "Immortal",
        ];
  const hasScenarios = (scenarios || []).length > 0;

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <Link
          href="/benchmarks"
          className="text-sm text-zinc-500 hover:text-white transition inline-block mb-8"
        >
          ← Back to benchmarks
        </Link>
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                {benchmark.platform}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                {benchmark.difficulty}
              </span>
              {isAuthorized ? (
                <Link
                  href={`/benchmarks/${id}/edit`}
                  className="text-xs underline"
                  style={{ color: accent }}
                >
                  Edit benchmark
                </Link>
              ) : null}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              {benchmark.title}
            </h1>
            <p className="mt-3 text-zinc-400 text-base leading-relaxed max-w-2xl">
              {benchmark.description || "No description"}
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              {benchmark.scenario_count} scenario
              {benchmark.scenario_count === 1 ? "" : "s"}
            </p>
          </div>

          {hasScenarios && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-zinc-950 to-zinc-900/50">
                <h2 className="text-xl font-extrabold tracking-tight">
                  Scenarios
                </h2>
                <span className="text-xs text-zinc-500 font-medium">
                  {scenarios.length} attached
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-950/80 text-zinc-300 text-xs uppercase tracking-widest font-bold border-b border-white/5">
                    <tr>
                      <th className="text-left px-6 py-4 font-bold">Scenario</th>
                      <th className="text-left px-4 py-4 font-bold">Score</th>
                      {rankOrder.map((r: string) => (
                        <th
                          key={r}
                          className="text-center px-3 py-4 font-bold whitespace-nowrap"
                        >
                          {r}
                        </th>
                      ))}
                      <th className="text-left px-4 py-4 font-bold">Energy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((scenario: BenchmarkScenario) => {
                      const score = scenario.best_score ?? 0;
                      const cutoffs = scenario.cutoffs || {};
                      const rank =
                        rankOrder.length > 0
                          ? ((): string | null => {
                              let achieved: string | null = null;
                              for (let i = rankOrder.length - 1; i >= 0; i--) {
                                const needed = cutoffs[rankOrder[i]];
                                if (needed === undefined) continue;
                                if (score >= needed) {
                                  achieved = rankOrder[i];
                                  break;
                                }
                              }
                              return achieved;
                            })()
                          : null;
                      const sorted = rankOrder
                        .map((r: string) => cutoffs[r])
                        .filter((v): v is number => v !== undefined)
                        .sort((a: number, b: number) => a - b);
                      let lower = 0;
                      let upper = sorted[sorted.length - 1] || 0;
                      for (let i = 0; i < sorted.length; i++) {
                        if (score < sorted[i]) {
                          upper = sorted[i];
                          lower = i === 0 ? 0 : sorted[i - 1];
                          break;
                        }
                        lower = sorted[i];
                        upper = sorted[i];
                      }
                      const pct =
                        upper === lower ? 100 : Math.min(100, Math.max(0, ((score - lower) / (upper - lower)) * 100));
                      return (
                        <tr
                          key={scenario.id}
                          className="border-b border-white/[0.04] hover:bg-white/[0.03] transition"
                        >
                          <td className="px-6 py-5 whitespace-nowrap align-top">
                            <div className="flex items-start gap-3">
                              <span
                                className="inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: accent,
                                  color: "#0a0a0a",
                                  border: `1px solid ${accent}`,
                                }}
                              >
                                SCENARIO
                              </span>
                              <div>
                                <p className="font-bold text-white leading-snug">
                                  {scenario.title}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5 whitespace-nowrap align-top">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono font-extrabold text-white text-base">
                                {score}
                              </span>
                              <span className="text-xs text-zinc-500 font-medium">
                                {score > 0 ? Math.round(pct) + "%" : "0%"}
                              </span>
                            </div>
                          </td>
                          {rankOrder.map((r: string) => (
                            <td
                              key={r}
                              className="text-center px-3 py-5 align-top"
                            >
                              {cutoffs[r] !== undefined ? (
                                <div className="flex flex-col items-center gap-2">
                                  <span
                                    className={`text-[10px] font-extrabold tracking-wider uppercase`}
                                    style={{ color: score >= cutoffs[r] ? accent : "#6b7280" }}
                                  >
                                    {cutoffs[r]}
                                  </span>
                                  <div className="w-24 h-2.5 rounded-full bg-zinc-800 overflow-hidden shadow-inner relative">
                                    <div
                                      className={`h-full rounded-full ${score >= cutoffs[r] ? `shadow-[0_0_8px_rgba(34,211,238,0.4)]` : ""}`}
                                      style={{
                                        width: `${Math.min(100, Math.round((score / Math.max(cutoffs[r] || 1, 1)) * 100))}%`,
                                        backgroundColor: score >= cutoffs[r]
                                          ? benchmark.rank_colors?.[rankOrder.indexOf(r)] || "#b9f2fe"
                                          : "#27272a",
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-700">
                                  —
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-5 whitespace-nowrap align-top">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-base text-white">
                                {score}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!hasScenarios && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="text-xl font-bold tracking-tight mb-6">
                Rank Thresholds
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {benchmark.rank_thresholds &&
                  Object.entries(
                    benchmark.rank_thresholds || {}
                  )
                    .sort(([, a], [, b]) => (a as number) - (b as number))
                    .map(([rankName, threshold]) => (
                      <div
                        key={rankName}
                        className="rounded-2xl border border-white/10 bg-zinc-900 p-4 text-center"
                      >
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          {rankName}
                        </p>
                        <p className="text-xl font-extrabold text-white">
                          {threshold}+
                        </p>
                      </div>
                    ))}
              </div>
            </div>
          )}

          {!hasScenarios && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="text-xl font-bold tracking-tight mb-4">
                Submit a score
              </h2>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="Your score"
                  min="0"
                  className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500 transition"
                />
                <button
                  onClick={handleSubmitScore}
                  disabled={submitting}
                  className="rounded-xl bg-white px-6 py-3 font-semibold text-black hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
              {error && (
                <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                  {error}{" "}
                  {error.includes("logged in") && (
                    <Link href="/login" className="underline">
                      Log in
                    </Link>
                  )}
                </div>
              )}
              {notice && (
                <div className="mt-4 rounded-xl border border-green-900/50 bg-green-950/30 px-4 py-3 text-sm text-green-400">
                  {notice}
                </div>
              )}
            </div>
          )}

          {myScores.length > 0 && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="text-xl font-bold tracking-tight mb-4">
                Your attempts
              </h2>
              <div className="divide-y divide-white/5">
                {myScores.map((s: { id: string; score: number; rank: string | null; completed_at: string }) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-medium text-white">
                        {s.score}
                      </span>
                      <span className="text-sm text-zinc-400">
                        {s.rank || "—"}
                      </span>
                    </div>
                    <span className="text-sm text-zinc-600">
                      {new Date(s.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
