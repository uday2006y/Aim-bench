import { NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * This route used to also expose POST and GET for hand-linking an EasyAim
 * account by pasting a player id or profile URL, and both are gone.
 *
 * POST was the weakest thing in the app. It accepted any id a logged-in
 * person typed with no proof they owned it, and when the EasyAim lookup
 * failed it invented a player object from the text they had typed and
 * stored that instead — so the link could point at an account that does not
 * exist, or at somebody else's, and every score it produced would be
 * published under the linker's name. There is a verified path for exactly
 * this and it is already wired into login: EasyAim's
 * /api/v1/lookup/discord/{discordId}, which returns only the players a
 * Discord account actually owns. Discord login auto-links through that, so
 * the manual route had no job left.
 *
 * GET had no caller either: the profile page reads the link server-side.
 *
 * What remains is DELETE, which the profile card calls.
 */

/**
 * Unlinking stops tracking an EasyAim account. Everything derived from that
 * link goes with it.
 *
 * This used to delete only the easyaim_links row, which left the account's
 * easyaim_pbs behind — and those rows are keyed by account, not by player.
 * So relinking a different player merged two people's bests into one score,
 * on every card and every leaderboard row, with no way to tell afterwards
 * whose they were. It also left the benchmark_scores history claiming
 * completions the live path could no longer reproduce, which is precisely
 * the card-versus-history disagreement the app was rebuilt to eliminate.
 *
 * So: delete the link, the personal bests, and the history rows that were
 * computed from those bests. This is irreversible, and the confirm dialog in
 * the UI says so.
 */
export async function DELETE() {
  const accountId = await getSessionAccountId();

  if (!accountId) {
    return NextResponse.json(
      { error: "You must be logged in to unlink an EasyAim account" },
      { status: 401 }
    );
  }

  const { data: link } = await supabaseAdmin
    .from("easyaim_links")
    .select("easyaim_username")
    .eq("account_id", accountId)
    .maybeSingle();

  // Ordered so a failure part-way leaves the least behind: bests and history
  // first, then the link. Unlinking again after a partial failure is
  // harmless, because the second run finds no link and simply clears
  // whatever is still there.
  const { error: pbError } = await supabaseAdmin
    .from("easyaim_pbs")
    .delete()
    .eq("account_id", accountId);

  if (pbError) {
    console.error("EASYAIM UNLINK: failed to clear personal bests:", pbError);
    return NextResponse.json(
      { error: "Failed to unlink" },
      { status: 500 }
    );
  }

  const { error: scoreError } = await supabaseAdmin
    .from("benchmark_scores")
    .delete()
    .eq("user_id", accountId);

  if (scoreError) {
    console.error("EASYAIM UNLINK: failed to clear score history:", scoreError);
    return NextResponse.json(
      { error: "Failed to unlink" },
      { status: 500 }
    );
  }

  const { error } = await supabaseAdmin
    .from("easyaim_links")
    .delete()
    .eq("account_id", accountId);

  if (error) {
    console.error("EASYAIM UNLINK ERROR:", error);
    return NextResponse.json({ error: "Failed to unlink" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    unlinked: (link as { easyaim_username: string } | null)?.easyaim_username ?? null,
  });
}