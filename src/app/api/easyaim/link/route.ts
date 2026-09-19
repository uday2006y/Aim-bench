import { NextResponse } from "next/server";
import { getPlayer } from "@/lib/easyaim";
import { syncEasyAimAccount } from "@/lib/easyaimSync";
import { getSessionAccountId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseEasyAimPlayerId(input: string): number | null {
  const trimmed = input.trim();

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  try {
    const url = new URL(trimmed);

    if (!/(^|\.)easyaim\.com$/i.test(url.hostname)) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];

    return last && /^\d+$/.test(last) ? Number(last) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const accountId = await getSessionAccountId();

  if (!accountId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { data: link } = await supabaseAdmin
    .from("easyaim_links")
    .select(
      "easyaim_player_id, easyaim_username, display_name, avatar_url, last_synced_at, backfill_done"
    )
    .eq("account_id", accountId)
    .maybeSingle();

  return NextResponse.json({ link: link || null });
}

export async function POST(request: Request) {
  try {
    const accountId = await getSessionAccountId();

    if (!accountId) {
      return NextResponse.json(
        { error: "You must be logged in to link an EasyAim account" },
        { status: 401 }
      );
    }

    const { profile } = await request.json();

    if (typeof profile !== "string" || !profile.trim()) {
      return NextResponse.json(
        { error: "Paste your EasyAim profile link or player ID" },
        { status: 400 }
      );
    }

    const playerId = parseEasyAimPlayerId(profile);

    if (!playerId) {
      return NextResponse.json(
        {
          error:
            "That doesn't look like an EasyAim profile link or player ID. Example: https://easyaim.com/players/username/1234",
        },
        { status: 400 }
      );
    }

    let player;

    try {
      player = await getPlayer(playerId);
    } catch {
      return NextResponse.json(
        { error: "Could not find that EasyAim player" },
        { status: 404 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("easyaim_links")
      .select("easyaim_player_id")
      .eq("account_id", accountId)
      .maybeSingle();

    const isNewPlayer =
      (existing as { easyaim_player_id: number } | null)?.easyaim_player_id !==
      player.id;

    const { error } = await supabaseAdmin.from("easyaim_links").upsert(
      {
        account_id: accountId,
        easyaim_player_id: player.id,
        easyaim_username: player.username,
        display_name: player.name,
        avatar_url: player.avatarUrl,
        ...(isNewPlayer
          ? {
              last_run_id: null,
              backfill_cursor: null,
              backfill_done: false,
              last_synced_at: null,
            }
          : {}),
      },
      { onConflict: "account_id" }
    );

    if (error) throw error;

    let sync: Awaited<ReturnType<typeof syncEasyAimAccount>> | null = null;

    try {
      sync = await syncEasyAimAccount(accountId);
    } catch (syncError) {
      console.error("EASYAIM INITIAL SYNC ERROR:", syncError);
    }

    return NextResponse.json({
      success: true,
      link: {
        easyaim_player_id: player.id,
        easyaim_username: player.username,
        display_name: player.name,
        avatar_url: player.avatarUrl,
      },
      sync,
    });
  } catch (error) {
    console.error("EASYAIM LINK ERROR:", error);
    return NextResponse.json(
      { error: "Failed to link EasyAim account" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const accountId = await getSessionAccountId();

  if (!accountId) {
    return NextResponse.json(
      { error: "You must be logged in to unlink an EasyAim account" },
      { status: 401 }
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

  return NextResponse.json({ success: true });
}