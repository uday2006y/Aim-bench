import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import BenchmarkClient from "./BenchmarkClient";
import { loadViewerPins } from "@/lib/pins";

/** A benchmark_scenarios row, plus the viewer's best attached below. */
interface ScenarioDetailRow {
  id: string;
  easyaim_scenario_id: number;
  title: string;
  position: number;
  category: string | null;
  sub_category: string | null;
  cutoffs: Record<string, number> | null;
}

export default async function BenchmarkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = await getSessionAccountId();

  // Four queries, and only the first actually gates the rest — the not-found
  // branch. The benchmark id comes from the URL, so the scenarios, the
  // viewer's personal bests and their stars are all knowable before the
  // benchmark row arrives. Awaiting them in sequence was five round trips to a
  // database on another continent to render one page; the only one that has to
  // go first is the benchmark itself.
  //
  // This used to read the viewer's benchmark_scores history as well and hand
  // it to the table. The table never rendered it — the manual score-entry
  // form it belonged to had already been removed — so that was a round trip
  // and a serialised payload for nothing.
  const benchmarkResult = await supabaseAdmin
    .from("benchmarks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const benchmark = benchmarkResult.data;
  const benchErr = benchmarkResult.error;

  if (benchErr || !benchmark) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-white">
        <div className="text-center">
          <p className="text-zinc-400">Benchmark not found.</p>
          <Link href="/benchmarks" className="mt-4 inline-block text-sm hover:underline">← Back to benchmarks</Link>
        </div>
      </main>
    );
  }

  const [scenarioResult, pbResult, myPins] = await Promise.all([
    supabaseAdmin
      .from("benchmark_scenarios")
      .select("id, easyaim_scenario_id, title, position, category, sub_category, cutoffs")
      .eq("benchmark_id", id)
      .order("position", { ascending: true }),

    // Keyed by account rather than by the scenario ids above, so this does
    // not have to wait for them. The rows that do not belong to this
    // benchmark are dropped when the map is applied.
    accountId
      ? supabaseAdmin
          .from("easyaim_pbs")
          .select("scenario_id, score")
          .eq("account_id", accountId)
      : null,

    loadViewerPins(accountId),
  ]);

  const scenarioIds = new Set(
    (scenarioResult.data ?? []).map((s) => Number(s.easyaim_scenario_id))
  );

  const pbMap = new Map<number, number>();
  for (const row of (pbResult?.data ?? []) as { scenario_id: number; score: number }[]) {
    if (scenarioIds.has(Number(row.scenario_id))) {
      pbMap.set(Number(row.scenario_id), row.score);
    }
  }

  const scenarios = ((scenarioResult.data ?? []) as ScenarioDetailRow[]).map((s) => ({
    id: s.id,
    easyaim_scenario_id: s.easyaim_scenario_id,
    title: s.title,
    position: s.position,
    category: s.category || "Other",
    sub_category: s.sub_category || "",
    cutoffs: s.cutoffs || {},
    best_score: pbMap.get(Number(s.easyaim_scenario_id)) ?? 0,
  }));

  const isAuthorized = !!(
    benchmark.user_id &&
    accountId &&
    benchmark.user_id === accountId
  );

  return (
    <BenchmarkClient
      id={id}
      benchmark={benchmark}
      scenarios={scenarios}
      isAuthorized={isAuthorized}
      myPinned={myPins.has(id)}
      loggedIn={Boolean(accountId)}
    />
  );
}
