"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(["easyaim"]);
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchBenchmarks(searchQuery, selectedPlatform);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, selectedPlatform]);

  // The list only attaches my_rank when there is a session, so the card
  // needs to know which empty state to show.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setLoggedIn(Boolean(data.accountId));
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, []);

  async function fetchPlatforms() {
    try {
      const response = await fetch("/api/benchmarks?platform=all");
      const data = (await response.json()) as { benchmarks: any[] };
      const uniquePlatforms = [
        ...new Set((data.benchmarks || []).map((b: any) => b.platform)),
      ].filter(Boolean) as string[];

      setPlatforms(uniquePlatforms.length ? uniquePlatforms : ["easyaim"]);
    } catch (error) {
      console.error("Failed to fetch platforms:", error);
    }
  }

  async function fetchBenchmarks(query: string, platform: string) {
    setLoading(true);
    try {
      const url = new URL("/api/benchmarks", window.location.origin);
      if (platform) url.searchParams.set("platform", platform);
      if (query) url.searchParams.set("q", query);

      const response = await fetch(url);
      const data = (await response.json()) as { benchmarks: any[] };
      setBenchmarks(data.benchmarks || []);
    } catch (error) {
      console.error("Failed to fetch benchmarks:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  /** Colour a rank name using the benchmark's own rank_colors ladder. */
  function rankColorOf(benchmark: any, rankName: string): string {
    const index = benchmark.rank_names?.indexOf(rankName) ?? -1;
    if (index < 0) return "#ffffff";
    return benchmark.rank_colors?.[index] || "#ffffff";
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
              <Link href="/benchmarks" className="text-white">Benchmarks</Link>
              <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
              <Link href="/rank-history" className="hover:text-white">Rank History</Link>
            </nav>

            <div className="flex gap-3">
              <Link
                href="/profile"
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Profile
              </Link>
            </div>
          </div>
        </header>

        {/* SEARCH AND FILTERS */}
        <div className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search benchmarks..."
              value={searchQuery}
              onChange={handleSearch}
              className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-white background-transparent focus:outline-none focus:border-white/20"
            />
            <select
              value={selectedPlatform}
              onChange={(e) => {
                setSelectedPlatform(e.target.value);
              }}
              className="rounded-xl border border-white/10 px-4 py-2 text-white background-transparent focus:outline-none focus:border-white/20"
            >
              <option value="all">All Platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* BENCHMARKS GRID */}
        <div className="grid gap-4 md:grid-cols-3">
          {loading ? (
            <div className="col-span-3 text-center py-20">
              <p>Loading benchmarks...</p>
            </div>
          ) : benchmarks.length === 0 ? (
            <div className="col-span-3 text-center py-20">
              <p className="text-zinc-500">No benchmarks found</p>
              <p className="mt-2 text-zinc-600">Create your first benchmark</p>
            </div>
          ) : (
            benchmarks.map((benchmark, i) => (
              <div
                key={benchmark.id}
                className="animate-card-in hover-lift group rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/25 hover:bg-white/[0.05]"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                    {benchmark.platform}
                  </span>

                  <span className="text-xs text-zinc-500">
                    {benchmark.scenario_count} scenarios
                  </span>
                </div>

                <h3 className="text-lg font-semibold line-clamp-2">
                  {benchmark.title}
                </h3>

                <p className="mt-2 text-sm text-zinc-500">
                  {benchmark.description || "No description"}
                </p>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Your rank
                    </p>
                    {benchmark.my_rank ? (
                      <>
                        <p
                          className="truncate text-lg font-bold"
                          style={{ color: rankColorOf(benchmark, benchmark.my_rank) }}
                        >
                          {benchmark.my_rank}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-zinc-500">
                          {benchmark.my_score.toLocaleString()}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium text-zinc-600">Not played</p>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {loggedIn ? "No score yet" : "Log in to track your rank"}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {benchmark.difficulty || "medium"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {benchmark.created_at
                        ? new Date(benchmark.created_at).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/benchmarks/${benchmark.id}`}
                  className="mt-4 block text-sm font-medium text-white"
                >
                  View Details →
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}