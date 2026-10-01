"use client";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import type { BenchmarkOption } from "@/lib/benchmarkOptions";

interface RankChange {
  id: string;
  username: string;
  benchmark_title: string;
  old_score: number;
  new_score: number;
  old_rank: string | null;
  new_rank: string | null;
  date: string;
}

/** Rendered when a player had a rank and then no longer does. */
const NO_RANK = "—";

export default function RankHistoryPage() {
  const [rankHistory, setRankHistory] = useState<RankChange[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkOption[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Switching the dropdown fires a request per change and nothing cancels the
  // one before it, so a slow response for the previous benchmark could land
  // last and overwrite the selection the visitor actually made. Only the most
  // recent request is allowed to write.
  const request = useRef(0);

  useEffect(() => {
    const ticket = ++request.current;

    async function fetchRankHistory() {
      setLoading(true);
      setFailed(false);

      try {
        const url = selectedBenchmark
          ? `/api/rank-history?benchmark_id=${encodeURIComponent(selectedBenchmark)}`
          : "/api/rank-history";

        const response = await fetch(url);

        if (ticket !== request.current) return;

        if (!response.ok) throw new Error(String(response.status));

        const data = await response.json();

        if (ticket !== request.current) return;

        setRankHistory(data.rank_history ?? []);
        if (Array.isArray(data.benchmarks)) setBenchmarks(data.benchmarks);
        if (typeof data.loggedIn === "boolean") setLoggedIn(data.loggedIn);
      } catch {
        if (ticket !== request.current) return;
        setFailed(true);
      } finally {
        if (ticket === request.current) setLoading(false);
      }
    }

    fetchRankHistory();
  }, [selectedBenchmark]);

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

        {/* RANK HISTORY */}
        <div>
          {loading ? (
            <p className="text-zinc-500">Loading rank history...</p>
          ) : failed ? (
            <p role="alert" className="text-red-400">
              Could not load rank history. Please try again.
            </p>
          ) : rankHistory.length === 0 ? (
            <p className="text-zinc-500">No rank history yet</p>
          ) : (
            <>
              <div className="grid gap-4">
                {rankHistory.map((entry) => (
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

                    <div className="mb-3 flex flex-wrap items-baseline gap-4">
                      <div>
                        <p className="text-sm text-zinc-400">Previous Score</p>
                        {/* `??` rather than `||`: a score of 0 is a real score,
                            and `||` was rendering it as an em-dash. */}
                        <p className="text-2xl font-bold">
                          {entry.old_score.toLocaleString()}
                        </p>
                      </div>

                      <span aria-hidden="true" className="text-zinc-600">
                        →
                      </span>

                      <div>
                        <p className="text-sm text-zinc-400">Current Score</p>
                        <p className="text-2xl font-bold text-white">
                          {entry.new_score.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-500">
                      Rank: {entry.old_rank ?? NO_RANK} → {entry.new_rank ?? NO_RANK}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-xs text-zinc-600">
                Showing the {rankHistory.length} most recent{" "}
                {rankHistory.length === 1 ? "change" : "changes"}. A first-ever
                score is not listed — there is nothing to compare it against.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
