import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { sanitizeScenarios, sanitizeCategoryDefs, syncSubCategoriesIntoDefs } from "@/lib/benchmarkScenarios";
import { resetLinkedAccountsBackfill } from "@/lib/resetBackfill";
import { recordAggregateFor } from "@/lib/easyaimSync";
import { loadTierCutoffs, loadTiers } from "@/lib/tiers";

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
    if ((benchmark as { user_id: string | null }).user_id !== accountId) {
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

    // A sub-category typed into the edit form that isn't in category_defs
    // yet gets folded in, so the detail table's rail can render it.
    const categoryDefs = category_defs
      ? (() => {
          const parsed = sanitizeCategoryDefs(category_defs);
          return parsed && scenarios
            ? syncSubCategoriesIntoDefs(parsed, scenarios)
            : parsed;
        })()
      : undefined;

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

      // Both sides are strings, because the ids are alphanumeric half the time
      // and Postgres stores them as text. Sorted lexicographically so the two
      // lists can be compared element by element — the question is only
      // "is the set the same", never "which is bigger".
      const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

      const previousIds = (existingRows || [])
        .map((row) => String((row as { easyaim_scenario_id: string }).easyaim_scenario_id))
        .sort(byId);

      const nextIds = scenarios.map((s) => s.easyaimScenarioId).sort(byId);
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

      // Editing cutoffs or the rank ladder changes what the author's rank
      // should be, with no PB change to trigger a sync. Recompute it now so
      // the benchmark they just saved shows the right rank.
      await recordAggregateFor(accountId, id);
    }

    return NextResponse.json({ benchmark: updated }, { status: 200 });
  } catch (err) {
    console.error("UPDATE BENCHMARK ERROR:", err);
    return NextResponse.json({ error: "Failed to update benchmark" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = await getSessionAccountId();

    // The benchmark id comes from the URL, so the scenarios are knowable
    // before the benchmark row arrives. Only the not-found branch needs the
    // benchmark first, and a 404 is cheap enough to gate on.
    const [benchmarkResult, scenarioResult, tiers] = await Promise.all([
      supabaseAdmin
        .from("benchmarks")
        .select("*")
        .eq("id", id)
        .maybeSingle(),

      supabaseAdmin
        .from("benchmark_scenarios")
        .select("id, easyaim_scenario_id, title, position, category, sub_category, cutoffs")
        .eq("benchmark_id", id)
        .order("position", { ascending: true }),

      // Keyed by benchmark id, so this does not have to wait for the benchmark
      // row. The edit page needs the whole ladder list to render its tabs.
      loadTiers(id),
    ]);

    const benchmark = benchmarkResult.data;
    const error = benchmarkResult.error;

    if (error) throw error;

    if (!benchmark) {
      return NextResponse.json(
        { error: "Benchmark not found" },
        { status: 404 }
      );
    }

    const scenarioRows = scenarioResult.data;
    const scenariosError = scenarioResult.error;

    if (scenariosError) throw scenariosError;

    const scenarios = (scenarioRows || []) as {
      id: string;
      easyaim_scenario_id: number;
      title: string;
      position: number;
      cutoffs: Record<string, number>;
    }[];

    // Attach the logged-in user's best known score (PB) for each scenario.
    // Keyed by account, so it does not need to wait for the scenarios.
    if (accountId) {
      const scenarioIds = new Set(
        (scenarios as { easyaim_scenario_id: number }[]).map(
          (s) => Number(s.easyaim_scenario_id)
        )
      );

      const { data: pbRows } = await supabaseAdmin
        .from("easyaim_pbs")
        .select("scenario_id, score")
        .eq("account_id", accountId);

      const pbMap = new Map<number, number>();
      for (const row of pbRows || []) {
        const pb = row as { scenario_id: number; score: number };
        if (scenarioIds.has(Number(pb.scenario_id))) {
          pbMap.set(Number(pb.scenario_id), pb.score);
        }
      }

      for (const scenario of scenarios as (typeof scenarios[number] & {
        best_score?: number;
      })[]) {
        scenario.best_score = pbMap.get(scenario.easyaim_scenario_id) ?? 0;
      }
    }

    // The tier the caller asked to edit, with its cutoffs. Absent when the
    // database has no tier tables, which the page reports rather than
    // rendering an empty ladder.
    const tierSlug = new URL(request.url).searchParams.get("tier");
    const tier = tiers.find((t) => t.slug === tierSlug) ?? tiers[0] ?? null;
    const tierCutoffs = tier ? await loadTierCutoffs(tier.id) : null;

    const scenariosWithTierCutoffs = tierCutoffs
      ? scenarios.map((scenario) => ({
          ...scenario,
          cutoffs: tierCutoffs.get(String(scenario.easyaim_scenario_id)) ?? {},
        }))
      : scenarios;

    return NextResponse.json({
      benchmark,
      // The edit page used to fetch this, then immediately fetch
      // /api/session to find out who it was — two round trips to learn
      // something this request already knows.
      //
      // A boolean rather than the account id: the client only ever needs
      // "is this mine?", and answering that does not mean handing the
      // caller a durable identifier it has no use for.
      loggedIn: Boolean(accountId),
      isOwner:
        Boolean(accountId) &&
        (benchmark as { user_id: string | null }).user_id === accountId,
      tiers,
      tierSlug: tier?.slug ?? null,
      scenarios: scenariosWithTierCutoffs,
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
    if ((benchmark as { user_id: string | null }).user_id !== accountId) {
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