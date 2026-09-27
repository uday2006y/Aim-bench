import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { loadTopPinned } from "@/lib/pins";
import SiteHeader from "@/components/SiteHeader";

interface BenchmarkCard {
  id: string;
  title: string;
  platform: string;
  scenario_count: number | null;
  created_at: string | null;
  pin_count: number;
}

/** How many starred benchmarks the home page shows. */
const FEATURED_LIMIT = 4;

export default async function Home() {
  const accountId = await getSessionAccountId();

  // Only starred benchmarks, most stars first. A benchmark nobody starred
  // is not a recommendation, so an unstarred one is not featured here no
  // matter how recently it was made.
  const topPinned = await loadTopPinned(FEATURED_LIMIT);

  let benchmarks: BenchmarkCard[] = [];

  if (topPinned.length > 0) {
    const { data } = await supabaseAdmin
      .from("benchmarks")
      .select("id, title, platform, scenario_count, created_at")
      .in(
        "id",
        topPinned.map((entry) => entry.id)
      );

    const pinCountById = new Map(
      topPinned.map((entry) => [entry.id, entry.pin_count])
    );

    // Equal star counts break by newest, so the featured row keeps
    // refreshing as the community grows rather than freezing on whichever
    // benchmarks happened to be starred first.
    benchmarks = (data || [])
      .map(
        (row) =>
          ({
            ...(row as Omit<BenchmarkCard, "pin_count">),
            pin_count: pinCountById.get((row as { id: string }).id) ?? 0,
          }) as BenchmarkCard
      )
      .sort(
        (a, b) =>
          b.pin_count - a.pin_count ||
          new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime()
      )
      .slice(0, FEATURED_LIMIT);
  }

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
            <h2 className="text-2xl font-semibold">Starred Benchmarks</h2>
            <p className="mt-1 text-sm text-zinc-500">
              What the community has starred most
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
            <p className="text-zinc-500">
              Nothing starred yet — be the first
            </p>
            <Link
              href="/benchmarks"
              className="mt-3 inline-block text-sm font-medium text-white hover:underline"
            >
              Browse benchmarks and star one →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benchmarks.map((benchmark, i) => (
              <Link
                key={benchmark.id}
                href={`/benchmarks/${benchmark.id}`}
                className="animate-card-in hover-lift group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/25 hover:bg-white/[0.05]"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <div className="mb-6 flex items-center justify-between gap-2">
                  <span className="truncate rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                    {benchmark.platform}
                  </span>

                  {/* Already gold and static here: this list is chosen by
                      star count, so nothing on the card needs a toggle. */}
                  <span
                    className="flex shrink-0 items-center gap-1 text-xs text-amber-400"
                    title={`${benchmark.pin_count} ${
                      benchmark.pin_count === 1 ? "star" : "stars"
                    }`}
                  >
                    <span aria-hidden="true" className="text-sm leading-none">
                      ★
                    </span>
                    {benchmark.pin_count}
                  </span>
                </div>

                <h3 className="line-clamp-2 text-lg font-semibold">
                  {benchmark.title}
                </h3>

                <p className="mt-2 text-xs text-zinc-600">
                  {benchmark.scenario_count ?? 1} scenario
                  {(benchmark.scenario_count ?? 1) === 1 ? "" : "s"}
                </p>

                <span className="mt-6 block text-sm font-medium text-white">
                  Open benchmark →
                </span>
              </Link>
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