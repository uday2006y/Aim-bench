import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";

// Works out which rank a score lands in for a given benchmark, based
// on that benchmark's rank_thresholds (e.g. {"Bronze":0,"Silver":1000,...}).
// Returns the best rank the score clears plus its position in the
// ladder (rank_index, used to sort scenario-benchmark leaderboards).
function calculateRank(
  score: number,
  rankThresholds: Record<string, number> | null
): { rank: string | null; rankIndex: number | null } {
  if (!rankThresholds) return { rank: null, rankIndex: null };

  const sorted = Object.entries(rankThresholds).sort(
    (a, b) => a[1] - b[1]
  );

  let bestRank: string | null = null;
  let bestIndex: number | null = null;
  let bestThreshold = -Infinity;

  sorted.forEach(([rank, threshold], index) => {
    if (score >= threshold && threshold > bestThreshold) {
      bestRank = rank;
      bestIndex = index;
      bestThreshold = threshold;
    }
  });

  return { rank: bestRank, rankIndex: bestIndex };
}

export async function POST(request: Request) {
  try {
    const accountId = await getSessionAccountId();

    if (!accountId) {
      return NextResponse.json(
        { error: "You must be logged in to submit a score" },
        { status: 401 }
      );
    }

    const { benchmarkId, score } = await request.json();

    if (!benchmarkId || typeof score !== "number" || !Number.isFinite(score)) {
      return NextResponse.json(
        { error: "benchmarkId and a numeric score are required" },
        { status: 400 }
      );
    }

    if (score < 0) {
      return NextResponse.json(
        { error: "Score can't be negative" },
        { status: 400 }
      );
    }

    // Pull the benchmark so we can work out the rank for this score,
    // and so a bogus benchmarkId gives a clean 404 instead of a
    // foreign-key error further down.
    const { data: benchmark, error: benchmarkError } = await supabaseAdmin
      .from("benchmarks")
      .select("id, rank_thresholds")
      .eq("id", benchmarkId)
      .maybeSingle();

    if (benchmarkError) throw benchmarkError;

    if (!benchmark) {
      return NextResponse.json(
        { error: "Benchmark not found" },
        { status: 404 }
      );
    }

    const { rank, rankIndex } = calculateRank(score, benchmark.rank_thresholds);

    const { data: submittedScore, error } = await supabaseAdmin
      .from("benchmark_scores")
      .insert({
        benchmark_id: benchmarkId,
        user_id: accountId,
        score,
        rank,
        rank_index: rankIndex,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ score: submittedScore }, { status: 201 });
  } catch (error) {
    console.error("SUBMIT SCORE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to submit score" },
      { status: 500 }
    );
  }
}

// Returns the logged-in user's own score history, optionally filtered
// to one benchmark. Used by the benchmark detail page to show "your
// past attempts" without exposing everyone's raw submission history.
export async function GET(request: Request) {
  try {
    const accountId = await getSessionAccountId();

    if (!accountId) {
      return NextResponse.json(
        { error: "You must be logged in to view your scores" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const benchmarkId = searchParams.get("benchmark_id");

    let query = supabaseAdmin
      .from("benchmark_scores")
      .select("id, benchmark_id, score, rank, completed_at")
      .eq("user_id", accountId)
      .order("completed_at", { ascending: false });

    if (benchmarkId) {
      query = query.eq("benchmark_id", benchmarkId);
    }

    const { data, error } = await query.limit(50);

    if (error) throw error;

    return NextResponse.json({ scores: data || [] });
  } catch (error) {
    console.error("FETCH SCORES ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch scores" },
      { status: 500 }
    );
  }
}
