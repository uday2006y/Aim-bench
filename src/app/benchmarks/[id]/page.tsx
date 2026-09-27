import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import BenchmarkClient from "./BenchmarkClient";
import { loadViewerPins } from "@/lib/pins";

export default async function BenchmarkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = await getSessionAccountId();

  // Six queries, and only the first actually gates the rest — the not-found
  // branch. The benchmark id comes from the URL, so the scenarios, the
  // viewer's personal bests, their score history and their stars are all
  // knowable before the benchmark row arrives. Awaiting them in sequence
  // was five round trips to a database on another continent to render one
  // page; the only one that has to go first is the benchmark itself.
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

  const [scenarioResult, pbResult, scoreResult, myPins] = await Promise.all([
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

    accountId
      ? supabaseAdmin
          .from("benchmark_scores")
          .select("id, benchmark_id, score, rank, completed_at")
          .eq("benchmark_id", id)
          .eq("user_id", accountId)
          .order("completed_at", { ascending: false })
          .limit(50)
      : null,

    loadViewerPins(accountId),
  ]);

  const scenarioIds = new Set(
    (scenarioResult.data || []).map((s: any) => Number(s.easyaim_scenario_id))
  );

  const pbMap = new Map<number, number>();
  for (const row of pbResult?.data || []) {
    const pb = row as { scenario_id: number; score: number };
    if (scenarioIds.has(Number(pb.scenario_id))) {
      pbMap.set(Number(pb.scenario_id), pb.score);
    }
  }

  const scenarios = (scenarioResult.data || []).map((s: any) => ({
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
      myScores={scoreResult?.data || []}
      isAuthorized={isAuthorized}
      myPinned={myPins.has(id)}
      loggedIn={Boolean(accountId)}
    />
  );
}
