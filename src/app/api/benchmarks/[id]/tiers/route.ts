import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { MAX_TIERS, sanitizeLadder, sanitizeTiers } from "@/lib/benchmarkTiers";
import { sanitizeScenarios } from "@/lib/benchmarkScenarios";
import { recordAggregateFor } from "@/lib/easyaimSync";
import { loadTierScenarios, loadTiers, replaceTierScenarios } from "@/lib/tiers";

/**
 * A tier's scenarios, ladder and name.
 *
 * The create form sets how many tiers and what they are called; this is for
 * changing that mind, and for the per-tier scenario list and cutoffs. Six is
 * the ceiling because past six the header switcher stops being a menu you can
 * read at a glance.
 *
 * Ownership is checked on every verb. A tier row hangs off a benchmark, and a
 * benchmark without an owner check is a benchmark anyone can rewrite.
 */

interface Params {
  params: Promise<{ id: string }>;
}

async function requireOwner(id: string): Promise<
  { accountId: string } | { response: NextResponse }
> {
  const accountId = await getSessionAccountId();

  if (!accountId) {
    return { response: NextResponse.json({ error: "Not logged in" }, { status: 401 }) };
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
    return { response: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }

  return { accountId };
}

/** Resolves a tierId that actually belongs to this benchmark. */
async function requireTier(
  benchmarkId: string,
  tierId: string
): Promise<{ id: string } | { response: NextResponse }> {
  if (!tierId) {
    return {
      response: NextResponse.json({ error: "tierId is required" }, { status: 400 }),
    };
  }

  const { data: tier } = await supabaseAdmin
    .from("benchmark_tiers")
    .select("id, benchmark_id")
    .eq("id", tierId)
    .maybeSingle();

  // Checked against this benchmark, not merely "a tier with that id exists":
  // otherwise a valid tier id from someone else's benchmark would be enough.
  if (!tier || (tier as { benchmark_id: string }).benchmark_id !== benchmarkId) {
    return { response: NextResponse.json({ error: "Tier not found" }, { status: 404 }) };
  }

  return { id: tierId };
}

/** Add a tier. It starts with no scenarios, which the page says out loud. */
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
    const [draft] = sanitizeTiers([{ name: body?.name, isOfficial: body?.isOfficial }]);

    if (!draft) {
      return NextResponse.json({ error: "Give the tier a name." }, { status: 400 });
    }

    if (existing.some((tier) => tier.slug === draft.slug)) {
      return NextResponse.json(
        { error: `This benchmark already has a tier at /${draft.slug}.` },
        { status: 409 }
      );
    }

    // Seeded from the last tier's ladder rather than the default eight, so a
    // second Novice looks like the first one the author already arranged.
    const source = existing[existing.length - 1];

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
      .select("id, slug")
      .single();

    if (error) throw error;

    const tier = created as { id: string; slug: string };

    // Copy the source tier's scenarios so the new tier is a usable starting
    // point rather than an empty page. The author edits from there.
    if (source) {
      const sourceRows = await loadTierScenarios(source.id);

      if (sourceRows.length > 0) {
        const { error: copyError } = await supabaseAdmin
          .from("benchmark_scenarios")
          .insert(
            sourceRows.map((row, index) => ({
              tier_id: tier.id,
              easyaim_scenario_id: String(row.easyaim_scenario_id),
              title: row.title,
              position: index,
              category: row.category,
              sub_category: row.sub_category,
              cutoffs: row.cutoffs,
            }))
          );

        if (copyError) throw copyError;
      }
    }

    return NextResponse.json(tier, { status: 201 });
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
    const tier = await requireTier(id, typeof body?.tierId === "string" ? body.tierId : "");

    if ("response" in tier) return tier.response;

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
      .eq("id", tier.id);

    if (error) throw error;

    // A new ladder can make a rank reachable that was not before, so the
    // owner's standing on this benchmark is recomputed now rather than waiting
    // for a sync that may not come.
    await recordAggregateFor(guard.accountId, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("TIER UPDATE ERROR:", error);
    return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
  }
}

/**
 * Save one tier's scenario list — its scenarios, their categories, and their
 * cutoffs.
 *
 * Replaces the tier's whole list rather than merging, so a scenario removed
 * loses its row and a cleared input loses its cutoff. Partial writes are how a
 * stale requirement outlives the thing it referred to.
 */
export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requireOwner(id);

    if ("response" in guard) return guard.response;

    const body = await request.json();
    const tier = await requireTier(id, typeof body?.tierId === "string" ? body.tierId : "");

    if ("response" in tier) return tier.response;

    // The same validation the forms go through, so a hand-rolled request
    // cannot land a string in that jsonb and quietly break rank comparison
    // during the next sync.
    const cleaned = sanitizeScenarios(
      (Array.isArray(body?.scenarios) ? body.scenarios : []).map(
        (row: Record<string, unknown>) => ({ ...row, tierSlug: "" })
      )
    );

    await replaceTierScenarios(id, tier.id, cleaned);

    await recordAggregateFor(guard.accountId, id);

    return NextResponse.json({ ok: true, saved: cleaned.length });
  } catch (error) {
    console.error("TIER SCENARIOS ERROR:", error);
    return NextResponse.json({ error: "Failed to save tier scenarios" }, { status: 500 });
  }
}

/**
 * Remove a tier.
 *
 * Refuses to remove the last one: a benchmark with no tiers has no page to
 * render and no aggregate to compute, and the author almost certainly meant to
 * delete the wrong one. The tier's scenarios go with it by cascade.
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requireOwner(id);

    if ("response" in guard) return guard.response;

    const tierId = new URL(request.url).searchParams.get("tierId") ?? "";
    const tier = await requireTier(id, tierId);

    if ("response" in tier) return tier.response;

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

    const { error } = await supabaseAdmin
      .from("benchmark_tiers")
      .delete()
      .eq("id", tier.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("TIER DELETE ERROR:", error);
    return NextResponse.json({ error: "Failed to remove tier" }, { status: 500 });
  }
}
