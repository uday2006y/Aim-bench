import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const benchmarkId = searchParams.get("benchmark_id");

    let query = supabaseAdmin
      .from("benchmark_scores")
      .select(
        `
        id,
        user_id,
        score,
        rank,
        rank_index,
        completed_at,
        benchmarks ( title, platform ),
        accounts (
          profiles ( display_name )
        )
        `,
        { count: "exact" }
      );

    if (benchmarkId) {
      query = query
        .eq("benchmark_id", benchmarkId)
        .order("rank_index", { ascending: false, nullsFirst: false })
        .order("score", { ascending: false });
    } else {
      query = query.order("score", { ascending: false });
    }

    const { data, error, count } = await query.limit(500);

    if (error) throw error;

    const bestPerUser = new Map<string, (typeof data)[number]>();

    for (const entry of data || []) {
      if (!bestPerUser.has(entry.user_id)) {
        bestPerUser.set(entry.user_id, entry);
      }
    }

    const leaderboard = Array.from(bestPerUser.values())
      .slice(0, 50)
      .map((entry) => ({
        id: entry.id,
        username:
          (
            entry.accounts as unknown as {
              profiles: { display_name: string } | null;
            } | null
          )?.profiles?.display_name || "Anonymous",

        score: entry.score,
        rank: entry.rank || "—",

        benchmark_title:
          (
            entry.benchmarks as unknown as {
              title: string;
            } | null
          )?.title || "Unknown Benchmark",

        platform:
          (
            entry.benchmarks as unknown as {
              platform: string;
            } | null
          )?.platform || "—",

        completed_at: entry.completed_at,
      }));

    return NextResponse.json({
      leaderboard,
      total: count,
    });
  } catch (error) {
    console.error("LEADERBOARD ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}