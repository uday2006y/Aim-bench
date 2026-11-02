import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import { getScenarioBestRuns, type EasyAimRun } from "./easyaim";
import { recordAggregatesFor, type NewPb } from "./easyaimSync";

const CONCURRENCY = 5;

export interface SiteSyncResult {
  scanned: number;
  saved: number;
  newPbs: NewPb[];
  benchmarksUpdated: number;
  failed: number;
  backfillDone: boolean;
}

/**
 * Pulls a player's MOBILE personal best for every scenario that is part of a
 * benchmark on this site, and nothing else. One small request per scenario.
 * A personal best is only ever raised.
 */
export async function syncSiteScenarios(
  accountId: string
): Promise<SiteSyncResult> {
  const { data: linkData, error: linkError } = await supabaseAdmin
    .from("easyaim_links")
    .select("easyaim_player_id")
    .eq("account_id", accountId)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!linkData) throw new Error("No EasyAim account linked");

  const playerId = (linkData as { easyaim_player_id: number | string })
    .easyaim_player_id;

  const { data: scenarioRows, error: scenarioError } = await supabaseAdmin
    .from("benchmark_scenarios")
    .select("benchmark_id, easyaim_scenario_id, title");

  if (scenarioError) throw scenarioError;

  const rows = (scenarioRows ?? []) as {
    benchmark_id: string;
    easyaim_scenario_id: string;
    title: string;
  }[];

  const titles = new Map<string, string>();
  const benchmarksByScenario = new Map<string, Set<string>>();
  for (const row of rows) {
    const id = String(row.easyaim_scenario_id);
    if (!titles.has(id)) titles.set(id, row.title);
    if (!benchmarksByScenario.has(id)) benchmarksByScenario.set(id, new Set());
    benchmarksByScenario.get(id)!.add(row.benchmark_id);
  }

  const scenarioIds = [...titles.keys()];

  if (scenarioIds.length === 0) {
    return { scanned: 0, saved: 0, newPbs: [], benchmarksUpdated: 0, failed: 0, backfillDone: true };
  }

  const storedPromise = supabaseAdmin
    .from("easyaim_pbs")
    .select("scenario_id, score")
    .eq("account_id", accountId);

  const best = new Map<string, EasyAimRun>();
  let failed = 0;
  let next = 0;

    async function worker() {
    while (next < scenarioIds.length) {
      const scenarioId = scenarioIds[next++];
      try {
        const page = await getScenarioBestRuns(playerId, scenarioId, 100);
        let top: EasyAimRun | null = null;
        for (const r of page.data) {
          if (String(r.scenarioId) !== scenarioId) continue;
          if (!top || r.score > top.score) top = r;
        }
        if (top) best.set(scenarioId, top);
      } catch (error) {
        failed += 1;
        console.error("EASYAIM SITE SYNC: scenario failed:", scenarioId, error);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, scenarioIds.length) }, worker)
  );

  if (failed === scenarioIds.length) {
    throw new Error("EasyAim requests failed for every scenario");
  }

  const { data: storedRows, error: storedError } = await storedPromise;
  if (storedError) throw storedError;

  const stored = new Map<string, number>();
  for (const row of (storedRows ?? []) as { scenario_id: string; score: number }[]) {
    stored.set(String(row.scenario_id), Number(row.score));
  }

  const changed: {
    account_id: string;
    scenario_id: string;
    score: number;
    run_id: number;
    achieved_at: string;
  }[] = [];
  const newPbs: NewPb[] = [];

  for (const [scenarioId, run] of best) {
    const previous = stored.get(scenarioId) ?? null;
    if (previous !== null && run.score <= previous) continue;

    changed.push({
      account_id: accountId,
      scenario_id: scenarioId,
      score: run.score,
      run_id: run.id,
      achieved_at: new Date(run.playedAt * 1000).toISOString(),
    });
    newPbs.push({
      scenarioId,
      title: titles.get(scenarioId) || `Scenario ${scenarioId}`,
      score: run.score,
      previous,
    });
  }

  if (changed.length > 0) {
    const { error } = await supabaseAdmin
      .from("easyaim_pbs")
      .upsert(changed, { onConflict: "account_id,scenario_id" });
    if (error) throw error;

    const { error: runsError } = await supabaseAdmin.from("easyaim_runs").upsert(
      changed.map((c) => ({
        account_id: accountId,
        run_id: c.run_id,
        scenario_id: c.scenario_id,
        score: c.score,
        played_at: c.achieved_at,
      })),
      { onConflict: "account_id,run_id" }
    );
    if (runsError) console.error("EASYAIM SITE SYNC: could not store runs:", runsError);
  }

  const hasPb = new Set<string>([...stored.keys(), ...best.keys()]);
  const benchmarkIds = new Set<string>();
  for (const scenarioId of hasPb) {
    for (const id of benchmarksByScenario.get(scenarioId) ?? []) benchmarkIds.add(id);
  }

  const benchmarksUpdated =
    benchmarkIds.size > 0
      ? await recordAggregatesFor(accountId, [...benchmarkIds])
      : 0;

  await supabaseAdmin
    .from("easyaim_links")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("account_id", accountId);

  return {
    scanned: scenarioIds.length,
    saved: changed.length,
    newPbs,
    benchmarksUpdated,
    failed,
    backfillDone: true,
  };
}