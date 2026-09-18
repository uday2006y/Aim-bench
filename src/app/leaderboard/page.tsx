"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null);
  const [rankingType, setRankingType] = useState("score");
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08090b] text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* HEADER */}
        <header className="border-b border-white/10 mb-8">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="text-xl font-bold tracking-tight">
              AIM<span className="text-zinc-500">BENCH</span>
            </div>

            <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
              <a href="/" className="text-white">Benchmarks</a>
              <a href="/leaderboard" className="text-white">Leaderboard</a>
              <a href="/rank-history" className="text-white">Rank History</a>
            </nav>

            <div className="flex gap-3">
              <button className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white">
                Leaderboard
              </button>
              <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">
                Profile
              </button>
            </div>
          </div>
        </header>

        {/* SELECT BENCHMARK */}
        <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 mb-8">
          <h2 className="text-xl font-bold tracking-tight mb-4">
            Select Benchmark
          </h2>
          <select
            onChange={(e) => {
              setSelectedBenchmark(e.target.value);
              fetchLeaderboard();
            }}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          >
            <option value="">All Benchmarks</option>
            {[
              "Voltaic S5",
              "Voltaic",
              "Viscose Benchmarks S2",
              "Raw Input",
            ].map((name) => (
              <option key={name} value={name}>
                {name}
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
                    Rank
                  </th>
                  <th className="text-left text-sm text-zinc-500 p-4">
                    Player
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
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => (
                  <tr key={entry.id} className="border-b border-white/10">
                    <td className="p-4 text-zinc-400">{index + 1}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                          {entry.username?.substring(0, 2)}
                        </div>
                        <span className="text-white font-medium">{entry.username || "Anonymous"}</span>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-white">
                      {entry.score}
                    </td>
                    <td className="p-4 text-zinc-400 small">
                      {entry.rank || "—"}
                    </td>
                    <td className="p-4 text-zinc-500 small">
                      {entry.platform || "—"}
                    </td>
                    <td className="p-4 text-zinc-500 small">
                      {entry.completed_at ? new Date(entry.completed_at).toLocaleDateString() : "—"}
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