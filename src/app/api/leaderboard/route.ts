import { NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/session";
import { loadBenchmarkOptions } from "@/lib/benchmarkOptions";
import { buildLeaderboard } from "@/lib/leaderboard";

/** Rows actually sent to the browser. `total` still reports everyone. */
const PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const benchmarkId = searchParams.get("benchmark_id");

    // The board, the dropdown and the session check all in one request.
    // The page used to ask for all three separately, so mounting it cost
    // three serverless invocations where one covers it.
    const [board, options, accountId] = await Promise.all([
      buildLeaderboard(benchmarkId),
      loadBenchmarkOptions(),
      getSessionAccountId(),
    ]);

    return NextResponse.json({
      leaderboard: board.entries.slice(0, PAGE_SIZE),
      total: board.total,
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
