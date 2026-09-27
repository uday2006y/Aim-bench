import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";

/** Guards the id before it reaches a uuid column, where a bad value is a
 *  500 from Postgres rather than a useful 400. */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Toggle a pin on or off.
 *
 * Pins are per-account, so two people starring the same benchmark both
 * count and neither can inflate the total. The route is idempotent: a pin
 * that already exists is removed, otherwise it is added, so a double click
 * cannot produce two of them — and the primary key on
 * (benchmark_id, account_id) would reject the duplicate anyway.
 *
 * The body says which state is wanted rather than naming an action, so a
 * client that retries or races itself converges on one pin rather than
 * flipping back and forth.
 */
export async function PATCH(request: Request) {
  try {
    const accountId = await getSessionAccountId();

    if (!accountId) {
      return NextResponse.json(
        { error: "You must be logged in to pin a benchmark" },
        { status: 401 }
      );
    }

    // The benchmark id rides in the body, not a path segment: this route
    // is /api/pins and handles every benchmark, so there is no [id] to
    // read it from.
    const { id, pinned: wantPinned } = (await request.json()) as {
      id?: unknown;
      pinned?: unknown;
    };

    if (typeof id !== "string" || !isUuid(id)) {
      return NextResponse.json(
        { error: "A valid benchmark id is required" },
        { status: 400 }
      );
    }

    // Anything other than an explicit false means "star it", so a client
    // that omits the field still gets the useful behaviour.
    const pinned = wantPinned !== false;

    // Only pin a benchmark that actually exists.
    const { data: benchmark, error: lookupError } = await supabaseAdmin
      .from("benchmarks")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!benchmark) {
      return NextResponse.json({ error: "Benchmark not found" }, { status: 404 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("benchmark_pins")
      .select("benchmark_id")
      .eq("benchmark_id", id)
      .eq("account_id", accountId)
      .maybeSingle();

    if (existingError) throw existingError;

    const alreadyPinned = Boolean(existing);

    if (pinned && !alreadyPinned) {
      const { error } = await supabaseAdmin
        .from("benchmark_pins")
        .insert({ benchmark_id: id, account_id: accountId });

      if (error) throw error;
    } else if (!pinned && alreadyPinned) {
      const { error } = await supabaseAdmin
        .from("benchmark_pins")
        .delete()
        .eq("benchmark_id", id)
        .eq("account_id", accountId);

      if (error) throw error;
    }

    const { count, error: countError } = await supabaseAdmin
      .from("benchmark_pins")
      .select("benchmark_id", { count: "exact", head: true })
      .eq("benchmark_id", id);

    if (countError) throw countError;

    return NextResponse.json({ pinned, pin_count: count ?? 0 });
  } catch (error) {
    console.error("PIN TOGGLE ERROR:", error);
    return NextResponse.json({ error: "Failed to update pin" }, { status: 500 });
  }
}
