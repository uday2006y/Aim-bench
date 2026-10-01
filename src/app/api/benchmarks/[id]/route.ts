import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { sanitizeCategoryDefs } from "@/lib/benchmarkScenarios";
import { resetLinkedAccountsBackfill } from "@/lib/resetBackfill";
import { loadTierScenarios, loadTiers } from "@/lib/tiers";

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

    // The rank ladder is not handled here either — it belongs to a tier, and
    // this route does not know which tier is meant. The tier endpoint owns it.
    const {
      title,
      description,
      difficulty,
      platform,
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

    // Scenarios are NOT handled here. They belong to a tier, so this route has
    // no idea which tier the caller means and must not guess — a benchmark-wide
    // rewrite would delete every tier's scenarios. The tier endpoint owns them
    // and takes a tierId.
    //
    // A sub-category typed into the edit form that isn't in category_defs yet
    // gets folded in, so the detail table's rail can render it.
    const categoryDefs = category_defs
      ? sanitizeCategoryDefs(category_defs) ?? undefined
      : undefined;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("benchmarks")
      .update({
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(difficulty !== undefined ? { difficulty } : {}),
        ...(platform !== undefined ? { platform } : {}),
        ...(rank_thresholds !== undefined ? { rank_thresholds } : {}),
        ...(categoryDefs !== undefined ? { category_defs: categoryDefs } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // The card's scenario count spans every tier, so it is recomputed rather
    // than taken from one tier's list.
    const { count } = await supabaseAdmin
      .from("benchmark_scenarios")
      .select("id", { count: "exact", head: true })
      .eq("benchmark_id", id);

    if (typeof count === "number" && count !== updated.scenario_count) {
      await supabaseAdmin
        .from("benchmarks")
        .update({ scenario_count: count })
        .eq("id", id);
    }

    // A scenario appearing or disappearing changes which personal bests count,
    // so linked players get one re-scan. Only when the total actually moved.
    const changed = typeof count === "number" && count !== updated.scenario_count;

    if (changed) {
      await resetLinkedAccountsBackfill();
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

    // Keyed by benchmark id, so neither the benchmark row nor the scenarios
    // have to be waited on. A 404 is cheap enough to gate on afterwards.
    const [benchmarkResult, tiers] = await Promise.all([
      supabaseAdmin.from("benchmarks").select("*").eq("id", id).maybeSingle(),

      // The edit page needs the whole ladder list to render its tier tabs.
      loadTiers(id),
    ]);

    const benchmark = benchmarkResult.data;

    if (benchmarkResult.error) throw benchmarkResult.error;

    if (!benchmark) {
      return NextResponse.json({ error: "Benchmark not found" }, { status: 404 });
    }

    // Which tier the caller is editing. Defaults to the first, so the edit page
    // opens on something rather than on an empty form.
    const wanted = new URL(request.url).searchParams.get("tier");
    const tier = tiers.find((t) => t.slug === wanted) ?? tiers[0] ?? null;

    // Scenarios belong to a tier, so this is the tier's own list. Empty when
    // the database has no tier tables, which the page reports rather than
    // rendering an empty ladder.
    const scenarioRows = tier ? await loadTierScenarios(tier.id) : [];

    // Keyed by account, so it does not need to wait for the scenarios.
    const pbMap = new Map<string, number>();

    if (accountId) {
      const scenarioIds = new Set(
        scenarioRows.map((s) => String(s.easyaim_scenario_id))
      );

      const { data: pbRows } = await supabaseAdmin
        .from("easyaim_pbs")
        .select("scenario_id, score")
        .eq("account_id", accountId);

      for (const row of (pbRows ?? []) as { scenario_id: string; score: number }[]) {
        if (scenarioIds.has(String(row.scenario_id))) {
          pbMap.set(String(row.scenario_id), row.score);
        }
      }
    }

    const scenarios = scenarioRows.map((row) => ({
      id: row.id,
      easyaim_scenario_id: String(row.easyaim_scenario_id),
      title: row.title,
      position: row.position,
      category: row.category || "Other",
      sub_category: row.sub_category || "",
      cutoffs: row.cutoffs ?? {},
      best_score: pbMap.get(String(row.easyaim_scenario_id)) ?? 0,
    }));

    return NextResponse.json({
      benchmark,
      // The edit page used to fetch this, then immediately fetch /api/session to
      // find out who it was — two round trips to learn something this request
      // already knows.
      //
      // A boolean rather than the account id: the client only ever needs "is
      // this mine?", and answering that does not mean handing the caller a
      // durable identifier it has no use for.
      loggedIn: Boolean(accountId),
      isOwner:
        Boolean(accountId) &&
        (benchmark as { user_id: string | null }).user_id === accountId,
      tiers,
      tierSlug: tier?.slug ?? null,
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