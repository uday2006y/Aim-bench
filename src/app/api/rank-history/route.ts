import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { loadBenchmarkOptions } from "@/lib/benchmarkOptions";

/**
 * Score rows read to build the history. This is a scan, not a page: the
 * previous/current walk needs each pair's rows adjacent in time, so it cannot
 * be paginated without losing the chain. Bounded, and ordered newest-first
 * so the bound keeps the recent end.
 */
const SCAN_LIMIT = 500;

/** How many changes are actually sent to the browser. */
const RESULT_LIMIT = 100;

interface ScoreHistoryRow {
  id: string;
  user_id: string;
  benchmark_id: string;
  score: number;
  rank: string | null;
  completed_at: string;
  /**
   * PostgREST returns embedded resources as arrays even when the relationship
   * can only match one row, so these are normalised by first() below.
   */
  benchmarks: { title: string }[] | { title: string } | null;
  accounts:
    | { profiles: { display_name: string | null }[] | { display_name: string | null } | null }[]
    | { profiles: { display_name: string | null }[] | { display_name: string | null } | null }
    | null;
}

/** First element of an embedded resource, whatever shape PostgREST sent. */
function firstOf<T>(value: T[] | T | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RankHistoryEntry {
  id: string;
  username: string;
  benchmark_title: string;
  old_score: number;
  new_score: number;
  /** Null rather than an em-dash: a player genuinely dropping out of a rank is information. */
  old_rank: string | null;
  new_rank: string | null;
  date: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const benchmarkId = searchParams.get("benchmark_id");

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
        accounts (
          profiles ( display_name )
        )
      `)
      // Newest first, and capped — so the rows we keep are the most recent
      // activity rather than whatever sorts first by name.
      //
      // This used to order by user_id and then apply the cap, which kept the
      // 500 rows belonging to the alphabetically-first accounts and their
      // oldest history: the page trended towards the past and dropped
      // everything recent once the table grew. Sorting by time is also all
      // the walk below needs, because `lastSeen` is keyed per
      // (user, benchmark) pair — it does not matter that rows for different
      // pairs are interleaved.
      .order("completed_at", { ascending: false });

    if (benchmarkId) {
      query = query.eq("benchmark_id", benchmarkId);
    }

    const [rowsResult, options, accountId] = await Promise.all([
      query.limit(SCAN_LIMIT),
      loadBenchmarkOptions(),
      getSessionAccountId(),
    ]);

    if (rowsResult.error) throw rowsResult.error;

    // Back to oldest-first for the walk, so each pair's rows arrive in the
    // order they actually happened.
    const rows = [...(rowsResult.data ?? [])].reverse();

    const lastSeen = new Map<string, { score: number; rank: string | null }>();

    const rankHistory: RankHistoryEntry[] = [];

    for (const entry of rows as unknown as ScoreHistoryRow[]) {
      const key = `${entry.user_id}:${entry.benchmark_id}`;
      const previous = lastSeen.get(key);

      if (previous) {
        rankHistory.push({
          id: entry.id,
          username:
            firstOf(firstOf(entry.accounts)?.profiles ?? null)?.display_name ??
            "Anonymous",
          benchmark_title: firstOf(entry.benchmarks)?.title ?? "Unknown Benchmark",
          old_score: previous.score,
          new_score: entry.score,
          old_rank: previous.rank,
          new_rank: entry.rank,
          date: entry.completed_at,
        });
      }

      lastSeen.set(key, { score: entry.score, rank: entry.rank });
    }

    // Each pair is already oldest-first, so reversing the whole list leaves
    // every pair oldest-first too. No re-sort needed.
    rankHistory.reverse();

    return NextResponse.json({
      rank_history: rankHistory.slice(0, RESULT_LIMIT),
      benchmarks: options,
      loggedIn: Boolean(accountId),
    });
  } catch (error) {
    console.error("RANK HISTORY ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch rank history" },
      { status: 500 }
    );
  }
}