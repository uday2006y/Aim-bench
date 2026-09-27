import "server-only";

import { cookies } from "next/headers";

/**
 * CSRF protection for the Discord OAuth leg.
 *
 * OAuth's `state` parameter exists to prove that the callback belongs to an
 * authorize request this browser actually started. Without it, an attacker
 * can complete their own Discord authorization, capture the callback URL,
 * and trick a victim into loading it — which signs the victim into the
 * attacker's account. That is "login CSRF": the victim ends up entering
 * data into a session the attacker controls, and the account they thought
 * was theirs belongs to someone else.
 *
 * The value is a random token written to an httpOnly cookie, which
 * JavaScript cannot read, then compared against what Discord echoes back.
 * A cross-origin attacker can make the victim's browser *send* the cookie
 * but cannot read it to learn the token, so they cannot forge a match.
 */

const COOKIE = "discord_oauth_state";

/** Long enough for a slow consent screen, short enough to not be reusable. */
const MAX_AGE_SECONDS = 600;

function randomToken(): string {
  // 32 bytes of entropy, base64url. `crypto` is a global in the Node and
  // edge runtimes Next.js route handlers execute in.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Buffer.from(bytes).toString("base64url");
}

/**
 * Record a fresh state token and return it for the authorize URL.
 *
 * `set` replaces any previous value rather than adding to it, so starting
 * login three times leaves one pending attempt, not three.
 */
export async function beginDiscordAuth(): Promise<string> {
  const token = randomToken();
  const store = await cookies();

  store.set(COOKIE, token, {
    httpOnly: true,
    // "lax" rather than "strict": the callback is a top-level navigation
    // from discord.com, and a strict cookie would not be sent with it,
    // which would break every login.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  return token;
}

/**
 * Check the state Discord echoed back, then clear the cookie.
 *
 * Always clears, pass or fail. Leaving a token behind after a failed check
 * would let the next attempt reuse it.
 */
export async function verifyDiscordState(
  returned: string | null
): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(COOKIE)?.value;

  store.delete(COOKIE);

  if (!expected || !returned) return false;

  // Constant-time compare. The strings are secrets, and an early return on
  // the first differing byte leaks how much of a guessed token was right.
  if (expected.length !== returned.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ returned.charCodeAt(i);
  }

  return mismatch === 0;
}
