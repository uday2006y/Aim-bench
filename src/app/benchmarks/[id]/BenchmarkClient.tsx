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
  const [accent, setAccent] = useState("#8b5cf6");

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
  const categories = Array.from(
    new Set(scenarios.map((s) => s.category || "CONTROL TRACKING"))
  );

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-full px-4 py-6">
        {/* Top nav bar */}
        <div className="flex items-center justify-between mb-6 px-2">
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition">← Back</Link>
        </div>

        {/* Benchmark header */}
        <div className="rounded-2xl border border-zinc-800 bg-[#111] p-6 mb-6 shadow-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight">{benchmark.title || "Benchmark"}</h1>
        </div>

        {/* Scenario table */}
        {hasScenarios && (
          <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[1200px]">
                <thead className="bg-[#0a0a0a] text-zinc-300 text-[10px] uppercase tracking-wider font-extrabold border-b border-zinc-800">
                  <tr>
                    <th className="text-left px-4 py-3 whitespace-nowrap">SCENARIO</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">SCORE</th>
                    {rankOrder.map((r) => (
                      <th key={r.name} className="text-center px-2 py-3 whitespace-nowrap text-[10px] tracking-wide">
                        {r.name}
                      </th>
                    ))}
                    <th className="text-left px-3 py-3 whitespace-nowrap">ENERGY</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const catScenarios = scenarios.filter(
                      (s) => (s.category || "CONTROL TRACKING") === cat
                    );
                    return (
                      <>
                        {catScenarios.map((scenario: BenchmarkScenario, idx: number) => {
                          const score = scenario.best_score ?? 0;
                          const scoreStr = score ? `${score}` : "—";
                          const pctStr = score ? `${Math.round(Math.random() * 100)}%` : "—";
                          return (
                            <tr
                              key={scenario.id}
                              className="border-b border-zinc-800/40 hover:bg-zinc-900/20 transition-colors"
                            >
                              {/* Vertical category label + Scenario name */}
                              <td className="px-2 py-3 whitespace-nowrap align-middle">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex items-center justify-center rounded px-1 py-0.5 text-[8px] font-extrabold tracking-[0.15em] uppercase bg-gradient-to-b from-purple-700 to-purple-900 text-white border border-purple-500/40"
                                    style={{ writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}
                                  >
                                    {cat.toUpperCase()}
                                  </span>
                                  <div className="flex flex-col gap-0.5 min-w-[160px]">
                                    <span className="font-semibold text-white text-xs leading-tight truncate">{scenario.title}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] text-zinc-500">{scenario.easyaim_scenario_id}</span>
                                      <span className="text-[8px] text-zinc-600">▶</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {/* Score + % */}
                              <td className="px-3 py-3 whitespace-nowrap align-middle">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-mono font-bold text-sm text-white tracking-tight">{scoreStr}</span>
                                  <span className="text-[10px] text-zinc-400 font-medium">{pctStr}</span>
                                </div>
                              </td>
                              {/* Rank columns with purple gradient bars */}
                              {rankOrder.map((r) => {
                                const needed = scenario.cutoffs[r.name] ?? 0;
                                const barPct = needed ? Math.min(100, Math.round((score / Math.max(needed || 1, 1)) * 100)) : 0;
                                return (
                                  <td key={r.name} className="text-center px-1.5 py-3 align-middle min-w-[60px]">
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="w-14 h-2.5 rounded-full overflow-hidden bg-gradient-to-r from-zinc-900 to-zinc-950 shadow-inner relative border border-zinc-800/50 flex items-center justify-center">
                                        <span className="absolute z-10 text-[9px] font-mono font-bold text-white drop-shadow-md whitespace-nowrap truncate px-0.5">{needed ? needed.toLocaleString() : "—"}</span>
                                        <div
                                          className="absolute h-full rounded-full bg-gradient-to-r from-purple-700 via-purple-400 to-purple-200 shadow-[0_0_6px_rgba(168,85,247,0.35)]"
                                          style={{
                                            width: `${barPct}%`,
                                            clipPath: "polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%)",
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                              {/* Energy column */}
                              <td className="px-3 py-3 whitespace-nowrap align-middle">
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
    </main>
  );
}
