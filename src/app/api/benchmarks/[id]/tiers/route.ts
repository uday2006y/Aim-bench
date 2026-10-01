import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { MAX_TIERS, sanitizeLadder, sanitizeTiers } from "@/lib/benchmarkTiers";
import { sanitizeScenarios } from "@/lib/benchmarkScenarios";
import { recordAggregateFor } from "@/lib/easyaimSync";
import { loadTierCutoffs, loadTiers, replaceTierCutoffs } from "@/lib/tiers";

/**
 * Adding, renaming and removing a benchmark's tiers after it exists.
 *
 * The create form sets the tier count and names; this is for changing that
 * mind. Six is the ceiling because past six the header switcher stops being a
 * menu you can read at a glance.
 *
 * Ownership is checked on every verb. The tier rows hang off a benchmark, and
 * a benchmark without the right owner check is a benchmark anyone can rewrite.
 */

interface Params {
  params: Promise<{ id: string }>;
}

async function requireOwner(id: string): Promise<
  { accountId: string } | { response: NextResponse }
> {
  const accountId = await getSessionAccountId();

  if (!accountId) {
    return {
      response: NextResponse.json({ error: "Not logged in" }, { status: 401 }),
    };
  }

  const { data: benchmark } = await supabaseAdmin
    .from("benchmarks")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!benchmark) {
    return {
      response: NextResponse.json({ error: "Benchmark not found" }, { status: 404 }),
    };
  }

  if ((benchmark as { user_id: string | null }).user_id !== accountId) {
    return {
      response: NextResponse.json({ error: "Not authorized" }, { status: 403 }),
    };
  }

  return { accountId };
}

/** Add one tier, copying an existing one's requirements as a starting point. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requireOwner(id);

    if ("response" in guard) return guard.response;

    const existing = await loadTiers(id);

    if (existing.length >= MAX_TIERS) {
      return NextResponse.json(
        { error: `A benchmark can have at most ${MAX_TIERS} tiers.` },
        { status: 400 }
      );
    }

    const body = await request.json();

    const [draft] = sanitizeTiers([
      { name: body?.name, isOfficial: body?.isOfficial },
    ]);

    if (!draft) {
      return NextResponse.json(
        { error: "Give the tier a name." },
        { status: 400 }
      );
    }

    if (existing.some((tier) => tier.slug === draft.slug)) {
      return NextResponse.json(
        { error: `This benchmark already has a tier at /${draft.slug}.` },
        { status: 409 }
      );
    }

    // Seed from the last tier so the new one starts as a copy of the most
    // recently arranged ladder rather than a blank page of em-dashes.
    const source = existing[existing.length - 1];
    const sourceCutoffs = source ? await loadTierCutoffs(source.id) : new Map();

    const { data: created, error } = await supabaseAdmin
      .from("benchmark_tiers")
      .insert({
        benchmark_id: id,
        slug: draft.slug,
        name: draft.name,
        position: existing.length,
        rank_names: source?.rank_names ?? [],
        rank_colors: source?.rank_colors ?? [],
        is_official: draft.isOfficial,
      })
      .select("id")
      .single();

    if (error) throw error;

    const tierId = (created as { id: string }).id;

    if (sourceCutoffs.size > 0) {
      const { error: cutoffError } = await supabaseAdmin
        .from("benchmark_tier_cutoffs")
        .insert(
          Array.from(sourceCutoffs.entries()).map(([scenarioId, cutoffs]) => ({
            tier_id: tierId,
            easyaim_scenario_id: scenarioId,
            cutoffs,
          }))
        );

      if (cutoffError) throw cutoffError;
    }

    return NextResponse.json({ id: tierId, slug: draft.slug }, { status: 201 });
  } catch (error) {
    console.error("TIER CREATE ERROR:", error);
    return NextResponse.json({ error: "Failed to add tier" }, { status: 500 });
  }
}

/** Rename a tier, mark it unofficial, or change its ladder. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requireOwner(id);

    if ("response" in guard) return guard.response;

    const body = await request.json();
    const tierId = typeof body?.tierId === "string" ? body.tierId : "";

    if (!tierId) {
      return NextResponse.json({ error: "tierId is required" }, { status: 400 });
    }

    const { data: tier } = await supabaseAdmin
      .from("benchmark_tiers")
      .select("id, benchmark_id, slug")
      .eq("id", tierId)
      .maybeSingle();

    // Checked against this benchmark, not just "a tier with that id exists":
    // otherwise a valid tier id from someone else's benchmark would be enough.
    if (!tier || (tier as { benchmark_id: string }).benchmark_id !== id) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};

    if (typeof body?.name === "string" && body.name.trim()) {
      patch.name = body.name.trim().slice(0, 40);
    }

    if (typeof body?.isOfficial === "boolean") {
      patch.is_official = body.isOfficial;
    }

    if (body?.rankNames !== undefined || body?.rankColors !== undefined) {
      const ladder = sanitizeLadder(body?.rankNames ?? [], body?.rankColors ?? []);
      patch.rank_names = ladder.rank_names;
      patch.rank_colors = ladder.rank_colors;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("benchmark_tiers")
      .update(patch)
      .eq("id", tierId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("TIER UPDATE ERROR:", error);
    return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
  }
}

/**
 * Save one tier's per-scenario cutoffs.
 *
 * Replaces the tier's whole set rather than merging, so a scenario removed
 * from the benchmark loses its row and a cleared input loses its cutoff —
 * partial writes are how a stale requirement outlives the thing it referred to.
 */
