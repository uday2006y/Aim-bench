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

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // View-only filter over what the server already returned.
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");

  // Every keystroke that settles starts a request, and nothing cancels the
  // one still in flight. Without this, a slow response for "eas" could land
  // after a fast one for "easyaim" and replace the newer results with the
  // older ones — the list would show something that no longer matches the
  // box. Only the most recent request is allowed to write.
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

      // Used to be a separate request to /api/session; rides along with the
      // list now, since the endpoint already knows whether there is one.
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

    // Debounce only what the visitor is typing. The first load used to sit
    // behind this same 300ms, which was a third of a second of pure waiting
    // before the request that already takes over a second went out at all.
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
    platform === "easyaim" ? "EasyAim" : platform;

  /** Colour of the visitor's current rank on a card, from that card's ladder. */
  const myRankColor = (b: BenchmarkCard) => {
    const index = b.my_rank ? (b.rank_names ?? []).indexOf(b.my_rank) : -1;
    return index >= 0 ? (b.rank_colors?.[index] ?? "#b87333") : "#71717a";
  };

  const filters = ["all", "easy", "medium", "hard"] as const;

  return (
    <main className="min-h-screen text-white">
      <SiteHeader loggedIn={loggedIn} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {/* HEADER */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Library</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Benchmarks
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
              Pick a benchmark, play its scenarios and climb the rank ladder.
            </p>
          </div>

          <Link href="/create-benchmark" className="btn btn-primary">
            + Create benchmark
          </Link>
        </header>

        {/* SEARCH AND FILTERS */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
            >
              ⌕
            </span>
            <input
              type="text"
              placeholder="Search benchmarks..."
              value={searchQuery}
              onChange={handleSearch}
              aria-label="Search benchmarks"
              className="field w-full pl-10 text-sm"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by difficulty"
            className="flex flex-wrap items-center gap-1.5"
          >
            {filters.map((value) => {
              const active = difficulty === value;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDifficulty(value)}
                  aria-pressed={active}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                    active
                      ? "border-accent/60 bg-accent/10 text-white"
                      : "border-line text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        {!loading && !failed && benchmarks.length > 0 ? (
          <p className="mb-4 px-1 text-xs text-zinc-600" aria-live="polite">
            {visible.length} benchmark{visible.length === 1 ? "" : "s"}
          </p>
        ) : null}

        {/* BENCHMARKS GRID */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card animate-pulse p-6">
                <div className="h-5 w-24 rounded-full bg-white/[0.06]" />
                <div className="mt-5 h-5 w-3/4 rounded bg-white/[0.08]" />
                <div className="mt-3 h-3 w-full rounded bg-white/[0.05]" />
                <div className="mt-2 h-3 w-2/3 rounded bg-white/[0.05]" />
                <div className="mt-8 h-3 w-1/2 rounded bg-white/[0.05]" />
              </div>
            ))}
          </div>
        ) : failed ? (
          <div className="card px-6 py-16 text-center">
            <p role="alert" className="text-red-400">
              Could not load benchmarks. Please try again.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <p className="text-zinc-400">No benchmarks found</p>
            <p className="mt-2 text-sm text-zinc-600">
              {benchmarks.length === 0
                ? "Create your first benchmark"
                : "Try a different difficulty or search."}
            </p>
            {benchmarks.length === 0 ? (
              <Link href="/create-benchmark" className="btn btn-primary mt-6">
                + Create benchmark
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((benchmark, i) => {
              const count = benchmark.scenario_count ?? 0;
              const colors = benchmark.rank_colors ?? [];

              return (
                // The card is one big link, so the pin cannot live inside it: a
                // button nested in an anchor is invalid HTML, and clicking the
                // star would follow the link instead of pinning. It sits in a
                // sibling layer above the link, which keeps it clickable and
                // stops the click reaching the card underneath.
                <div
                  key={benchmark.id}
                  className="animate-card-in hover-lift card group relative overflow-hidden"
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                >
                  {/* The benchmark's own ladder, as the top edge of the card. */}
                  {colors.length > 0 ? (
                    <div aria-hidden="true" className="flex h-1">
                      {colors.map((color, index) => (
                        <span
                          key={`${benchmark.id}-${index}`}
                          className="flex-1"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div aria-hidden="true" className="h-1 bg-white/10" />
                  )}

                  <PinButton
                    benchmarkId={benchmark.id}
                    pinned={Boolean(benchmark.my_pinned)}
                    loggedIn={loggedIn}
                    className="absolute right-4 top-5 z-10"
                  />

                  <Link
                    href={`/benchmarks/${benchmark.id}`}
                    className="flex h-full flex-col p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-center gap-2 pr-10">
                      <span className="chip">{platformLabel(benchmark.platform)}</span>
                      <span className="chip capitalize">
                        {benchmark.difficulty || "medium"}
                      </span>
                    </div>

                    <h2 className="mt-4 line-clamp-2 text-lg font-semibold leading-snug transition-colors group-hover:text-accent">
                      {benchmark.title}
                    </h2>

                    <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-zinc-500">
                      {benchmark.description || "No description"}
                    </p>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
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
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: myRankColor(benchmark) }}
                          />
                          {benchmark.my_rank}
                          {benchmark.my_maxed ? " · Maxed" : ""}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs font-medium text-zinc-500 transition-colors group-hover:text-white">
                          View →
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
