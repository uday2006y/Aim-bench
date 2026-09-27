import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { sanitizeScenarios, sanitizeCategoryDefs, syncSubCategoriesIntoDefs } from "@/lib/benchmarkScenarios";
import { resetLinkedAccountsBackfill } from "@/lib/resetBackfill";
import { recordAggregateFor } from "@/lib/easyaimSync";
import { computeAggregatesFor } from "@/lib/aggregates";
import { loadViewerPins } from "@/lib/pins";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || "easyaim";
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

    // Attach the *session user's* standing per benchmark so the list cards
    // can show a real rank. Derived from their stored PBs rather than from
    // benchmark_scores, so the card is correct the moment a PB exists and
    // does not depend on a sync having run. Scoped to the caller: the
    // benchmarks themselves stay public, nobody else's scores are exposed.
    const accountId = await getSessionAccountId();
    const aggregates = await computeAggregatesFor(
      accountId,
      (benchmarks || []).map((b) => (b as { id: string }).id)
    );

    const ids = (benchmarks || []).map((b) => (b as { id: string }).id);
    const myPins = await loadViewerPins(accountId);

    const enriched = (benchmarks || []).map((row) => {
      const benchmark = row as { id: string };
      const mine = aggregates.get(benchmark.id);

      return {
        ...benchmark,
        my_score: mine && mine.score > 0 ? mine.score : null,
        my_rank: mine?.rank ?? null,
        my_rank_index: mine?.rankIndex ?? null,
        my_maxed: mine?.maxed ?? false,
        my_pinned: myPins.has(benchmark.id),
      };
    });

    return NextResponse.json({ benchmarks: enriched });
  } catch (error) {
    console.error("BENCHMARKS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch benchmarks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
        const { title, description, platform, difficulty, scenarioCount, scenarios, rank_names, rank_colors, rank_thresholds, category_defs } =
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
    const categoryDefs =
      syncSubCategoriesIntoDefs(
        sanitizeCategoryDefs(category_defs) ?? [],
        scenarioList
      ) ?? [];

    const { data: benchmark, error } = await supabaseAdmin
      .from("benchmarks")
      .insert({
        title,
        description,
        platform: scenarioList.length > 0 ? "easyaim" : platform || "easyaim",
        difficulty: difficulty || "medium",
        rank_names: rank_names || '{"Bronze","Silver","Gold","Platinum","Diamond","Champion","Radiant","Immortal"}',
        rank_colors: rank_colors || '{"#b87333","#c0c0c0","#ffd700","#e5e4e2","#b9f2fe","#ffd700","#ff0000","#9f9f9f"}',
                rank_thresholds: rank_thresholds || '{"Bronze":0,"Silver":1000,"Gold":2500,"Platinum":5000,"Diamond":10000,"Champion":15000,"Radiant":20000,"Immortal":30000}',
        category_defs: categoryDefs,
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
            category: scenario.category,
            sub_category: scenario.subCategory || null,
            cutoffs: scenario.cutoffs,
          }))
        );

      if (scenariosError) throw scenariosError;

      // Existing linked players get one full re-scan so their PBs on the
      // scenarios just added show up right away.
      await resetLinkedAccountsBackfill();

      // The author's own standing is computable right now from PBs they
      // already have, so record it immediately rather than making them
      // wait for the next sync to see their rank on the new benchmark.
      await recordAggregateFor(accountId, benchmark.id);
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