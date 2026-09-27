import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";

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
