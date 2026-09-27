import { NextResponse } from "next/server";
import { beginDiscordAuth } from "@/lib/oauthState";

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Discord login is not configured" },
      { status: 500 }
    );
  }

  const redirectUri = new URL("/api/auth/discord/callback", request.url).toString();

  // Binds the callback to this browser. See lib/oauthState.ts for what this
  // is protecting against.
  const state = await beginDiscordAuth();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  });

  const response = NextResponse.redirect(
    `https://discord.com/api/oauth2/authorize?${params.toString()}`
  );

  return response;
}