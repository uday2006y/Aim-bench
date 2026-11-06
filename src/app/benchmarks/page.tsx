"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import PinButton from "@/components/PinButton";

/** A row from GET /api/benchmarks, as far as this page reads it. */
interface BenchmarkCard {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  difficulty: string | null;
  scenario_count: number | null;
  created_at: string | null;
  rank_names: string[] | null;
  rank_colors: string[] | null;
  my_score: number | null;
  my_rank: string | null;
  my_maxed: boolean;
  my_pinned: boolean;
}

const DIFFICULTIES: { key: "all" | "easy" | "medium" | "hard"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");

  const request = useRef(0);

  const fetchBenchmarks = useCallback(async (query: string, ticket: number) => {
    setLoading(true);
    setFailed(false);

    try {
      const url = new URL("/api/benchmarks", window.location.origin);
      if (query) url.searchParams.set("q", query);

      const response = await fetch(url);

      if (ticket !== request.current) return;

      if (!response.ok) throw new Error(String(response.status));

      const data = (await response.json()) as {
        benchmarks?: BenchmarkCard[];
        loggedIn?: boolean;
      };

      if (ticket !== request.current) return;

      setBenchmarks(data.benchmarks ?? []);

      if (typeof data.loggedIn === "boolean") setLoggedIn(data.loggedIn);
    } catch {
      if (ticket !== request.current) return;
      setFailed(true);
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ticket = ++request.current;

    if (searchQuery === "") {
      fetchBenchmarks("", ticket);
      return;
    }

    const timeout = setTimeout(() => {
      fetchBenchmarks(searchQuery, ticket);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, fetchBenchmarks]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const visible = benchmarks.filter(
    (b) => difficulty === "all" || (b.difficulty || "medium") === difficulty
  );

  const platformLabel = (platform: string) =>
    platform
      .split(/[\s_-]+/)
      .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

  const myRankColor = (benchmark: BenchmarkCard): string => {
    const colors = benchmark.rank_colors ?? [];
    if (!colors.length) return "var(--accent)";
    if (benchmark.my_maxed) return colors[colors.length - 1];
    const idx = Math.max(0, Math.min(colors.length - 1, Number(benchmark.my_rank?.match(/\d+/)?.[0] ?? 0) - 1));
    return colors[idx] ?? "var(--accent)";
  };

  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader loggedIn={loggedIn} />

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-400 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {benchmarks.length} benchmark{benchmarks.length === 1 ? "" : "s"}
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Benchmarks</h1>
          <p className="mt-3 text-lg text-zinc-400">
            Compare scores across aim scenarios. Pick a benchmark to see its tiers, ladders, and your personal bests.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div className="flex w-full max-w-sm items-center rounded-xl border border-line bg-white/[0.03] px-4 py-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/50 transition-all">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mr-3 text-zinc-500 shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              placeholder="Search benchmarks…"
              value={searchQuery}
              onChange={handleSearch}
              className="flex-1 bg-transparent text-sm text-text outline-none placeholder-zinc-500"
            />
          </div>

          <div className="flex w-full sm:w-auto items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {DIFFICULTIES.map((level) => (
              <button
                key={level.key}
                onClick={() => setDifficulty(level.key)}
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  difficulty === level.key
                    ? "bg-accent text-accent-fg shadow-[0_0_20px_rgba(185,242,254,0.35)]"
                    : "border border-line bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        {failed && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-5 text-sm text-red-300 mb-10">
            Could not load benchmarks. Try again in a moment.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-line bg-card animate-pulse">
                <div className="h-1 w-1/3 rounded-full bg-zinc-900 mb-5" />
                <h2 className="h-7 w-3/4 rounded-full bg-zinc-900 mb-3" />
                <p className="h-4 w-1/2 rounded-full bg-zinc-900 mb-6" />
                <div className="h-1 w-full rounded-full bg-zinc-900 mb-3" />
                <div className="h-4 w-1/3 rounded-full bg-zinc-900" />
              </div>
            ))
          ) : visible.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-line bg-card p-16 text-center">
              <p className="text-zinc-500">
                {searchQuery ? "No benchmarks match your search." : "No benchmarks yet."}
              </p>
            </div>
          ) : (
            visible.map((benchmark) => {
              const colors = benchmark.rank_colors ?? [];
              const count = benchmark.scenario_count ?? 0;
              return (
                <Link
                  key={benchmark.id}
                  href={`/benchmarks/${benchmark.id}`}
                  className="block group"
                >
                  <div className="rounded-2xl border border-line bg-card p-6 hover:border-accent/60 hover:-translate-y-2 transition-all duration-300">
                    <div className="flex h-1 mb-5 overflow-hidden rounded-sm">
                      {colors.map((color, index) => (
                        <span key={index} className="flex-1" style={{ backgroundColor: color }} />
                      ))}
                      {colors.length === 0 && <span className="flex-1 bg-white/10" />}
                    </div>

                    <PinButton
                      benchmarkId={benchmark.id}
                      pinned={Boolean(benchmark.my_pinned)}
                      loggedIn={loggedIn}
                      className="absolute right-6 top-6 z-10"
                    />

                    <div className="flex flex-wrap items-center gap-2 pr-12 mb-3">
                      <span className="chip">{platformLabel(benchmark.platform)}</span>
                      <span className="chip capitalize">{benchmark.difficulty || "medium"}</span>
                    </div>

                    <h2 className="mt-1 line-clamp-2 text-lg font-semibold leading-snug group-hover:text-accent transition-colors">
                      {benchmark.title}
                    </h2>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-500">
                      {benchmark.description || "No description"}
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                      <p className="text-xs text-zinc-500">
                        {count} {count === 1 ? "scenario" : "scenarios"}
                        <span className="px-1.5 text-zinc-700">·</span>
                        {benchmark.created_at
                          ? new Date(benchmark.created_at).toLocaleDateString()
                          : "N/A"}
                      </p>

                      {loggedIn && benchmark.my_rank ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: myRankColor(benchmark) }}
                        >
                          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: myRankColor(benchmark) }} />
                          {benchmark.my_rank}
                          {benchmark.my_maxed ? " · Maxed" : ""}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs font-medium text-zinc-500 transition-colors group-hover:text-white">
                          View &rarr;
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
