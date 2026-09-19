import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || "kovaiacks";
    const q = searchParams.get("q");

    let query = supabaseAdmin.from("benchmarks").select("*");

    if (platform && platform !== "all") {
      query = query.eq("platform", platform);
    }

    if (q) {
      query = query.ilike("title", `%${q}%`);
    }

    const { data: benchmarks, error } = await query;

    if (error) throw error;

    return NextResponse.json({ benchmarks });
  } catch (error) {
    console.error("BENCHMARKS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch benchmarks" },
      { status: 500 }
    );
  }
}

interface ScenarioInput {
  easyaimScenarioId: number;
  title: string;
  cutoffs: Record<string, number>;
}

function sanitizeScenarios(input: unknown): ScenarioInput[] {
  if (!Array.isArray(input)) return [];

  const scenarios: ScenarioInput[] = [];
  const seen = new Set<number>();

  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const record = item as { id?: unknown; title?: unknown; cutoffs?: unknown };
    const id = Number(record.id);

    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);

    const cutoffs: Record<string, number> = {};

    if (record.cutoffs && typeof record.cutoffs === "object") {
      for (const [rank, value] of Object.entries(
        record.cutoffs as Record<string, unknown>
      )) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric >= 0) {
          cutoffs[rank] = numeric;
        }
      }
    }

    const title =
      typeof record.title === "string" && record.title.trim()
        ? record.title.trim().slice(0, 200)
        : `EasyAim Scenario ${id}`;

    scenarios.push({ easyaimScenarioId: id, title, cutoffs });
  }

  return scenarios.slice(0, 50);
}

export async function POST(request: Request) {
  try {
    const { title, description, platform, difficulty, scenarioCount, scenarios } =
      await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const accountId = await getSessionAccountId();

    if (!accountId) {
      return NextResponse.json(
        { error: "You must be logged in to create a benchmark" },
        { status: 401 }
      );
    }

    const scenarioList = sanitizeScenarios(scenarios);

    const { data: benchmark, error } = await supabaseAdmin
      .from("benchmarks")
      .insert({
        title,
        description,
        platform: scenarioList.length > 0 ? "easyaim" : platform || "kovaiacks",
        difficulty: difficulty || "medium",
        user_id: accountId,
        scenario_count:
          scenarioList.length > 0 ? scenarioList.length : scenarioCount || 1,
      })
      .select()
      .single();

    if (error) throw error;

    if (scenarioList.length > 0) {
      const { error: scenariosError } = await supabaseAdmin
        .from("benchmark_scenarios")
        .insert(
          scenarioList.map((scenario, index) => ({
            benchmark_id: benchmark.id,
            easyaim_scenario_id: scenario.easyaimScenarioId,
            title: scenario.title,
            position: index,
            cutoffs: scenario.cutoffs,
          }))
        );

      if (scenariosError) throw scenariosError;

      // Existing linked players get one full re-scan so their PBs on the
      // scenarios just added show up right away.
      const { data: links } = await supabaseAdmin
        .from("easyaim_links")
        .select("account_id");

      const accountIds = (links || []).map(
        (row) => (row as { account_id: string }).account_id
      );

      if (accountIds.length > 0) {
        await supabaseAdmin
          .from("easyaim_links")
          .update({
            last_run_id: null,
            backfill_cursor: null,
            backfill_done: false,
          })
          .in("account_id", accountIds);
      }
    }

    return NextResponse.json({ benchmark }, { status: 201 });
  } catch (error) {
    console.error("CREATE BENCHMARK ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create benchmark" },
      { status: 500 }
    );
  }
}