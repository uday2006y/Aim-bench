import "server-only";

const API_URL = (
  process.env.EASYAIM_API_URL || "https://staging.easyaim.com"
).replace(/\/+$/, "");

const API_KEY = process.env.EASYAIM_API_KEY;

export interface EasyAimPlayer {
  id: number;
  name: string;
  username: string;
  avatarUrl: string;
  lastOnline: number;
}

export interface EasyAimRun {
  id: number;
  playedAt: number;
  scenarioId: number;
  score: number;
  accuracy: number;
  reaction: number;
  hits: number;
  misses: number;
  eliminations: number;
  best: boolean;
  hasReplay: boolean;
}

export interface EasyAimScenario {
  id: number;
  title: string;
  description: string;
  type: number;
  difficulty: number;
  plays: number;
  updatedAt: number;
  author?: {
    id: number;
    name: string;
    username: string;
  };
}

async function easyaimGet<T>(path: string): Promise<T> {
  if (!API_KEY) {
    throw new Error("EASYAIM_API_KEY is not set");
  }

  const url = `${API_URL}${path}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  const body = await response.text();

  if (!response.ok) {
    console.error("EASY AIM API ERROR:", {
      url,
      status: response.status,
      body,
    });

    throw new Error(
      `EasyAim API request failed (${response.status}): ${path}`
    );
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    console.error("EASY AIM INVALID JSON:", {
      url,
      status: response.status,
      body,
    });

    throw new Error("EasyAim API returned invalid JSON");
  }
}

export async function getPlayer(playerId: number | string) {
  try {
    return await easyaimGet<EasyAimPlayer>(`/api/v1/players/${playerId}`);
  } catch {
    return await easyaimGet<EasyAimPlayer>(`/api/v1/players/by-id/${playerId}`);
  }
}

export interface EasyAimDiscordIdentity {
  id: number;
  active: boolean;
}

/**
 * Looks up which EasyAim player(s) a Discord account is linked to.
 * Returns an empty array if the Discord account has no linked
 * EasyAim identities (not an error — just nothing to auto-link).
 */
export async function lookupPlayerByDiscordId(discordId: string) {
  try {
    const result = await easyaimGet
      EasyAimDiscordIdentity[] | { data: EasyAimDiscordIdentity[] }
    >(`/api/v1/lookup/discord/${discordId}`);

    return Array.isArray(result) ? result : result.data || [];
  } catch {
    return [];
  }
}

export function searchScenarios(query: string, limit = 20) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  return easyaimGet<{
    data: EasyAimScenario[];
    next: string | null;
  }>(`/api/v1/scenarios?${params.toString()}`);
}

export function getRunPage(
  playerId: number | string,
  cursor?: string,
  limit = 25
) {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return easyaimGet<{
    data: EasyAimRun[];
    next: string | null;
  }>(`/api/v1/players/${playerId}/runs?${params.toString()}`);
}