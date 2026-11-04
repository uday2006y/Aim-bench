import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import { getScenarioBestRuns, type EasyAimRun } from "./easyaim";
import { pruneRuns, recordAggregatesFor, type NewPb } from "./easyaimSync";

const CONCURRENCY = 5;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A sync of ONE benchmark is a person watching a button, so it trades a short
// burst of requests for speed: every scenario goes out at once (up to this
// many), each asks for only the top few records, and a failed request gets one
// more try. If EasyAim ever starts answering 429, lower SCOPED_CONCURRENCY.
// The full sync keeps the gentler numbers above.
const SCOPED_CONCURRENCY = 30;
const SCOPED_PAGE_LIMIT = 5;
const SCOPED_ATTEMPTS = 2;

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
  accountId: string,
  options: {
    /**
     * Only scan the scenarios that belong to this benchmark. Omitted, every
     * scenario on the site is scanned, exactly as before.
     */
    benchmarkId?: string;
  } = {}
): Promise<SiteSyncResult> {
  const scopeBenchmarkId = options.benchmarkId;

  // A benchmark id is a uuid. Anything else cannot match a row, and handing it
  // to the database would be an error where "nothing to sync" is the answer.
  if (scopeBenchmarkId && !UUID.test(scopeBenchmarkId)) {
    return { scanned: 0, saved: 0, newPbs: [], benchmarksUpdated: 0, failed: 0, backfillDone: true };
  }

  let scenarioQuery = supabaseAdmin
    .from("benchmark_scenarios")
    .select("benchmark_id, easyaim_scenario_id, title");

  // Scoped, only this benchmark's rows are read. It used to read every
  // scenario on the site and filter in memory, which grows with the site, and
  // which the database quietly truncates at a thousand rows.
  if (scopeBenchmarkId) {
    scenarioQuery = scenarioQuery.eq("benchmark_id", scopeBenchmarkId);
  }

  // None of these three reads depends on another, so they go out together
  // instead of one after the other.
  const [linkResult, scenarioResult, storedResult] = await Promise.all([
    supabaseAdmin
      .from("easyaim_links")
      .select("easyaim_player_id")
      .eq("account_id", accountId)
      .maybeSingle(),
    scenarioQuery,
    supabaseAdmin
      .from("easyaim_pbs")
      .select("scenario_id, score")
      .eq("account_id", accountId),
  ]);

  const { data: linkData, error: linkError } = linkResult;

  if (linkError) throw linkError;
  if (!linkData) throw new Error("No EasyAim account linked");

  const playerId = (linkData as { easyaim_player_id: number | string })
    .easyaim_player_id;

  const { data: scenarioRows, error: scenarioError } = scenarioResult;

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

  // When scoped, the rows are already only this benchmark's. A benchmark that
  // shares one of these scenarios is found further down, and only if that
  // scenario's best actually changed.
  const scenarioIds = scopeBenchmarkId
    ? [
        ...new Set(
          rows
            .filter((row) => row.benchmark_id === scopeBenchmarkId)
            .map((row) => String(row.easyaim_scenario_id))
        ),
      ]
    : [...titles.keys()];

  if (scenarioIds.length === 0) {
    return { scanned: 0, saved: 0, newPbs: [], benchmarksUpdated: 0, failed: 0, backfillDone: true };
  }

  const best = new Map<string, EasyAimRun>();
  let failed = 0;
  let next = 0;

  const concurrency = scopeBenchmarkId ? SCOPED_CONCURRENCY : CONCURRENCY;
  const pageLimit = scopeBenchmarkId ? SCOPED_PAGE_LIMIT : 100;
  const attempts = scopeBenchmarkId ? SCOPED_ATTEMPTS : 1;

  async function worker() {
    while (next < scenarioIds.length) {
      const scenarioId = scenarioIds[next++];

      for (let attempt = 1; ; attempt += 1) {
        try {
          const page = await getScenarioBestRuns(playerId, scenarioId, pageLimit);
          let top: EasyAimRun | null = null;
          for (const r of page.data) {
            if (String(r.scenarioId) !== scenarioId) continue;
            if (!top || r.score > top.score) top = r;
          }
          if (top) best.set(scenarioId, top);
          break;
        } catch (error) {
          if (attempt < attempts) continue;

          failed += 1;
          console.error("EASYAIM SITE SYNC: scenario failed:", scenarioId, error);
          break;
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, scenarioIds.length) }, worker)
  );

  if (failed === scenarioIds.length) {
    throw new Error("EasyAim requests failed for every scenario");
  }

  const { data: storedRows, error: storedError } = storedResult;
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
    // The personal bests are the write that matters, so it goes first. When
    // scoped, the lookup of other benchmarks that share a changed scenario
    // goes out with it, since they are independent.
    const [pbWrite, sharing] = await Promise.all([
      supabaseAdmin
        .from("easyaim_pbs")
        .upsert(changed, { onConflict: "account_id,scenario_id" }),
      scopeBenchmarkId
        ? supabaseAdmin
            .from("benchmark_scenarios")
            .select("benchmark_id, easyaim_scenario_id")
            .in(
              "easyaim_scenario_id",
              changed.map((c) => c.scenario_id)
            )
        : null,
    ]);

    if (pbWrite.error) throw pbWrite.error;

    // A scenario this benchmark shares with another one changes that
    // benchmark's score too, so it is recomputed as well.
    for (const row of (sharing?.data ?? []) as {
      benchmark_id: string;
      easyaim_scenario_id: string;
    }[]) {
      const id = String(row.easyaim_scenario_id);
      if (!benchmarksByScenario.has(id)) benchmarksByScenario.set(id, new Set());
      benchmarksByScenario.get(id)!.add(row.benchmark_id);
    }
  }

  const scanned = new Set(scenarioIds);
  const hasPb = new Set<string>(
    [...stored.keys(), ...best.keys()].filter(
      (scenarioId) => !scopeBenchmarkId || scanned.has(scenarioId)
    )
  );
  const benchmarkIds = new Set<string>();
  for (const scenarioId of hasPb) {
    for (const id of benchmarksByScenario.get(scenarioId) ?? []) benchmarkIds.add(id);
  }

  // Keeps the run itself for the Recent runs panel, then trims the old ones.
  async function storeRuns() {
    if (changed.length === 0) return;

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
    else await pruneRuns(accountId);
  }

  // The personal bests are already written, so none of these depends on
  // another: the rank recompute reads them, the runs are a side record, and the
  // timestamp is a single row. They used to run one after the other.
  const [benchmarksUpdated] = await Promise.all([
    benchmarkIds.size > 0
      ? recordAggregatesFor(accountId, [...benchmarkIds])
      : Promise.resolve(0),
    storeRuns(),
    supabaseAdmin
      .from("easyaim_links")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("account_id", accountId),
  ]);

  return {
    scanned: scenarioIds.length,
    saved: changed.length,
    newPbs,
    benchmarksUpdated,
    failed,
    backfillDone: true,
  };
}