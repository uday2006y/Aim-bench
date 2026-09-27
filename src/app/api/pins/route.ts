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

    if (existingError) {
      console.error("PIN: could not read existing pin:", existingError);
      return NextResponse.json(
        {
          error: "Could not read your stars",
          detail: existingError.message,
          hint: pinSchemaHint(existingError.message),
        },
        { status: 500 }
      );
    }

    const alreadyPinned = Boolean(existing);

    if (pinned && !alreadyPinned) {
      const { error } = await supabaseAdmin
        .from("benchmark_pins")
        .insert({ benchmark_id: id, account_id: accountId });

      if (error) {
        // Two clicks racing each other is not a failure: the second insert
        // hits the primary key, and the star the user wanted is on screen.
        if (error.code === "23505") {
          return NextResponse.json({ pinned: true });
        }

        console.error("PIN: insert failed:", error);
        return NextResponse.json(
          {
            error: "Could not save your star",
            detail: error.message,
            hint: pinSchemaHint(error.message),
          },
          { status: 500 }
        );
      }
    } else if (!pinned && alreadyPinned) {
      const { error } = await supabaseAdmin
        .from("benchmark_pins")
        .delete()
        .eq("benchmark_id", id)
        .eq("account_id", accountId);

      if (error) {
        console.error("PIN: delete failed:", error);
        return NextResponse.json(
          {
            error: "Could not remove your star",
            detail: error.message,
            hint: pinSchemaHint(error.message),
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ pinned });
  } catch (error) {
    console.error("PIN TOGGLE ERROR:", error);
    return NextResponse.json({ error: "Failed to update pin" }, { status: 500 });
  }
}

/**
 * A missing benchmark_pins table is by far the most likely failure and it
 * otherwise surfaces as a generic 500, which tells nobody to go and run the
 * schema. Naming the fix in the response turns "the star does nothing" into
 * a one-line answer.
 */
function pinSchemaHint(message: string): string | null {
  if (/benchmark_pins/i.test(message)) {
    return "Run supabase-pins.sql against your database — the benchmark_pins table is missing.";
  }
  if (/violates foreign key constraint/i.test(message)) {
    return "Your account row is missing; try logging out and back in.";
  }
  return null;
}
