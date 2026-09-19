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

    const { title, description, difficulty, scenarios, platform } = body;

    // Verify ownership
    const { data: benchmark, error: fetchErr } = await supabaseAdmin
      .from("benchmarks")
      .select("user_id, scenario_count")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !benchmark) {
      return NextResponse.json({ error: "Benchmark not found" }, { status: 404 });
    }

    if ((benchmark as any).user_id !== accountId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Update benchmark
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("benchmarks")
      .update({
        title: title || (benchmark as any).title,
        description: description !== undefined ? description : (benchmark as any).description,
        difficulty: difficulty || (benchmark as any).difficulty,
        platform: platform || (benchmark as any).platform,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      console.error("UPDATE BENCHMARK ERROR:", updateErr);
      return NextResponse.json({ error: "Failed to update benchmark" }, { status: 500 });
    }

    // Handle scenarios update if provided
    if (scenarios !== undefined) {
      // Delete existing scenarios
      await supabaseAdmin.from("benchmark_scenarios").delete().eq("benchmark_id", id);

      if (Array.isArray(scenarios) && scenarios.length > 0) {
        const scenarioInserts = scenarios.map((s: any, index: number) => ({
          benchmark_id: id,
          easyaim_scenario_id: Number(s.id) || s.easyaim_scenario_id,
          title: s.title || `Scenario ${s.id || s.easyaim_scenario_id}`,
          position: index,
          cutoffs: s.cutoffs || {},
        }));
        await supabaseAdmin.from("benchmark_scenarios").insert(scenarioInserts);
      }
    }

    return NextResponse.json({ benchmark: updated }, { status: 200 });
  } catch (error) {
    console.error("UPDATE BENCHMARK ROUTE ERROR:", error);
    return NextResponse.json({ error: "Failed to update benchmark" }, { status: 500 });
  }
}
