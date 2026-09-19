import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const benchmarkId = searchParams.get("benchmark_id");

    // Pull ascending (oldest first) per user/benchmark so we can walk
    // through each player's submissions in order and diff consecutive
    // scores into "old -> new" entries.
    let query = supabaseAdmin
      .from("benchmark_scores")
      .select(`
        id,
        user_id,
        benchmark_id,
        score,
        rank,
        completed_at,
        benchmarks!inner (title, platform),
        profiles ( display_name )
      `)
      .order("user_id", { ascending: true })
      .order("completed_at", { ascending: true });

    if (benchmarkId) {
      query = query.eq("benchmark_id", benchmarkId);
    }

    const { data, error } = (await query.limit(500)) as {
      data: any[];
      error: any;
    };

    if (error) throw error;

    // Walk each user's submissions in chronological order, diffing
    // consecutive scores so each entry shows the improvement it
    // represents (skip a player's very first submission — there's no
    // "previous" score to compare it to).
    const lastSeen = new Map<string, { score: number; rank: string | null }>();
    const rankHistory: any[] = [];

    for (const entry of data || []) {
      const key = `${entry.user_id}:${entry.benchmark_id}`;
      const previous = lastSeen.get(key);

      if (previous) {
        rankHistory.push({
          id: entry.id,
          username: entry.profiles?.display_name || "Anonymous",
          benchmark_title: entry.benchmarks?.title || "Unknown Benchmark",
          old_score: previous.score,
          new_score: entry.score,
          old_rank: previous.rank || "—",
          new_rank: entry.rank || "—",
          date: entry.completed_at,
        });
      }

      lastSeen.set(key, { score: entry.score, rank: entry.rank });
    }

    // Most recent improvements first.
    rankHistory.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({ rank_history: rankHistory.slice(0, 100) });
  } catch (error) {
    console.error("RANK HISTORY ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch rank history" },
      { status: 500 }
    );
  }
}