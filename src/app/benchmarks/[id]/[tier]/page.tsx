import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { loadTierScenarios, loadTiers } from "@/lib/tiers";
import { loadViewerPins } from "@/lib/pins";
import BenchmarkClient from "../BenchmarkClient";

/**
 * One tier of a benchmark: its scenarios, scored against its own ladder.
 *
 * A tier owns its scenarios, so there is no benchmark-wide list to filter —
 * this reads the tier's rows and that is the page.
 */
export default async function BenchmarkTierPage({
  params,
}: {
  params: Promise<{ id: string; tier: string }>;
}) {
  const { id, tier: tierSlug } = await params;

  // The tier list is needed twice — once to find this one, once for the
  // switcher — and both are knowable from the benchmark id, so they go out
  // together with the session read rather than in sequence.
  const [tiers, accountId] = await Promise.all([
    loadTiers(id),
    getSessionAccountId(),
  ]);

  // No tiers at all means a database that has not had the tier block run.
  // Say so plainly: the alternative is a table with no columns and no
  // explanation, which is the failure mode this project keeps hitting.
  if (tiers.length === 0) {
    return <TiersNotInstalled />;
  }

  const tier = tiers.find((candidate) => candidate.slug === tierSlug);

  if (!tier) {
    notFound();
  }

  const [benchmarkResult, scenarioRows, myPins] = await Promise.all([
    supabaseAdmin.from("benchmarks").select("*").eq("id", id).maybeSingle(),

    loadTierScenarios(tier.id),

    loadViewerPins(accountId),
  ]);

  const benchmark = benchmarkResult.data;

  if (benchmarkResult.error || !benchmark) {
    return (
      <main className="min-h-screen bg-app text-white">
        <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
          <p className="text-zinc-400">Benchmark not found.</p>
          <Link href="/benchmarks" className="mt-4 text-sm hover:underline">
            ← Back to benchmarks
          </Link>
        </div>
      </main>
    );
  }

  const scenarioIds = new Set(
    scenarioRows.map((s) => String(s.easyaim_scenario_id))
  );

  // Bests are keyed by account, so this does not have to wait for the
  // scenarios above it.
  const pbResult = accountId
    ? await supabaseAdmin
        .from("easyaim_pbs")
        .select("scenario_id, score")
        .eq("account_id", accountId)
    : null;

  const pbMap = new Map<string, number>();
  for (const row of (pbResult?.data ?? []) as { scenario_id: string; score: number }[]) {
    if (scenarioIds.has(String(row.scenario_id))) {
      pbMap.set(String(row.scenario_id), row.score);
    }
  }

  const scenarios = scenarioRows.map((s) => ({
    id: s.id,
    easyaim_scenario_id: String(s.easyaim_scenario_id),
    title: s.title,
    position: s.position,
    category: s.category || "Other",
    sub_category: s.sub_category || "",
    cutoffs: s.cutoffs || {},
    best_score: pbMap.get(String(s.easyaim_scenario_id)) ?? 0,
  }));

  const isAuthorized = Boolean(
    benchmark.user_id && accountId && benchmark.user_id === accountId
  );

  return (
    <BenchmarkClient
      id={id}
      benchmark={benchmark}
      tier={tier}
      tiers={tiers}
      scenarios={scenarios}
      isAuthorized={isAuthorized}
      myPinned={myPins.has(id)}
      loggedIn={Boolean(accountId)}
    />
  );
}

function TiersNotInstalled() {
  return (
    <main className="min-h-screen bg-app text-white">
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Tiers are not set up</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          This benchmark has no tiers, which means the tier tables have not been
          created on the database yet. Run the tier block at the bottom of{" "}
          <code className="font-mono text-xs text-zinc-300">supabase-final.sql</code>{" "}
          and reload — it creates the tables, gives every existing benchmark a
          default tier, and hands its existing scenarios to that tier.
        </p>
        <Link
          href="/benchmarks"
          className="mt-8 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
        >
          Back to benchmarks
        </Link>
      </div>
    </main>
  );
}
