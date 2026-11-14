import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { loadTopPinned } from "@/lib/pins";
import SiteHeader from "@/components/SiteHeader";

interface BenchmarkCard {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  difficulty: string | null;
  scenario_count: number | null;
  rank_names: string[] | null;
  rank_colors: string[] | null;
  created_at: string | null;
  pin_count: number;
}

/** How many starred benchmarks the home page shows. */
const FEATURED_LIMIT = 4;

/** Guard on the card scan, mirroring the list endpoint's cap. */
const CARD_SCAN_LIMIT = 500;

const ACTIONS = [
  {
    href: "/benchmarks",
    label: "Browse benchmarks",
    body: "Search every community ladder in one place.",
    icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  },
  {
    href: "/create-benchmark",
    label: "Create a benchmark",
    body: "Build a scenario list and publish it in minutes.",
    icon: "M12 5v14M5 12h14",
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    body: "See where you stand against every player.",
    icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3",
  },
  {
    href: "/rank-history",
    label: "Rank history",
    body: "Follow every rank change, run by run.",
    icon: "M3 17l6-6 4 4 8-8M15 7h6v6",
  },
] as const;

const STEPS = [
  {
    title: "Link your EasyAim account",
    body: "Connect once from your profile. No downloads and no manual score entry.",
  },
  {
    title: "Play your scenarios",
    body: "Your personal bests are picked up automatically and matched to each benchmark.",
  },
  {
    title: "Climb every ladder",
    body: "See your rank per benchmark, compare on the leaderboard, and track every promotion.",
  },
] as const;

const numberFormat = new Intl.NumberFormat("en-US");

function formatCount(value: number | null): string {
  return value === null ? "—" : numberFormat.format(value);
}

function platformLabel(platform: string): string {
  return platform
    .split(/[\s_-]+/)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function countRows(table: string): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error(`HOME: failed to count ${table}:`, error);
    return null;
  }

  return count ?? 0;
}

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
      →
    </span>
  );
}

function RankPips({
  names,
  colors,
  limit = 6,
}: {
  names: string[] | null;
  colors: string[] | null;
  limit?: number;
}) {
  const pairs = (names ?? []).map((name, index) => ({
    name,
    color: colors?.[index] ?? "var(--border-strong)",
  }));

  if (pairs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {pairs.slice(0, limit).map((pair, index) => (
        <span
          key={`${pair.name}-${index}`}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: pair.color }}
          />
          {pair.name}
        </span>
      ))}
      {pairs.length > limit && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          +{pairs.length - limit}
        </span>
      )}
    </div>
  );
}

function RankStrip({ colors }: { colors: string[] | null }) {
  const palette = (colors ?? []).slice(0, 12);

  return (
    <div className="absolute inset-x-0 top-0 flex h-1.5 overflow-hidden" aria-hidden="true">
      {palette.length > 0 ? (
        palette.map((color, index) => (
          <span key={index} className="flex-1" style={{ backgroundColor: color }} />
        ))
      ) : (
        <span className="flex-1 bg-white/10" />
      )}
    </div>
  );
}

