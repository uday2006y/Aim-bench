import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Pin counts per benchmark, read from the benchmark_pin_totals view.
 *
 * Aggregating in SQL rather than fetching pin rows and counting in JS is
 * the point: the number of pins a page costs must not grow with the size
 * of the community. Pulling rows would make the benchmark list get slower
 * every time someone new starred anything.
 *
 * A benchmark nobody has starred is simply absent from the map, which is
 * what every caller wants — "0 stars" and "no row" mean the same thing.
 */
export async function loadPinCounts(
  benchmarkIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (benchmarkIds.length === 0) return counts;

  const { data, error } = await supabaseAdmin
    .from("benchmark_pin_totals")
    .select("benchmark_id, pin_count")
    .in("benchmark_id", benchmarkIds);

  if (error) {
    console.error("PINS: failed to load pin counts:", error);
    return counts;
  }

  for (const row of data || []) {
    const total = row as { benchmark_id: string; pin_count: number };
    counts.set(total.benchmark_id, total.pin_count);
  }

  return counts;
}

/** Which of these benchmarks the viewer has starred. Empty for anonymous. */
export async function loadViewerPins(
  accountId: string | null
): Promise<Set<string>> {
  const mine = new Set<string>();

  if (!accountId) return mine;

  const { data, error } = await supabaseAdmin
    .from("benchmark_pins")
    .select("benchmark_id")
    .eq("account_id", accountId);

  if (error) {
    console.error("PINS: failed to load viewer pins:", error);
    return mine;
  }

  for (const row of data || []) {
    mine.add((row as { benchmark_id: string }).benchmark_id);
  }

  return mine;
}

/** The benchmarks with the most stars, best first, capped at `limit`. */
export async function loadTopPinned(
  limit: number
): Promise<{ id: string; pin_count: number }[]> {
  const { data, error } = await supabaseAdmin
    .from("benchmark_pin_totals")
    .select("benchmark_id, pin_count")
    .order("pin_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("PINS: failed to load top pinned benchmarks:", error);
    return [];
  }

  return (data || []).map((row) => {
    const total = row as { benchmark_id: string; pin_count: number };
    return { id: total.benchmark_id, pin_count: total.pin_count };
  });
}
