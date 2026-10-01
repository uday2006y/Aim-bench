"use client";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import type { BenchmarkOption } from "@/lib/benchmarkOptions";

interface LeaderboardRow {
  account_id: string;
  benchmark_id: string;
  username: string;
  score: number;
  rank: string | null;
  maxed: boolean;
  benchmark_title: string;
  platform: string;
  rank_color: string;
  last_improved_at: string | null;
}

const NO_RANK = "—";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkOption[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [total, setTotal] = useState(0);

  // Switching the dropdown fires a request per change and nothing cancels the
  // one before it, so a slow response for the previous benchmark could land
  // last and overwrite the selection the visitor actually made. Only the most
  // recent request is allowed to write.
  const request = useRef(0);

  useEffect(() => {
    const ticket = ++request.current;

    async function fetchLeaderboard() {
      setLoading(true);
      setFailed(false);

      try {
        const url = selectedBenchmark
          ? `/api/leaderboard?benchmark_id=${encodeURIComponent(selectedBenchmark)}`
          : "/api/leaderboard";

        const response = await fetch(url);

        if (ticket !== request.current) return;

        if (!response.ok) throw new Error(String(response.status));

        const data = await response.json();

        if (ticket !== request.current) return;

        setRows(data.leaderboard ?? []);
        setTotal(typeof data.total === "number" ? data.total : 0);
        if (Array.isArray(data.benchmarks)) setBenchmarks(data.benchmarks);
        if (typeof data.loggedIn === "boolean") setLoggedIn(data.loggedIn);
      } catch {
        if (ticket !== request.current) return;
        setFailed(true);
      } finally {
        if (ticket === request.current) setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [selectedBenchmark]);

  const hidden = Math.max(0, total - rows.length);

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
          ) : failed ? (
            <p role="alert" className="text-red-400">
              Could not load the leaderboard. Please try again.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-zinc-500">No scores yet</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th scope="col" className="text-left text-sm text-zinc-500 p-4">#</th>
                      <th scope="col" className="text-left text-sm text-zinc-500 p-4">Player</th>
                      <th scope="col" className="text-left text-sm text-zinc-500 p-4">Benchmark</th>
                      <th scope="col" className="text-left text-sm text-zinc-500 p-4">Score</th>
                      <th scope="col" className="text-left text-sm text-zinc-500 p-4">Rank</th>
                      <th scope="col" className="text-left text-sm text-zinc-500 p-4">Platform</th>
                      <th scope="col" className="text-left text-sm text-zinc-500 p-4">Last improved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entry, index) => (
                      <tr
                        key={`${entry.account_id}:${entry.benchmark_id}`}
                        className="border-b border-white/10"
                      >
                        <td className="p-4 text-zinc-400">{index + 1}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-xs"
                            >
                              {(entry.username ?? "?").substring(0, 2)}
                            </span>
                            <span className="text-white font-medium">
                              {entry.username || "Anonymous"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-zinc-400 text-sm">
                          {entry.benchmark_title || NO_RANK}
                        </td>
                        <td className="p-4 font-medium text-white">
                          {entry.score.toLocaleString()}
                        </td>
                        {/* Coloured from the benchmark's own rank_colors ladder,
                            so renaming or recolouring a rank shows up here too. */}
                        <td
                          className="p-4 text-sm font-medium"
                          style={{ color: entry.rank_color }}
                        >
                          {entry.rank || NO_RANK}
                          {entry.maxed ? (
                            <span className="ml-1 text-zinc-600" title="Top rank cleared">
                              ✓
                            </span>
                          ) : null}
                        </td>
                        <td className="p-4 text-zinc-500 text-sm">
                          {entry.platform || NO_RANK}
                        </td>
                        <td className="p-4 text-zinc-500 text-sm">
                          {entry.last_improved_at
                            ? new Date(entry.last_improved_at).toLocaleDateString()
                            : NO_RANK}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* The endpoint caps how many rows it sends. Saying so beats a
                  table that simply stops for no visible reason. */}
              {hidden > 0 && (
                <p className="mt-4 text-xs text-zinc-600">
                  Showing the top {rows.length} of {total.toLocaleString()}{" "}
                  {total === 1 ? "entry" : "entries"}. Narrow it to a single
                  benchmark to see more.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