export default async function Home() {
  const accountId = await getSessionAccountId();
  const signedIn = Boolean(accountId);

  // The pin totals decide which benchmarks to feature, and the card columns
  // are cheap, so both go out together with the community totals. One
  // round-trip batch instead of a chain.
  const [pinTotals, cardResult, benchmarkCount, playerCount, scenarioCount] =
    await Promise.all([
      loadTopPinned(),
      supabaseAdmin
        .from("benchmarks")
        .select(
          "id, title, description, platform, difficulty, scenario_count, rank_names, rank_colors, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(CARD_SCAN_LIMIT),
      countRows("benchmarks"),
      countRows("accounts"),
      countRows("benchmark_scenarios"),
    ]);

  if (cardResult.error) {
    console.error("HOME: failed to load benchmark cards:", cardResult.error);
  }

  const pinCountById = new Map(
    pinTotals.map((entry) => [entry.id, entry.pin_count])
  );

  // Only starred benchmarks, most stars first. A benchmark nobody starred is
  // not a recommendation, so an unstarred one is not featured here no matter
  // how recently it was made.
  //
  // Equal star counts break by newest, so the featured row keeps refreshing
  // as the community grows rather than freezing on whichever benchmarks
  // happened to be starred first.
  const benchmarks: BenchmarkCard[] = (cardResult.data || [])
    .map(
      (row) =>
        ({
          ...(row as Omit<BenchmarkCard, "pin_count">),
          pin_count: pinCountById.get((row as { id: string }).id) ?? 0,
        }) as BenchmarkCard
    )
    .filter((card) => card.pin_count > 0)
    .sort(
      (a, b) =>
        b.pin_count - a.pin_count ||
        new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
    )
    .slice(0, FEATURED_LIMIT);

  const [spotlight, ...rest] = benchmarks;
  const stats = [
    { label: "Benchmarks", value: benchmarkCount },
    { label: "Scenarios", value: scenarioCount },
    { label: "Players", value: playerCount },
  ];

  return (
    <main className="min-h-screen text-white">
      <SiteHeader loggedIn={signedIn} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <p className="home-rise eyebrow inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Aim benchmark platform
          </p>

          <h1
            className="home-rise mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "70ms" }}
          >
            Measure your aim.
            <br />
            <span className="text-gradient">Chase your next rank.</span>
          </h1>

          <p
            className="home-rise mx-auto mt-6 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg"
            style={{ animationDelay: "130ms" }}
          >
            AIMBENCH turns your EasyAim personal bests into ranks, leaderboards,
            and progress you can actually see. Pick a benchmark and start
            climbing.
          </p>

          <div
            className="home-rise mt-8 flex flex-wrap justify-center gap-3"
            style={{ animationDelay: "190ms" }}
          >
            <Link href="/benchmarks" className="btn btn-primary">
              Explore benchmarks
              <Arrow />
            </Link>
            <Link href="/create-benchmark" className="btn btn-ghost">
              Create a benchmark
            </Link>
          </div>

          <p
            className="home-rise mt-4 text-xs text-zinc-500"
            style={{ animationDelay: "230ms" }}
          >
            Free to use · Built for the aim community · No manual score entry
          </p>

          <div
            className="home-rise mx-auto mt-12 grid max-w-2xl grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] py-6"
            style={{ animationDelay: "280ms" }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="px-3">
                <p className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">
                  {formatCount(stat.value)}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STARRED BENCHMARKS */}
      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Community picks</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Starred benchmarks
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              The ladders players keep coming back to.
            </p>
          </div>

          <Link
            href="/benchmarks"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
          >
            View all benchmarks <Arrow />
          </Link>
        </div>

        {!spotlight ? (
          <div className="card p-8 sm:p-10">
            <p className="eyebrow">Nothing starred yet</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight">
              Be the first to pick a favorite.
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              Star a benchmark and it becomes a recommendation for everyone
              else looking for their next ladder.
            </p>
            <Link href="/benchmarks" className="btn btn-primary mt-6">
              Browse benchmarks
              <Arrow />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-12">
            <Link
              href={`/benchmarks/${spotlight.id}`}
              className="card card-hover group relative flex flex-col overflow-hidden p-6 pt-8 sm:p-8 sm:pt-9 lg:col-span-7"
            >
              <RankStrip colors={spotlight.rank_colors} />

              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">{platformLabel(spotlight.platform)}</span>
                  <span className="chip capitalize">
                    {spotlight.difficulty || "medium"}
                  </span>
                  <span className="chip">
                    {spotlight.scenario_count ?? 1} scenario
                    {(spotlight.scenario_count ?? 1) === 1 ? "" : "s"}
                  </span>
                </div>

                <span
                  className="shrink-0 text-2xl leading-none text-amber-300 [text-shadow:0_0_14px_rgba(252,211,77,0.6)]"
                  title="Starred by the community"
                >
                  ★
                </span>
              </div>

              <h3 className="mt-6 text-2xl font-bold leading-tight tracking-tight transition-colors group-hover:text-accent sm:text-4xl">
                {spotlight.title}
              </h3>

              <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-zinc-400">
                {spotlight.description ||
                  "A community-built ladder of aim scenarios, with its own rank thresholds and a place on the leaderboard."}
              </p>

              <div className="mt-6">
                <RankPips
                  names={spotlight.rank_names}
                  colors={spotlight.rank_colors}
                />
              </div>

              <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
                <p className="text-xs text-zinc-500">
                  {spotlight.rank_names?.length ?? 0} ranks ·{" "}
                  {spotlight.pin_count} star
                  {spotlight.pin_count === 1 ? "" : "s"}
                </p>
                <span className="btn btn-primary">
                  Open benchmark
                  <Arrow />
                </span>
              </div>
            </Link>

            <div className="flex flex-col gap-4 lg:col-span-5">
              {rest.map((benchmark) => {
                const count = benchmark.scenario_count ?? 1;

                return (
                  <Link
                    key={benchmark.id}
                    href={`/benchmarks/${benchmark.id}`}
                    className="card card-hover group flex items-center gap-4 p-4 sm:p-5"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                      <Icon d="M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" size={18} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        {platformLabel(benchmark.platform)} · {count} scenario
                        {count === 1 ? "" : "s"}
                      </span>
                      <span className="mt-1 block truncate text-base font-semibold transition-colors group-hover:text-accent">
                        {benchmark.title}
                      </span>
                    </span>

                    <span className="shrink-0 text-amber-300/80" aria-hidden="true">
                      ★
                    </span>
                    <span className="shrink-0 text-zinc-600 transition-colors group-hover:text-accent">
                      <Arrow />
                    </span>
                  </Link>
                );
              })}

              {rest.length < 3 && (
                <Link
                  href="/benchmarks"
                  className="group flex flex-1 items-center gap-4 rounded-2xl border border-dashed border-white/15 p-4 transition-colors hover:border-accent/40 hover:bg-accent/5 sm:p-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-500 transition-colors group-hover:border-accent/30 group-hover:text-accent">
                    <Icon d="M12 5v14M5 12h14" size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Find another ladder</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Browse every benchmark in the community
                    </span>
                  </span>
                  <span className="shrink-0 text-zinc-600 transition-colors group-hover:text-accent">
                    <Arrow />
                  </span>
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* QUICK ACTIONS */}
      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="mb-8">
          <p className="eyebrow">Jump back in</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Everything in one place
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Browse, build, compete, and keep an eye on the climb.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="card card-hover group flex flex-col p-5 sm:p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                <Icon d={action.icon} />
              </span>
              <h3 className="mt-5 text-base font-semibold transition-colors group-hover:text-accent">
                {action.label}
              </h3>
              <p className="mt-1 text-sm leading-6 text-zinc-500">{action.body}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600 transition-colors group-hover:text-accent">
                Open <Arrow />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              From first run to next rank.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-zinc-500">
              AIMBENCH does the bookkeeping. You focus on the scenarios, and
              every personal best is matched against the benchmark ladders you
              care about.
            </p>
            <Link
              href={signedIn ? "/profile" : "/register"}
              className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              {signedIn ? "Open your profile" : "Create your free account"}
              <Arrow />
            </Link>
          </div>

          <ol className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="card flex gap-4 p-4 sm:p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-mono text-xs font-bold text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-sm font-semibold sm:text-base">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-accent/30 p-6 sm:p-10 lg:p-12"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--accent) 10%, var(--card-bg)), color-mix(in oklab, var(--accent-2) 8%, var(--card-bg)))",
          }}
        >
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
            style={{ background: "color-mix(in oklab, var(--accent) 40%, transparent)" }}
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Your move</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Your next rank is one run away.
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Pick a benchmark, play the scenarios, and let AIMBENCH turn your
                scores into a rank you can chase.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/benchmarks" className="btn btn-primary">
                Explore benchmarks
                <Arrow />
              </Link>
              <Link
                href={signedIn ? "/profile" : "/register"}
                className="btn btn-ghost"
              >
                {signedIn ? "Go to profile" : "Create free account"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-zinc-500">
            <span className="font-semibold text-white">AIM</span>
            <span className="font-semibold text-zinc-500">BENCH</span> — built
            for the aim community.
          </p>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
            <Link href="/benchmarks" className="hover:text-white">Benchmarks</Link>
            <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
            <Link href="/rank-history" className="hover:text-white">Rank history</Link>
            <Link href="/groups" className="hover:text-white">Groups</Link>
            <Link href="/create-benchmark" className="hover:text-white">Create</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
