import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { sanitizeScenarios, sanitizeCategoryDefs, syncSubCategoriesIntoDefs } from "@/lib/benchmarkScenarios";
import { resetLinkedAccountsBackfill } from "@/lib/resetBackfill";

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

    return NextResponse.json({ benchmarks });
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