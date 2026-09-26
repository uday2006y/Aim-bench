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

    // Attach the *session user's* latest score per benchmark so the list
    // cards can show a real rank. Scoped to the caller: the benchmarks
    // themselves stay public, but nobody else's scores are exposed here.
    const accountId = await getSessionAccountId();
    const myScores = await loadLatestScoresFor(accountId, (benchmarks || []).map((b) => (b as { id: string }).id));

    const enriched = (benchmarks || []).map((row) => {
      const benchmark = row as { id: string };
      const mine = myScores.get(benchmark.id);

      return {
        ...benchmark,
        my_score: mine?.score ?? null,
        my_rank: mine?.rank ?? null,
        my_rank_index: mine?.rankIndex ?? null,
        my_completed_at: mine?.completedAt ?? null,
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

interface LatestScore {
  score: number;
  rank: string | null;
  rankIndex: number | null;
  completedAt: string;
}

/**
 * Most recent benchmark_scores row per benchmark for one account.
 * benchmark_scores is append-only history, so "latest" is the current
 * standing. Returns an empty map for anonymous callers.
 */
async function loadLatestScoresFor(
  accountId: string | null,
  benchmarkIds: string[]
): Promise<Map<string, LatestScore>> {
  const latest = new Map<string, LatestScore>();

  if (!accountId || benchmarkIds.length === 0) return latest;

  const { data, error } = await supabaseAdmin
    .from("benchmark_scores")
    .select("benchmark_id, score, rank, rank_index, completed_at")
    .eq("user_id", accountId)
    .in("benchmark_id", benchmarkIds)
    .order("completed_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("BENCHMARKS LIST: failed to load caller scores:", error);
    return latest;
  }

  for (const row of data || []) {
    const score = row as {
      benchmark_id: string;
      score: number;
      rank: string | null;
      rank_index: number | null;
      completed_at: string;
    };

    if (latest.has(score.benchmark_id)) continue;

    latest.set(score.benchmark_id, {
      score: score.score,
      rank: score.rank,
      rankIndex: score.rank_index,
      completedAt: score.completed_at,
    });
  }

  return latest;
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