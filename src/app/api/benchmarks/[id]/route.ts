import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";

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

    const { title, description, difficulty, platform } = body;

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

    const { data: updated, error } = await supabaseAdmin
      .from("benchmarks")
      .update({ title, description, difficulty, platform })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
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
      .select("id, easyaim_scenario_id, title, position, cutoffs")
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