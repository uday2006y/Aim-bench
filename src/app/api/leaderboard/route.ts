import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { loadBenchmarkOptions } from "@/lib/benchmarkOptions";

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

    // The dropdown and the session check ride along with the board. The
    // page used to ask for all three separately, so mounting it cost three
    // serverless invocations where one will do — and the benchmark list it
    // asked for was the full list, five queries deep, to read a title.
    const [boardResult, options, accountId] = await Promise.all([
      query.limit(500),
      loadBenchmarkOptions(),
      getSessionAccountId(),
    ]);

    const { data, error, count } = boardResult;

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
      benchmarks: options,
      loggedIn: Boolean(accountId),
    });
  } catch (error) {
    console.error("LEADERBOARD ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}