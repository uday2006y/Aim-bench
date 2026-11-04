import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { loadTiers, type ScenarioRow } from "@/lib/tiers";
import { computeTrackedScenarios, scenarioGate, type GateScenario } from "@/lib/tierGates";
import { loadViewerPins } from "@/lib/pins";
import BenchmarkClient from "./BenchmarkClient";

/** Cap on how many scenario rows one benchmark read will pull. */
const SCENARIO_LIMIT = 5000;

type BenchmarkScenarioRow = ScenarioRow & { tier_id: string | null };

/**
 * One tier of a benchmark, scored against its own ladder. With no `tierSlug`
 * it shows the benchmark's first tier, which is what `/benchmarks/<id>` means.
 *
 * Everything this page needs is keyed by the benchmark id or the account id,
 * and neither depends on another read, so it is ONE round trip to the
 * database. It used to be four in a row (tiers, then the benchmark and this
 * tier's scenarios, then the viewer's bests, then every tier's scenarios and
 * the bests again), after a redirect that cost another request of its own.
 * With the database on another continent each of those was a few hundred
 * milliseconds spent waiting.
 *
 * This lives in a component, not in a page file, because a page file may only
 * export the page itself, and two routes render it.
 */
export default async function BenchmarkTierView({
  id,
  tierSlug,
}: {
  id: string;
  tierSlug?: string;
}) {
  // Reads a cookie and checks a signature. No network.
  const accountId = await getSessionAccountId();

  const [tiers, benchmarkResult, scenarioResult, pbResult, myPins] =
    await Promise.all([
      loadTiers(id),

      supabaseAdmin.from("benchmarks").select("*").eq("id", id).maybeSingle(),

      // Every tier's scenarios in one read. This tier's rows are picked out in
      // memory below, and the tier gates need all of them anyway.
      supabaseAdmin
        .from("benchmark_scenarios")
        .select("id, tier_id, easyaim_scenario_id, title, position, category, sub_category, cutoffs")
        .eq("benchmark_id", id)
        .order("position", { ascending: true })
        .limit(SCENARIO_LIMIT),

      accountId
        ? supabaseAdmin
            .from("easyaim_pbs")
            .select("scenario_id, score")
            .eq("account_id", accountId)
        : null,

      loadViewerPins(accountId),
    ]);

  const benchmark = benchmarkResult.data;

  // Checked before the tiers: an id that matches no benchmark has no tiers
  // either, and "tiers are not set up" would be the wrong thing to tell
  // someone who followed an old link.
  if (benchmarkResult.error || !benchmark) {
    return (
      <main className="min-h-screen text-white">
        <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
          <p className="text-zinc-400">Benchmark not found.</p>
          <Link href="/benchmarks" className="mt-4 text-sm hover:underline">
            ← Back to benchmarks
          </Link>
        </div>
      </main>
    );
  }

  // No tiers at all means a database that has not had the tier block run.
  // Say so plainly: the alternative is a table with no columns and no
  // explanation.
  if (tiers.length === 0) {
    return <TiersNotInstalled />;
  }

  const tier = tierSlug
    ? tiers.find((candidate) => candidate.slug === tierSlug)
    : tiers[0];

  if (!tier) {
    notFound();
  }

  if (scenarioResult.error) {
    console.error("BENCHMARK: failed to load scenarios:", scenarioResult.error);
  }

  const allRows = (scenarioResult.data ?? []) as unknown as BenchmarkScenarioRow[];
  const tierRows = allRows.filter((row) => row.tier_id === tier.id);

  // One map of the viewer's bests, used for this tier's rows and for the
  // gates across every tier. It used to be fetched twice.
  const pbByScenario = new Map<string, number>();
  for (const row of (pbResult?.data ?? []) as { scenario_id: string; score: number }[]) {
    pbByScenario.set(String(row.scenario_id), row.score);
  }

  const scenarios = tierRows.map((s) => ({
    id: s.id,
    easyaim_scenario_id: String(s.easyaim_scenario_id),
    title: s.title,
    position: s.position,
    category: s.category || "Other",
    sub_category: s.sub_category || "",
    cutoffs: s.cutoffs || {},
    best_score: pbByScenario.get(String(s.easyaim_scenario_id)) ?? 0,
  }));

  const isAuthorized = Boolean(
    benchmark.user_id && accountId && benchmark.user_id === accountId
  );

  // Tiers unlock in order: this one only starts tracking once every tier before
  // it is finished. Deciding that needs every tier's scenarios and the viewer's
  // bests on all of them, which are the two reads already made above.
  const scenariosByTierSlug = new Map<string, GateScenario[]>();
  for (const ref of tiers) scenariosByTierSlug.set(ref.slug, []);

  for (const row of allRows) {
    const owner = tiers.find((candidate) => candidate.id === row.tier_id);
    if (!owner) continue;
    const list = scenariosByTierSlug.get(owner.slug) ?? [];
    list.push({
      easyaim_scenario_id: String(row.easyaim_scenario_id),
      cutoffs: row.cutoffs,
      pb: pbByScenario.get(String(row.easyaim_scenario_id)) ?? null,
    });
    scenariosByTierSlug.set(owner.slug, list);
  }

  // Which scenarios are tracking in which tier. Per scenario: a row opens in
  // this tier once that same scenario cleared the previous tier's final rank,
  // and rows that have not are reported as untracked rather than as a locked
  // tier.
  const tracked = computeTrackedScenarios(tiers, scenariosByTierSlug);

  const gatedRows = scenarios
    .filter(
      (scenario) =>
        !tracked.get(tier.slug)?.has(String(scenario.easyaim_scenario_id))
    )
    .map((scenario) => ({
      easyaim_scenario_id: String(scenario.easyaim_scenario_id),
      waitingFor:
        scenarioGate(tiers, scenariosByTierSlug, tier.slug, String(scenario.easyaim_scenario_id)) ??
        null,
    }));

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
      gatedRows={gatedRows}
      previousTierName={
        tiers.filter((candidate) => candidate.position < tier.position).pop()?.name ?? null
      }
    />
  );
}

function TiersNotInstalled() {
  return (
    <main className="min-h-screen text-white">
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
