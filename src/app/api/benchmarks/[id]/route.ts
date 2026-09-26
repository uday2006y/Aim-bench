import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { sanitizeScenarios, sanitizeCategoryDefs } from "@/lib/benchmarkScenarios";
import { resetLinkedAccountsBackfill } from "@/lib/resetBackfill";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await getSessionAccountId();
    if (!accountId) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();

    const {
      title,
      description,
      difficulty,
      platform,
      rank_names,
      rank_colors,
      rank_thresholds,
      category_defs,
    } = body;

    const { data: benchmark } = await supabaseAdmin
      .from("benchmarks")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();

    if (!benchmark) {
      return NextResponse.json({ error: "Benchmark not found" }, { status: 404 });
    }
    if ((benchmark as any).user_id !== accountId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Validate the scenario payload *before* touching anything. A bad id or
    // a duplicate used to fail an insert after the old rows were already
    // deleted, which silently wiped every scenario off the benchmark.
    const hasScenarioList = body.scenarios !== undefined;
    const scenarios = hasScenarioList ? sanitizeScenarios(body.scenarios) : null;

    if (hasScenarioList && scenarios!.length === 0) {
      return NextResponse.json(
        { error: "No valid scenarios in payload — nothing was changed." },
        { status: 400 }
      );
    }

    const categoryDefs = sanitizeCategoryDefs(category_defs);

    // Update the benchmark row first and verify it, so a rejected field
    // can't leave the scenario list half-rewritten.
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("benchmarks")
      .update({
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(difficulty !== undefined ? { difficulty } : {}),
        ...(platform !== undefined ? { platform } : {}),
        ...(rank_names !== undefined ? { rank_names } : {}),
        ...(rank_colors !== undefined ? { rank_colors } : {}),
        ...(rank_thresholds !== undefined ? { rank_thresholds } : {}),
        ...(categoryDefs !== undefined ? { category_defs: categoryDefs } : {}),
        ...(scenarios ? { scenario_count: scenarios.length } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    if (scenarios) {
      // Snapshot the current ids so we only trigger a re-scan when the
      // attached scenario set actually changed.
      const { data: existingRows } = await supabaseAdmin
        .from("benchmark_scenarios")
        .select("easyaim_scenario_id")
        .eq("benchmark_id", id);

      const previousIds = (existingRows || [])
        .map((row) => Number((row as { easyaim_scenario_id: number }).easyaim_scenario_id))
        .sort((a, b) => a - b);

      const nextIds = scenarios.map((s) => s.easyaimScenarioId).sort((a, b) => a - b);
      const scenarioSetChanged =
        previousIds.length !== nextIds.length ||
        previousIds.some((value, index) => value !== nextIds[index]);

      // Upsert before deleting. If the upsert fails the benchmark keeps its
      // existing scenarios instead of ending up empty.
      const { error: upsertErr } = await supabaseAdmin
        .from("benchmark_scenarios")
        .upsert(
          scenarios.map((scenario, index) => ({
            benchmark_id: id,
            easyaim_scenario_id: scenario.easyaimScenarioId,
            title: scenario.title,
            position: index,
            category: scenario.category,
            sub_category: scenario.subCategory || null,
            cutoffs: scenario.cutoffs,
          })),
          { onConflict: "benchmark_id,easyaim_scenario_id" }
        );

      if (upsertErr) throw upsertErr;

      // Then drop the scenarios that are no longer attached.
      const { error: deleteErr } = await supabaseAdmin
        .from("benchmark_scenarios")
        .delete()
        .eq("benchmark_id", id)
        .not(
          "easyaim_scenario_id",
          "in",
          `(${scenarios.map((s) => s.easyaimScenarioId).join(",")})`
        );

      if (deleteErr) throw deleteErr;

      if (scenarioSetChanged) {
        await resetLinkedAccountsBackfill();
      }
    }

    return NextResponse.json({ benchmark: updated }, { status: 200 });
  } catch (err) {
    console.error("UPDATE BENCHMARK ERROR:", err);
    return NextResponse.json({ error: "Failed to update benchmark" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: benchmark, error } = await supabaseAdmin
      .from("benchmarks")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!benchmark) {
      return NextResponse.json(
        { error: "Benchmark not found" },
        { status: 404 }
      );
    }

    const { data: scenarioRows, error: scenariosError } = await supabaseAdmin
      .from("benchmark_scenarios")
      .select("id, easyaim_scenario_id, title, position, category, sub_category, cutoffs")
      .eq("benchmark_id", id)
      .order("position", { ascending: true });

    if (scenariosError) throw scenariosError;

    const scenarios = (scenarioRows || []) as {
      id: string;
      easyaim_scenario_id: number;
      title: string;
      position: number;
      cutoffs: Record<string, number>;
    }[];

    // Attach the logged-in user's best known score (PB) for each
    // scenario, if they're logged in and have one.
    const accountId = await getSessionAccountId();

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

      for (const scenario of scenarios as (typeof scenarios[number] & {
        best_score?: number;
      })[]) {
        scenario.best_score = pbMap.get(scenario.easyaim_scenario_id) ?? 0;
      }
    }

    return NextResponse.json({
      benchmark,
      scenarios,
    });
  } catch (error) {
    console.error("BENCHMARK DETAIL ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch benchmark" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await getSessionAccountId();
    if (!accountId) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    const { id } = await params;

    const { data: benchmark } = await supabaseAdmin
      .from("benchmarks")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();

    if (!benchmark) {
      return NextResponse.json({ error: "Benchmark not found" }, { status: 404 });
    }
    if ((benchmark as any).user_id !== accountId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("benchmarks")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE BENCHMARK ERROR:", err);
    return NextResponse.json({ error: "Failed to delete benchmark" }, { status: 500 });
  }
}