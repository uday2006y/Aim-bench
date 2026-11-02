import "server-only";

const API_URL = (
  process.env.EASYAIM_API_URL || "https://easyaim.com"
).replace(/\/+$/, "");

const API_KEY = process.env.EASYAIM_API_KEY;

/**
 * Which EasyAim platform's runs to read ("mobile", "pc", ...). EasyAim keeps a
 * separate set of runs and records per platform and returns the default one
 * (PC) when none is asked for, so a mobile player must set this. Unset means
 * "do not filter", which keeps the old behaviour.
 */
const PLATFORM = (process.env.EASYAIM_PLATFORM || "").trim().toLowerCase();

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
  /** "pc", "mobile", ... EasyAim keeps a separate record per platform. */
  platform?: string;
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

/**
 * Fetches a page of a player's runs for the configured platform. Asks EasyAim
 * for that platform AND drops any run that is labelled with another one, so a
 * PC run can never be stored as a mobile score even if the API ignored the
 * parameter.
 */
async function getRuns(path: string) {
  const url = PLATFORM
    ? `${path}&platform=${encodeURIComponent(PLATFORM)}`
    : path;

  const page = await easyaimGet<{
    data: EasyAimRun[];
    next: string | null;
  }>(url);

  return {
    ...page,
    data: page.data.filter(
      (run) => !PLATFORM || !run.platform || run.platform.toLowerCase() === PLATFORM
    ),
  };
}

export async function getPlayer(playerId: number | string) {
  try {
    return await easyaimGet<EasyAimPlayer>(`/api/v1/players/${playerId}`);
  } catch {
    return await easyaimGet<EasyAimPlayer>(`/api/v1/players/by-id/${playerId}`);
  }
}

export interface EasyAimDiscordLookupResponse {
  players: EasyAimPlayer[];
  active: number;
}

/**
 * Looks up which EasyAim player(s) a Discord account is linked to.
 * Returns null if the Discord account has no linked EasyAim
 * identities (not an error — just nothing to auto-link).
 */
export async function lookupPlayerByDiscordId(
  discordId: string
): Promise<EasyAimPlayer | null> {
  try {
    const result = await easyaimGet<EasyAimDiscordLookupResponse>(
      `/api/v1/lookup/discord/${discordId}`
    );

    if (!result.players?.length) return null;

    return (
      result.players.find((player) => player.id === result.active) ||
      result.players[0]
    );
  } catch {
    return null;
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

  return getRuns(`/api/v1/players/${playerId}/runs?${params.toString()}`);
}

/**
 * A player's record progression for every scenario: only the runs that beat
 * their own record at the time.
 *
 * This is the only authoritative source of a personal best. Inferring one from
 * the ordinary runs feed cannot work, because that feed is newest-first and
 * paged: once a sync is caught up it reads only recent runs, so a best set
 * months ago may never appear in any page this process fetches. Taking the
 * maximum over whatever happened to be in range yields the best of the RECENT
 * runs, which for a player whose latest run was their worst is their last score.
 *
 * EasyAim documents that the FIRST entry in this list is the player's current
 * best. The list is newest-first, so the first entry seen for any scenario is
 * that scenario's personal best, and the rest are history.
 *
 * `limit` may go to 100; the default 25 would need four times the round trips
 * for the same data.
 */
export function getBestRunPage(
  playerId: number | string,
  cursor?: string,
  limit = 100
) {
  const params = new URLSearchParams({
    filter: "best",
    limit: String(limit),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return getRuns(`/api/v1/players/${playerId}/runs?${params.toString()}`);
}

/**
 * One scenario's personal best, straight from EasyAim.
 *
 * Same record feed as getBestRunPage, narrowed to a single scenario with
 * `scenario=`. EasyAim documents the FIRST entry of that feed as the player's
 * current best, so asking for one entry is enough. Used to fetch the real best
 * for a scenario that is missing from the bulk feed, for example one that was
 * just added to a benchmark.
 *
 * The caller must check the returned run's scenarioId: if the API ever ignored
 * the parameter it would return some other scenario's run.
 */
export function getScenarioBestRun(
  playerId: number | string,
  scenarioId: number | string
) {
  const params = new URLSearchParams({
    scenario: String(scenarioId),
    filter: "best",
    limit: "1",
  });

  return getRuns(`/api/v1/players/${playerId}/runs?${params.toString()}`);
}

/**
 * A page of one scenario's record entries, for the configured platform.
 * The caller takes the highest score, which is the existing personal best.
 */
export function getScenarioBestRuns(
  playerId: number | string,
  scenarioId: number | string,
  limit = 100
) {
  const params = new URLSearchParams({
    scenario: String(scenarioId),
    filter: "best",
    limit: String(limit),
  });

  return getRuns(`/api/v1/players/${playerId}/runs?${params.toString()}`);
}