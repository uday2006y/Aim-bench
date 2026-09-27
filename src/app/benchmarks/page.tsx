"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import PinButton from "@/components/PinButton";

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // Debounce only what the visitor is typing. The first load used to sit
    // behind this same 300ms, which was a third of a second of pure waiting
    // before the request that already takes over a second went out at all.
    if (searchQuery === "") {
      fetchBenchmarks("");
      return;
    }

    const timeout = setTimeout(() => {
      fetchBenchmarks(searchQuery);
    }, 300);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  async function fetchBenchmarks(query: string) {
    setLoading(true);
    try {
      const url = new URL("/api/benchmarks", window.location.origin);
      if (query) url.searchParams.set("q", query);

      const response = await fetch(url);
      const data = (await response.json()) as {
        benchmarks: any[];
        loggedIn?: boolean;
      };

      setBenchmarks(data.benchmarks || []);

      // Used to be a separate request to /api/session; rides along with the
      // list now, since the endpoint already knows whether there is one.
      if (typeof data.loggedIn === "boolean") setLoggedIn(data.loggedIn);
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
      <SiteHeader loggedIn={loggedIn} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {/* SEARCH AND FILTERS */}
        <div className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search benchmarks..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full rounded-xl border border-white/10 px-4 py-2 text-white background-transparent focus:outline-none focus:border-white/20"
            />
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
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                    {benchmark.platform}
                  </span>

                  {/* Star sits in the top-right corner: the one part of the
                      card that carries no information, so it costs no
                      reading space and stays clear of the title and the
                      link on a narrow phone. */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">
                      {benchmark.scenario_count ?? 0}{" "}
                      {(benchmark.scenario_count ?? 0) === 1
                        ? "scenario"
                        : "scenarios"}
                    </span>
                    <PinButton
                      benchmarkId={benchmark.id}
                      pinned={Boolean(benchmark.my_pinned)}
                      loggedIn={loggedIn}
                    />
                  </div>
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
                        {/* The rank name comes from the benchmark's own
                            rank_names, so it renames with the benchmark.
                            Just the rank — "Gold" reads as Gold, and
                            "aidjasdasjd" reads as aidjasdasjd. This used to
                            append the benchmark's ceiling as "Gold of
                            Platinum", which was wrong twice over: it named
                            a tier the player is not close to, and on a
                            six-rung ladder someone on rung three was told
                            their goal was rung six.

                            "Complete" is the one addition, and only for
                            clearing the top rank's cutoffs. Reaching a
                            middle rank is progress, not completion. */}
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          <span
                            className="text-lg font-bold"
                            style={{ color: rankColorOf(benchmark, benchmark.my_rank) }}
                          >
                            {benchmark.my_rank}
                          </span>
                          {benchmark.my_maxed ? (
                            <span className="text-xs font-medium text-zinc-400">
                              Complete
                            </span>
                          ) : null}
                          <span className="truncate text-xs text-zinc-600">
                            · {benchmark.title}
                          </span>
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-zinc-500">
                          {benchmark.my_score.toLocaleString()}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium text-zinc-600">Not played</p>
                        <p className="mt-0.5 truncate text-xs text-zinc-600">
                          {loggedIn
                            ? `No score yet · ${benchmark.title}`
                            : "Log in to track your rank"}
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