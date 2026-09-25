import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import BenchmarkClient from "./BenchmarkClient";

export default async function BenchmarkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: benchmark, error: benchErr } = await supabaseAdmin
    .from("benchmarks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

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

  const { data: scenarioRows } = await supabaseAdmin
    .from("benchmark_scenarios")
    .select("id, easyaim_scenario_id, title, position, cutoffs")
    .eq("benchmark_id", id)
    .order("position", { ascending: true });

  const scenarios = (scenarioRows || []).map((s: any) => ({
    id: s.id,
    easyaim_scenario_id: s.easyaim_scenario_id,
    title: s.title,
    position: s.position,
    cutoffs: s.cutoffs || {},
    best_score: 0,
  }));

  const accountId = await getSessionAccountId();
  const isAuthorized = !!(benchmark.user_id && accountId && benchmark.user_id === accountId);

  if (accountId && scenarios.length > 0) {
    const scenarioIds = scenarios.map((s) => s.easyaim_scenario_id);
    const { data: pbRows } = await supabaseAdmin
      .from("easyaim_pbs")
      .select("scenario_id, score")
      .eq("account_id", accountId)
      .in("scenario_id", scenarioIds);
    const pbMap = new Map<number, number>();
    for (const row of pbRows || []) {
      const pb = row as { scenario_id: number; score: number };
      pbMap.set(pb.scenario_id, pb.score);
    }
    for (const scenario of scenarios) {
      scenario.best_score = pbMap.get(scenario.easyaim_scenario_id) ?? 0;
    }
  }

  let myScores: any[] = [];
  if (accountId) {
    const { data: scoreData } = await supabaseAdmin
      .from("benchmark_scores")
      .select("id, benchmark_id, score, rank, completed_at")
      .eq("benchmark_id", id)
      .eq("user_id", accountId)
      .order("completed_at", { ascending: false })
      .limit(50);
    myScores = scoreData || [];
  }

  return (
    <BenchmarkClient
      id={id}
      benchmark={benchmark}
      scenarios={scenarios}
      myScores={myScores}
      isAuthorized={isAuthorized}
    />
  );
}
