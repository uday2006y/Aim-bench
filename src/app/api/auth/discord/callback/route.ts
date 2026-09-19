import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSession } from "@/lib/session";
import { getPlayer, lookupPlayerByDiscordId } from "@/lib/easyaim";
import { syncEasyAimAccount } from "@/lib/easyaimSync";

interface DiscordTokenResponse {
  access_token: string;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
}

async function autoLinkEasyAim(accountId: string, discordId: string) {
  try {
    // Don't overwrite an existing manual link.
    const { data: existingLink } = await supabaseAdmin
      .from("easyaim_links")
      .select("account_id")
      .eq("account_id", accountId)
      .maybeSingle();

    if (existingLink) return;

    const identities = await lookupPlayerByDiscordId(discordId);
    if (identities.length === 0) return;

    // Prefer the identity EasyAim marks as "active"; fall back to the first.
    const chosen = identities.find((identity) => identity.active) || identities[0];

    const player = await getPlayer(chosen.id);

    const { error } = await supabaseAdmin.from("easyaim_links").upsert(
      {
        account_id: accountId,
        easyaim_player_id: player.id,
        easyaim_username: player.username,
        display_name: player.name,
        avatar_url: player.avatarUrl,
        last_run_id: null,
        backfill_cursor: null,
        backfill_done: false,
        last_synced_at: null,
      },
      { onConflict: "account_id" }
    );

    if (error) {
      console.error("EASYAIM AUTO-LINK UPSERT ERROR:", error);
      return;
    }

    // Kick off an initial sync so their PBs populate right away.
    try {
      await syncEasyAimAccount(accountId);
    } catch (syncError) {
      console.error("EASYAIM AUTO-LINK INITIAL SYNC ERROR:", syncError);
    }
  } catch (error) {
    // Auto-link is a bonus, not a requirement — never let it break login.
    console.error("EASYAIM AUTO-LINK ERROR:", error);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=discord_denied", request.url));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=discord_not_configured", request.url));
  }

  const redirectUri = new URL("/api/auth/discord/callback", request.url).toString();

  try {
    // Exchange the code for an access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange Discord code");
    }

    const tokenData = (await tokenResponse.json()) as DiscordTokenResponse;

    // Fetch the user's Discord identity
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to fetch Discord user");
    }

    const discordUser = (await userResponse.json()) as DiscordUser;
    const displayName = discordUser.global_name || discordUser.username;

    // Find an existing account linked to this Discord ID
    const { data: existing } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("discord_id", discordUser.id)
      .maybeSingle();

    let accountId: string;

    if (existing) {
      accountId = (existing as { id: string }).id;
    } else {
      // New account — username defaults to their Discord username,
      // with a random suffix if that username is already taken.
      let username = discordUser.username;

      const { data: taken } = await supabaseAdmin
        .from("accounts")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (taken) {
        username = `${username}_${discordUser.id.slice(-4)}`;
      }

      const { data: created, error: createError } = await supabaseAdmin
        .from("accounts")
        .insert({
          username,
          discord_id: discordUser.id,
          password_hash: null,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      accountId = (created as { id: string }).id;

      await supabaseAdmin.from("profiles").insert({
        id: accountId,
        display_name: displayName,
      });
    }

    // Best-effort: link an EasyAim identity automatically if this
    // Discord account has one, so the user never has to paste an ID.
    await autoLinkEasyAim(accountId, discordUser.id);

    const token = await createSession(accountId);

    const response = NextResponse.redirect(new URL("/profile", request.url));

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("DISCORD LOGIN ERROR:", error);
    return NextResponse.redirect(new URL("/login?error=discord_failed", request.url));
  }
}