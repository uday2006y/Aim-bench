"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";

interface Benchmark {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  difficulty: string;
  rank_names: string[];
  rank_thresholds: Record<string, number>;
  scenario_count: number;
}

interface BenchmarkScenario {
  id: string;
  easyaim_scenario_id: number;
  title: string;
  position: number;
  cutoffs: Record<string, number>;
  best_score?: number;
}

interface ScoreEntry {
  id: string;
  score: number;
  rank: string | null;
  completed_at: string;
}

const FALLBACK_RANKS = [
  "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Champion", "Radiant", "Immortal",
];

function rankForScenario(
  score: number,
  cutoffs: Record<string, number>,
  rankOrder: string[]
): string | null {
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
}

function progressPercent(score: number, cutoffs: Record<string, number>, rankOrder: string[]) {
  const sorted = rankOrder
    .map((rank) => cutoffs[rank])
    .filter((v): v is number => v !== undefined)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  let lower = 0;
  let upper = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length; i++) {
    if (score < sorted[i]) {
      upper = sorted[i];
      lower = i === 0 ? 0 : sorted[i - 1];
      break;
    }
    lower = sorted[i];
    upper = sorted[i];
  }
  if (upper === lower) return 100;
  return Math.min(100, Math.max(0, ((score - lower) / (upper - lower)) * 100));
}

export default function BenchmarkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [scenarios, setScenarios] = useState<BenchmarkScenario[]>([]);
  const [myScores, setMyScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scoreInput, setScoreInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBenchmark = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/benchmarks/${id}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setBenchmark(data.benchmark);
      setScenarios(data.scenarios || []);
    } catch (err) {
      console.error("Failed to load benchmark:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMyScores = useCallback(async () => {
    try {
      const res = await fetch(`/api/scores?benchmark_id=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setMyScores(data.scores || []);
    } catch (err) {
      console.error("Failed to load scores:", err);
    }
  }, [id]);

  useEffect(() => {
    loadBenchmark();
    loadMyScores();
  }, [loadBenchmark, loadMyScores]);

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
      loadMyScores();
    } catch {
      setError("Could not connect to the server");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-500">
        <p>Loading...</p>
      </main>
    );
  }
  if (notFound || !benchmark) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-white">
        <div className="text-center">
          <p className="text-zinc-400">Benchmark not found.</p>
          <Link href="/benchmarks" className="mt-4 inline-block text-sm hover:underline">← Back to benchmarks</Link>
        </div>
      </main>
    );
  }

  const rankOrder = benchmark.rank_names?.length ? benchmark.rank_names : FALLBACK_RANKS;
  const hasScenarios = scenarios.length > 0;

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <Link href="/benchmarks" className="text-sm text-zinc-500 hover:text-white transition inline-block mb-8">
          ← Back to benchmarks
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">{benchmark.platform}</span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">{benchmark.difficulty}</span>
                <Link href={`/benchmarks/${id}/edit`} className="text-xs text-cyan-400 hover:text-cyan-300 underline">Edit benchmark</Link>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight">{benchmark.title}</h1>
              <p className="mt-3 text-zinc-400 text-base leading-relaxed max-w-2xl">{benchmark.description || "No description"}</p>
              <p className="mt-2 text-sm text-zinc-600">{benchmark.scenario_count} scenario{benchmark.scenario_count === 1 ? "" : "s"}</p>
            </div>

            {/* Scenario Ranking Table — evxl.app style */}
            {hasScenarios && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight">Scenarios</h2>
                  <span className="text-xs text-zinc-500">{scenarios.length} attached</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-6 py-3 font-medium">Scenario</th>
                        <th className="text-left px-4 py-3 font-medium">Score</th>
                        {rankOrder.map((r) => (
                          <th key={r} className="text-center px-3 py-3 font-medium whitespace-nowrap">{r}</th>
                        ))}
                        <th className="text-left px-4 py-3 font-medium">Energy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((scenario) => {
                        const score = scenario.best_score ?? 0;
                        const rank = rankForScenario(score, scenario.cutoffs, rankOrder);
                        const pct = progressPercent(score, scenario.cutoffs, rankOrder);
                        const cleared = rank !== null;
                        return (
                          <tr key={scenario.id} className="border-b border-white/5 hover:bg-white/[0.015] transition">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-white">{scenario.title}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-zinc-300 font-mono text-sm">{score}</td>
                            {rankOrder.map((r) => (
                              <td key={r} className="text-center px-3 py-4">
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`text-xs font-bold ${scenario.cutoffs[r] !== undefined ? (score >= scenario.cutoffs[r] ? "text-cyan-400" : "text-zinc-600") : "text-zinc-700"}`}>
                                    {scenario.cutoffs[r] !== undefined ? scenario.cutoffs[r] : "—"}
                                  </span>
                                  {scenario.cutoffs[r] !== undefined && (
                                    <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${score >= scenario.cutoffs[r] ? "bg-gradient-to-r from-cyan-500 to-cyan-300" : "bg-zinc-600"}`}
                                        style={{ width: `${Math.min(100, Math.round((score / Math.max(scenario.cutoffs[r] || 1, 1)) * 100))}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                            ))}
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-zinc-500 font-mono">{score}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Non-scenario benchmark info */}
            {!hasScenarios && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
                <h2 className="text-xl font-bold tracking-tight mb-6">Rank Thresholds</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {benchmark.rank_thresholds && Object.entries(benchmark.rank_thresholds).sort(([, a], [, b]) => (a as number) - (b as number)).map(([rankName, threshold]) => (
                    <div key={rankName} className="rounded-2xl border border-white/10 bg-zinc-900 p-4 text-center">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">{rankName}</p>
                      <p className="text-xl font-extrabold text-white">{threshold}+</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Score Submission */}
            {!hasScenarios && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
                <h2 className="text-xl font-bold tracking-tight mb-4">Submit a score</h2>
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
                    {error.includes("logged in") && <Link href="/login" className="underline">Log in</Link>}
                  </div>
                )}
                {notice && (
                  <div className="mt-4 rounded-xl border border-green-900/50 bg-green-950/30 px-4 py-3 text-sm text-green-400">
                    {notice}
                  </div>
                )}
              </div>
            )}

            {/* Score History */}
            {myScores.length > 0 && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
                <h2 className="text-xl font-bold tracking-tight mb-4">Your attempts</h2>
                <div className="divide-y divide-white/5">
                  {myScores.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-medium text-white">{s.score}</span>
                        <span className="text-sm text-zinc-400">{s.rank || "—"}</span>
                      </div>
                      <span className="text-sm text-zinc-600">{new Date(s.completed_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
