import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";

export interface BenchmarkOption {
  id: string;
  title: string;
}

/** Guard so a pathological dataset cannot pull an unbounded dropdown. */
const OPTION_LIMIT = 500;

/**
 * Just enough to fill a "filter by benchmark" dropdown.
 *
 * This exists because the leaderboard and rank history pages were calling
 * the full benchmark list endpoint to populate a <select> — dragging the
 * viewer's personal bests, their pins, every scenario's cutoffs and a
 * platform scan along with it, three extra queries and a second serverless
 * invocation, to read two columns.
 *
 * Two columns and one query. Everything the caller does not ask for is not
 * fetched, which is the cheapest optimisation there is.
 */
export async function loadBenchmarkOptions(): Promise<BenchmarkOption[]> {
  const { data, error } = await supabaseAdmin
    .from("benchmarks")
    .select("id, title")
    .order("title", { ascending: true })
    .limit(OPTION_LIMIT);

  if (error) {
    console.error("BENCHMARK OPTIONS: failed to load:", error);
    return [];
  }

  if ((data?.length ?? 0) >= OPTION_LIMIT) {
    console.error(
      `BENCHMARK OPTIONS: hit the ${OPTION_LIMIT}-row cap — the dropdown is incomplete.`
    );
  }

  return (data || []).map((row) => {
    const option = row as { id: string; title: string };
    return { id: option.id, title: option.title };
  });
}
