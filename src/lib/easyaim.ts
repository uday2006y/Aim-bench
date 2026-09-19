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

  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`EasyAim API request failed (${response.status}): ${path}`);
  }

  return (await response.json()) as T;
}

export function getPlayer(playerId: number) {
  return easyaimGet<EasyAimPlayer>(`/api/v1/players/${playerId}`);
}

export function searchScenarios(query: string, limit = 20) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  return easyaimGet<{ data: EasyAimScenario[]; next: string | null }>(
    `/api/v1/scenarios?${params.toString()}`
  );
}

export function getRunPage(playerId: number, cursor?: string, limit = 25) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set("cursor", cursor);
  }

  return easyaimGet<{ data: EasyAimRun[]; next: string | null }>(
    `/api/v1/players/${playerId}/runs?${params.toString()}`
  );
}