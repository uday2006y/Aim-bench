"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null);
  const [rankingType, setRankingType] = useState("score");
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedBenchmark]);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      let url = "/api/leaderboard";
      if (selectedBenchmark) {
        url += `?benchmark_id=${selectedBenchmark}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      setLeaderboard(data.leaderboard || []);

      // Both of these used to be their own requests. Mounting this page
      // cost three serverless invocations — the board, /api/session, and
      // the full benchmark list — where one now covers all of it, and the
      // dropdown gets two columns instead of the whole list.
      if (data.benchmarks?.length) setBenchmarks(data.benchmarks);
      if (typeof data.loggedIn === "boolean") setLoggedIn(data.loggedIn);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-white">
      <SiteHeader loggedIn={loggedIn} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {/* SELECT BENCHMARK */}
        <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-xl font-bold tracking-tight mb-4">
            Select Benchmark
          </h2>
          <select
            value={selectedBenchmark || ""}
            onChange={(e) => setSelectedBenchmark(e.target.value || null)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          >
            <option value="">All Benchmarks</option>
            {benchmarks.map((benchmark) => (
              <option key={benchmark.id} value={benchmark.id}>
                {benchmark.title}
              </option>
            ))}
          </select>
        </div>

        {/* LEADERBOARD TABLE */}
        <div>
          {loading ? (
            <p className="text-zinc-500">Loading leaderboard...</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-zinc-500">No scores yet</p>
          ) : (
            <table className="w-full rounded-lg overflow-hidden">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-sm text-zinc-500 p-4 ranking-type">
                    #
                  </th>
                  <th className="text-left text-sm text-zinc-500 p-4">
                    Player
                  </th>
                  <th className="text-left text-sm text-zinc-500 p-4">
                    Benchmark
                  </th>
                  <th className="text-left text-sm text-zinc-500 p-4">
                    Score
                  </th>
                  <th className="text-left text-sm text-zinc-500 p-4">
                    Rank
                  </th>
                  <th className="text-left text-sm text-zinc-500 p-4">
                    Platform
                  </th>
                  <th className="text-left text-sm text-zinc-500 p-4">
                    Last improved
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => (
                  <tr
                    key={`${entry.account_id}:${entry.benchmark_id}`}
                    className="border-b border-white/10"
                  >
                    <td className="p-4 text-zinc-400">{index + 1}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                          {entry.username?.substring(0, 2)}
                        </div>
                        <span className="text-white font-medium">{entry.username || "Anonymous"}</span>
                      </div>
                    </td>
                    <td className="p-4 text-zinc-400 small">
                      {entry.benchmark_title || "—"}
                    </td>
                    <td className="p-4 font-medium text-white">
                      {entry.score?.toLocaleString()}
                    </td>
                    {/* Coloured from the benchmark's own rank_colors ladder,
                        so renaming or recolouring a rank shows up here too. */}
                    <td
                      className="p-4 small font-medium"
                      style={{ color: entry.rank_color }}
                    >
                      {entry.rank || "—"}
                      {entry.maxed ? (
                        <span className="ml-1 text-zinc-600">✓</span>
                      ) : null}
                    </td>
                    <td className="p-4 text-zinc-500 small">
                      {entry.platform || "—"}
                    </td>
                    <td className="p-4 text-zinc-500 small">
                      {entry.last_improved_at
                        ? new Date(entry.last_improved_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}