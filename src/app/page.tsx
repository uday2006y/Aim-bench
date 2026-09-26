import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import SiteHeader from "@/components/SiteHeader";

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
      <SiteHeader loggedIn={Boolean(accountId)} />

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-24">
        <div className="animate-card-in max-w-3xl">
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
            {benchmarks.map((benchmark, i) => (
              <div
                key={benchmark.id}
                className="animate-card-in hover-lift group rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/25 hover:bg-white/[0.05]"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
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
            className="hover-lift group rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/25 hover:bg-white/[0.05]"
          >
            <h3 className="text-lg font-semibold mb-2">Browse All Benchmarks</h3>
            <p className="text-sm text-zinc-500">
              Community-created aim trainer benchmarks across all platforms
            </p>
          </Link>

          <Link
            href="/create-benchmark"
            className="hover-lift group rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/25 hover:bg-white/[0.05]"
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