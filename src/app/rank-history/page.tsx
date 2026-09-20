"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function RankHistoryPage() {
  const [rankHistory, setRankHistory] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRankHistory();
  }, [selectedBenchmark]);

  useEffect(() => {
    fetchBenchmarks();
  }, []);

  async function fetchBenchmarks() {
    try {
      const response = await fetch("/api/benchmarks?platform=all");
      const data = await response.json();
      setBenchmarks(data.benchmarks || []);
    } catch (error) {
      console.error("Failed to fetch benchmarks:", error);
    }
  }

  async function fetchRankHistory() {
    setLoading(true);
    try {
      let url = "/api/rank-history";
      if (selectedBenchmark) {
        url += `?benchmark_id=${selectedBenchmark}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setRankHistory(data.rank_history || []);
    } catch (error) {
      console.error("Failed to fetch rank history:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* HEADER */}
        <header className="border-b border-white/10 mb-8">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <Link href="/" className="text-xl font-bold tracking-tight">
              AIM<span className="text-zinc-500">BENCH</span>
            </Link>

            <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
              <Link href="/benchmarks" className="hover:text-white">Benchmarks</Link>
              <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
              <Link href="/rank-history" className="text-white">Rank History</Link>
            </nav>

            <div className="flex gap-3">
              <Link
                href="/profile"
                className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white"
              >
                Profile
              </Link>
              <Link
                href="/profile"
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Profile
              </Link>
            </div>
          </div>
        </header>

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

        {/* RANK HISTORY */}
        <div>
          {loading ? (
            <p className="text-zinc-500">Loading rank history...</p>
          ) : rankHistory.length === 0 ? (
            <p className="text-zinc-500">No rank history yet</p>
          ) : (
            <div className="grid gap-4">
              {rankHistory.map((entry, index) => (
                <div
                  key={entry.id}
                  className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-lg font-semibold">
                        {entry.username || "Anonymous"}
                      </span>
                      <span className="ml-2 text-sm text-zinc-500">
                        {entry.benchmark_title || "Unknown Benchmark"}
                      </span>
                    </div>

                    <span className="text-sm text-zinc-500">
                      {entry.date ? new Date(entry.date).toLocaleDateString() : "—"}
                    </span>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-zinc-400">Previous Score</p>
                    <p className="text-2xl font-bold">{entry.old_score ?? "—"}</p>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-zinc-400">Current Score</p>
                    <p className="text-2xl font-bold text-white">
                      {entry.new_score || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500">
                      Rank: {entry.old_rank || "—"} → {entry.new_rank || "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}