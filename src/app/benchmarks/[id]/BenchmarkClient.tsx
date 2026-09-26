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
  category: string;
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

  // Aggregate energy = sum of best scores for this benchmark's scenarios
  const totalEnergy = scenarios.reduce((sum, s) => sum + (s.best_score ?? 0), 0);

  // Group scenarios by category
  const categories = Array.from(new Set(scenarios.map((s) => s.category || "Other")));

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <Link href="/benchmarks" className="text-sm text-zinc-500 hover:text-white transition inline-block mb-8">
          ← Back to benchmarks
        </Link>
        <div className="space-y-6">
          {/* HEADER CARD */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 shadow-2xl">
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
                  className="text-xs underline hover:text-white transition"
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

          {/* SCENARIO TABLE — evxl.app exact style */}
          {hasScenarios && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-zinc-950 to-zinc-900/50">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center rounded px-2 py-0.5 text-[9px] font-extrabold tracking-[0.2em] uppercase"
                    style={{
                      backgroundColor: accent,
                      color: "#0a0a0a",
                      border: `1px solid ${accent}`,
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      letterSpacing: "0.15em",
                      padding: "0.35rem 0.15rem",
                    }}
                  >
                    SCENARIO
                  </span>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Scenarios
                  </h2>
                </div>
                <span className="text-xs text-zinc-500 font-medium">
                  {scenarios.length} attached
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-950/80 text-zinc-300 text-[10px] uppercase tracking-[0.15em] font-extrabold border-b border-white/5">
                    <tr>
                      <th className="text-left px-5 py-3 font-bold whitespace-nowrap">Scenario</th>
                      <th className="text-left px-3 py-3 font-bold whitespace-nowrap">Score</th>
                      {rankOrder.map((r: string) => (
                        <th key={r} className="text-center px-3 py-3 font-bold whitespace-nowrap text-[10px] tracking-[0.1em]">
                          {r}
                        </th>
                      ))}
                      <th className="text-left px-3 py-3 font-bold whitespace-nowrap">Energy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => {
                      const catScenarios = scenarios.filter((s) => (s.category || "Other") === cat);
                      return (
                        <>
                          {/* Category label row */}
                          <tr key={`cat-${cat}`} className="bg-zinc-900/40 border-b border-white/[0.03]">
                            <td colSpan={2 + rankOrder.length + 1} className="px-5 py-2">
                              <span
                                className="inline-block rounded px-2 py-0.5 text-[9px] font-extrabold tracking-[0.15em] uppercase"
                                style={{
                                  backgroundColor: accent,
                                  color: "#0a0a0a",
                                  border: `1px solid ${accent}`,
                                }}
                              >
                                {cat}
                              </span>
                            </td>
                          </tr>
                          {/* Scenario rows */}
                          {catScenarios.map((scenario: BenchmarkScenario) => {
                            const score = scenario.best_score ?? 0;
                            const cutoffs = scenario.cutoffs || {};
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
                            const pct = upper === lower ? 100 : Math.min(100, Math.max(0, ((score - lower) / (upper - lower)) * 100));
                            return (
                              <tr key={scenario.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition">
                                <td className="px-5 py-4 whitespace-nowrap align-top">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className="inline-block rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.15em] shrink-0"
                                      style={{
                                        backgroundColor: accent,
                                        color: "#0a0a0a",
                                        border: `1px solid ${accent}`,
                                      }}
                                    >
                                      SCENARIO
                                    </span>
                                    <p className="font-bold text-white text-sm leading-snug truncate max-w-[200px]">
                                      {scenario.title}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap align-top">
                                  <div className="flex flex-col gap-0.5 min-w-[80px]">
                                    <span className="font-mono font-extrabold text-white text-base">{score}</span>
                                    <span className="text-[10px] text-zinc-500 font-medium">{pct > 0 ? Math.round(pct) + "%" : "0%"}</span>
                                  </div>
                                </td>
                                {rankOrder.map((r: string) => (
                                  <td key={r} className="text-center px-2 py-4 align-top min-w-[70px]">
                                    {cutoffs[r] !== undefined ? (
                                      <div className="flex flex-col items-center gap-1.5">
                                        <span className={`text-[9px] font-extrabold tracking-[0.1em] uppercase ${score >= cutoffs[r] ? "text-white" : "text-zinc-500"}`}>
                                          {cutoffs[r]}
                                        </span>
                                        <div className="w-16 h-3 rounded-sm bg-zinc-800 overflow-hidden shadow-inner relative mx-auto">
                                          <div
                                            className={`h-full rounded-sm ${score >= cutoffs[r] ? "shadow-[0_0_4px_rgba(255,255,255,0.15)]" : ""}`}
                                            style={{
                                              width: `${Math.min(100, Math.round((score / Math.max(cutoffs[r] || 1, 1)) * 100))}%`,
                                              backgroundColor: score >= cutoffs[r]
                                                ? benchmark.rank_colors?.[rankOrder.indexOf(r)] || accent
                                                : "#27272a",
                                              clipPath: "polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%)",
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-zinc-700">—</span>
                                    )}
                                  </td>
                                ))}
                                <td className="px-3 py-4 whitespace-nowrap align-top">
                                  <span className="font-mono font-extrabold text-sm text-white">{energy}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