export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requireOwner(id);

    if ("response" in guard) return guard.response;

    const body = await request.json();
    const tierId = typeof body?.tierId === "string" ? body.tierId : "";

    if (!tierId) {
      return NextResponse.json({ error: "tierId is required" }, { status: 400 });
    }

    const { data: tier } = await supabaseAdmin
      .from("benchmark_tiers")
      .select("id, benchmark_id")
      .eq("id", tierId)
      .maybeSingle();

    if (!tier || (tier as { benchmark_id: string }).benchmark_id !== id) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    const rows = Array.isArray(body?.cutoffs) ? body.cutoffs : [];

    // Same validation the create and edit forms go through, so a hand-rolled
    // request cannot land a string in that jsonb and quietly break rank
    // comparison during the next sync.
    const cleaned = sanitizeScenarios(
      rows.map((row: { id?: unknown; cutoffs?: unknown }) => ({
        id: row?.id,
        cutoffs: row?.cutoffs,
      }))
    );

    await replaceTierCutoffs(
      tierId,
      cleaned.map((row) => ({
        easyaimScenarioId: row.easyaimScenarioId,
        cutoffs: row.cutoffs,
      }))
    );

    // Changing a tier's requirements changes what the owner's rank on it
    // should be, with no personal best to trigger a sync.
    await recordAggregateFor(guard.accountId, id);

    return NextResponse.json({ ok: true, saved: cleaned.length });
  } catch (error) {
    console.error("TIER CUTOFFS ERROR:", error);
    return NextResponse.json({ error: "Failed to save tier cutoffs" }, { status: 500 });
  }
}

/**
 * Remove a tier.
 *
 * Refuses to remove the last one: a benchmark with no tiers has no page to
 * render and no aggregate to compute, and the author almost certainly meant to
 * delete the wrong one.
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requireOwner(id);

    if ("response" in guard) return guard.response;

    const tierId = new URL(request.url).searchParams.get("tierId") ?? "";

    if (!tierId) {
      return NextResponse.json({ error: "tierId is required" }, { status: 400 });
    }

    const { data: tier } = await supabaseAdmin
      .from("benchmark_tiers")
      .select("id, benchmark_id")
      .eq("id", tierId)
      .maybeSingle();

    if (!tier || (tier as { benchmark_id: string }).benchmark_id !== id) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    const siblings = await loadTiers(id);

    if (siblings.length <= 1) {
      return NextResponse.json(
        {
          error:
            "A benchmark needs at least one tier. Rename this one instead of removing it.",
        },
        { status: 400 }
      );
    }

    // The tier's cutoff rows go with it: they hang off tier_id with a cascade,
    // but doing it explicitly means the delete does not silently depend on a
    // constraint someone might change later.
    const { error: cutoffError } = await supabaseAdmin
      .from("benchmark_tier_cutoffs")
      .delete()
      .eq("tier_id", tierId);

    if (cutoffError) throw cutoffError;

    const { error } = await supabaseAdmin
      .from("benchmark_tiers")
      .delete()
      .eq("id", tierId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("TIER DELETE ERROR:", error);
    return NextResponse.json({ error: "Failed to remove tier" }, { status: 500 });
  }
}
