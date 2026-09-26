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
              <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
                <table className="w-full text-xs text-white border-collapse">
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
                    {Array.from(new Set(scenarios.map((s) => s.category || "Other"))).map((cat: string) => {
                      const catScenarios = scenarios.filter((s) => (s.category || "Other") === cat);
                      return (
                        <>
                          <tr key={`cat-${cat}`} className="bg-zinc-950 border-b border-zinc-800">
                            <td className="py-2" colSpan={2 + displayRanks.length + 1}>
                              <span
                                className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.15em] uppercase bg-gradient-to-r from-purple-700 to-purple-900 text-white border border-purple-600"
                                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                              >
                                {cat.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                          {catScenarios.map((scenario: BenchmarkScenario) => {
                            const score = scenario.best_score ?? 0;
                            const scoreStr = score ? `${score}` : "—";
                            const pct = 100; // simplified for visual match
                            return (
                              <tr key={scenario.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                                <td className="px-4 py-2 whitespace-nowrap align-top">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-white truncate max-w-[180px]">{scenario.title}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap align-top">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-mono font-bold text-white text-sm">{scoreStr}</span>
                                    <span className="text-[10px] text-zinc-400">{pct}%</span>
                                  </div>
                                </td>
                                {displayRanks.map((r: { name: string; color: string }) => (
                                  <td key={r.name} className="text-center px-1 py-2 align-top min-w-[60px]">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-[9px] font-bold text-zinc-300">{r.name}</span>
                                      <div className="w-14 h-2.5 rounded-full overflow-hidden bg-zinc-900 shadow-inner relative">
                                        <div
                                          className="h-full rounded-full bg-gradient-to-r from-purple-600 via-purple-400 to-purple-200 shadow-[0_0_6px_rgba(168,85,247,0.4)]"
                                          style={{
                                            width: "70%",
                                            clipPath: "polygon(0 0, 92% 0, 100% 50%, 92% 100%, 0 100%)",
                                          }}
                                        />
                                      </div>
                                      <span className="text-[9px] font-mono text-purple-300 font-semibold">{score ? String(score) : "—"}</span>
                                    </div>
                                  </td>
                                ))}
                                <td className="px-2 py-2 whitespace-nowrap align-top">
                                  <span className="font-mono font-bold text-xs text-zinc-300">{score}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </>
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


