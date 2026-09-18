import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      {/* NAVBAR */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="text-xl font-bold tracking-tight">
            AIM<span className="text-zinc-500">BENCH</span>
          </div>

          <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
            <a href="#" className="text-white">Benchmarks</a>
            <a href="#">Leaderboard</a>
            <a href="#">Players</a>
            <a href="#">Compare</a>
          </nav>

          <div className="flex gap-3">
            <button className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white">
              Login
            </button>
            <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">
              Create Account
            </button>
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
            <a href="/benchmarks" className="rounded-xl bg-white px-6 py-3 font-semibold text-black">
              Explore Benchmarks
            </a>

            <a href="/create-benchmark" className="rounded-xl border border-white/10 px-6 py-3 font-semibold text-white hover:bg-white/5">
              Create Benchmark
            </a>
          </div>
        </div>
      </section>

      {/* BENCHMARKS */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Benchmarks</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Official and community-created benchmarks
            </p>
          </div>

          <button className="text-sm text-zinc-400 hover:text-white">
            View all →
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Official Aim Benchmark", "10 scenarios", "Official"],
            ["Tracking Fundamentals", "8 scenarios", "Community"],
            ["Flicking Challenge", "12 scenarios", "Community"],
          ].map(([name, scenarios, type]) => (
            <div
              key={name}
              className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                  {type}
                </span>

                <span className="text-xs text-zinc-600">BENCHMARK</span>
              </div>

              <h3 className="text-lg font-semibold">{name}</h3>

              <p className="mt-2 text-sm text-zinc-500">{scenarios}</p>

              <button className="mt-6 text-sm font-medium text-white">
                Open benchmark →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Link
              href="/benchmarks"
              className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <h3 className="text-lg font-semibold mb-2">Browse All Benchmarks</h3>
              <p className="text-sm text-zinc-500">
                Community-created aim trainer benchmarks across all platforms
              </p>
            </Link>
          </div>
          <div>
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
        </div>
      </section>
    </main>
  );
}