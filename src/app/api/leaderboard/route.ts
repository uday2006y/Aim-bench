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
      profiles ( display_name )
    `,
        { count: "exact" }
      );

    if (benchmarkId) {
      // Scenario benchmarks rank by achieved rank first, total score second.
      query = query
        .eq("benchmark_id", benchmarkId)
        .order("rank_index", { ascending: false, nullsFirst: false })
        .order("score", { ascending: false });
    } else {
      query = query.order("score", { ascending: false });
    }

    // Pull more than 50 rows before deduping, since one player can
    // have many submissions and we only want their best one to count
    // toward the top 50 spots.
    const { data, error, count } = await query.limit(500);

    if (error) throw error;

    // Each player can have many score rows (score history); a
    // leaderboard should only show each player's best. Since rows are
    // already sorted by score descending, the first time we see a
    // user_id is their best score.
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
          (entry.profiles as unknown as { display_name: string } | null)
            ?.display_name || "Anonymous",
        score: entry.score,
        rank: entry.rank || "—",
        benchmark_title:
          (entry.benchmarks as unknown as { title: string } | null)?.title ||
          "Unknown Benchmark",
        platform:
          (entry.benchmarks as unknown as { platform: string } | null)
            ?.platform || "—",
        completed_at: entry.completed_at,
      }));

    return NextResponse.json({ leaderboard, total: count });
  } catch (error) {
    console.error("LEADERBOARD ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}