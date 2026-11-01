import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface RunRow {
  run_id: number;
  scenario_id: string;
  score: number;
  played_at: string;
}

export default async function RecentRuns({ accountId }: { accountId: string }) {
  const [runsResult, titlesResult, pbsResult] = await Promise.all([
    supabaseAdmin
      .from("easyaim_runs")
      .select("run_id, scenario_id, score, played_at")
      .eq("account_id", accountId)
      .order("played_at", { ascending: false })
      .limit(25),

    supabaseAdmin
      .from("benchmark_scenarios")
      .select("easyaim_scenario_id, title")
      .limit(5000),

    supabaseAdmin
      .from("easyaim_pbs")
      .select("scenario_id, score")
      .eq("account_id", accountId),
  ]);

  // Table not created yet (or a read failed): show nothing rather than break
  // the profile page.
  if (runsResult.error) return null;

  const runs = (runsResult.data || []) as RunRow[];

  const titles = new Map<string, string>();
  for (const row of titlesResult.data || []) {
    const scenario = row as { easyaim_scenario_id: string | number; title: string };
    const key = String(scenario.easyaim_scenario_id);
    if (!titles.has(key)) titles.set(key, scenario.title);
  }

  const bests = new Map<string, number>();
  for (const row of pbsResult.data || []) {
    const pb = row as { scenario_id: string | number; score: number };
    bests.set(String(pb.scenario_id), pb.score);
  }

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <h2 className="text-lg font-semibold mb-1">Recent runs</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Every run on a benchmark scenario, personal best or not. Your rank
        still counts only your best.
      </p>

      {runs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No runs stored yet. Click Sync now, or play a benchmark scenario.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-2 font-medium">Scenario</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2 font-medium">Played</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const best = bests.get(String(run.scenario_id));
                const isBest = best !== undefined && run.score >= best;

                return (
                  <tr key={run.run_id} className="border-t border-zinc-900">
                    <td className="py-2 pr-4">
                      {titles.get(String(run.scenario_id)) ??
                        `Scenario ${run.scenario_id}`}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {run.score.toLocaleString(undefined, {
                        maximumFractionDigits: 3,
                      })}
                      {isBest && (
                        <span className="ml-2 rounded bg-green-950/40 px-1.5 py-0.5 text-xs text-green-400">
                          PB
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-zinc-500">
                      {new Date(run.played_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}