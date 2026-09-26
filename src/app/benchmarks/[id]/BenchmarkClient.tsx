"use client";

import { useState, useEffect } from "react";
import { Fragment } from "react";
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

const DEFAULT_RANKS = [
  { name: "Bronze", color: "#b87333" },
  { name: "Silver", color: "#c0c0c0" },
  { name: "Gold", color: "#ffd700" },
  { name: "Platinum", color: "#e5e4e2" },
  { name: "Diamond", color: "#b9f2fe" },
  { name: "Champion", color: "#ffd700" },
  { name: "Radiant", color: "#ff0000" },
  { name: "Immortal", color: "#9f9f9f" },
];

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

  const extraRanks = [
    { name: "Lemming", color: "#9b59b6" },
    { name: "Hare", color: "#8e44ad" },
    { name: "Ermine", color: "#7d3c98" },
    { name: "Puffin", color: "#6c3483" },
    { name: "Penguin", color: "#5b2c6f" },
    { name: "Fox", color: "#4a235a" },
    { name: "Mammoth", color: "#3a1b45" },
    { name: "Orca", color: "#2a1530" },
    { name: "Seal", color: "#1a0f1b" },
  ];
  const displayRanks = benchmark.rank_names?.length ? benchmark.rank_names.map((name, i) => ({
    name, color: benchmark.rank_colors?.[i] || "#b87333"
  })) : DEFAULT_RANKS;
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
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-zinc-300">
              <div><span className="text-zinc-500">Platform:</span> <span className="font-medium">{benchmark.platform}</span></div>
              <div><span className="text-zinc-500">Difficulty:</span> <span className="font-medium">{benchmark.difficulty}</span></div>
              <div><span className="text-zinc-500">Scenarios:</span> <span className="font-medium">{benchmark.scenario_count}</span></div>
              <div><span className="text-zinc-500">Energy:</span> <span className="font-medium">{scenarios.reduce((sum, s) => sum + (s.best_score ?? 0), 0)}</span></div>
            </div>
            <p className="mt-3 text-zinc-400 text-base leading-relaxed max-w-2xl">
              {benchmark.description || "No description"}
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
                      {displayRanks.map((r: { name: string; color: string }) => (
                        <th key={r.name} className="text-center px-3 py-3 font-bold whitespace-nowrap text-[10px] tracking-[0.1em]">
                          {r.name}
                        </th>
                      ))}
                      <th className="text-left px-3 py-3 font-bold whitespace-nowrap">Energy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((scenario: BenchmarkScenario) => {
                      const score = scenario.best_score ?? 0;
                      const catLabel = scenario.category || "Other";
                            const cutoffs = scenario.cutoffs || {};
                            const sorted = displayRanks
                              .map((r: { name: string; color: string }) => cutoffs[r.name])
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
                                {displayRanks.map((r: { name: string; color: string }) => (
                                  <td key={r.name} className="text-center px-2 py-4 align-top min-w-[70px]">
                                    {cutoffs[r.name] !== undefined ? (
                                      <div className="flex flex-col items-center gap-1.5">
                                        <span className={`text-[9px] font-extrabold tracking-[0.1em] uppercase ${score >= cutoffs[r.name] ? "text-white" : "text-zinc-500"}`}>
                                          {cutoffs[r.name]}
                                        </span>
                                        <div className="w-16 h-3 rounded-sm bg-zinc-800 overflow-hidden shadow-inner relative mx-auto">
                                          <div
                                            className={`h-full rounded-sm ${score >= cutoffs[r.name] ? "shadow-[0_0_4px_rgba(255,255,255,0.15)]" : ""}`}
                                            style={{
                                              width: `${Math.min(100, Math.round((score / Math.max(cutoffs[r.name] || 1, 1)) * 100))}%`,
                                              backgroundColor: score >= cutoffs[r.name]
                                                ? benchmark.rank_colors?.[displayRanks.findIndex((item) => item.name === r.name)] || accent
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
                                  <span className="font-mono font-extrabold text-sm text-white">{totalEnergy}</span>
                                </td>
                              </tr>
                            );
                          })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


