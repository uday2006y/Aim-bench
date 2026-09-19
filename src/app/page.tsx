import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";

interface BenchmarkCard {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  scenario_count: number | null;
}

export default async function Home() {
  const accountId = await getSessionAccountId();

  const { data } = await supabaseAdmin
    .from("benchmarks")
    .select("id, title, description, platform, scenario_count")
    .order("created_at", { ascending: false })
    .limit(3);

  const benchmarks = (data || []) as BenchmarkCard[];

  return (
    <main className="min-h-screen text-white">
      {/* NAVBAR */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold tracking-tight">
            AIM<span className="text-zinc-500">BENCH</span>
          </Link>

          <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
            <Link href="/benchmarks" className="text-white">Benchmarks</Link>
            <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
            <Link href="/rank-history" className="hover:text-white">Rank History</Link>
            <Link href="/theme-settings" className="hover:text-white">Theme</Link>
          </nav>

          <div className="flex gap-3">
            {accountId ? (
              <>
                <Link
                  href="/create-benchmark"
                  className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white"
                >
                  Create Benchmark
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Log Out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-24">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-zinc-500">
            Aim Benchmark Platform
          </p>

          <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
            Measure your aim.
            <br />
            <span className="text-zinc-500">Track your progress.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
            Create benchmarks, compete on scenarios, track your scores and
            compare your performance with other players.
          </p>

          <div className="mt-8 flex gap-4">
            <Link
              href="/benchmarks"
              className="rounded-xl bg-white px-6 py-3 font-semibold text-black"
            >
              Explore Benchmarks
            </Link>

            <Link
              href="/create-benchmark"
              className="rounded-xl border border-white/10 px-6 py-3 font-semibold text-white hover:bg-white/5"
            >
              Create Benchmark
            </Link>
          </div>
        </div>
      </section>

      {/* BENCHMARKS */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Benchmarks</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Latest community-created benchmarks
            </p>
          </div>

          <Link
            href="/benchmarks"
            className="text-sm text-zinc-400 hover:text-white"
          >
            View all →
          </Link>
        </div>

        {benchmarks.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-zinc-500">No benchmarks yet</p>
            <Link
              href="/create-benchmark"
              className="mt-3 inline-block text-sm font-medium text-white hover:underline"
            >
              Create the first one →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {benchmarks.map((benchmark) => (
              <div
                key={benchmark.id}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="mb-8 flex items-center justify-between">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                    {benchmark.platform}
                  </span>

                  <span className="text-xs text-zinc-600">BENCHMARK</span>
                </div>

                <h3 className="line-clamp-2 text-lg font-semibold">
                  {benchmark.title}
                </h3>

                <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                  {benchmark.description || "No description"}
                </p>

                <p className="mt-2 text-xs text-zinc-600">
                  {benchmark.scenario_count ?? 1} scenario
                  {(benchmark.scenario_count ?? 1) === 1 ? "" : "s"}
                </p>

                <Link
                  href={`/benchmarks/${benchmark.id}`}
                  className="mt-6 block text-sm font-medium text-white"
                >
                  Open benchmark →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

            {/* QUICK ACTIONS */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/benchmarks"
            className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
          >
            <h3 className="text-lg font-semibold mb-2">Browse All Benchmarks</h3>
            <p className="text-sm text-zinc-500">
              Community-created aim trainer benchmarks across all platforms
            </p>
          </Link>

          <Link
            href="/create-benchmark"
            className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
          >
            <h3 className="text-lg font-semibold mb-2">Create Benchmark</h3>
            <p className="text-sm text-zinc-500">
              Share your aim trainer benchmark with the community
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}