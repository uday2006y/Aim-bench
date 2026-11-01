import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Resolved lazily so `next build` does not need the secret, but the first real
 * request fails loudly instead of signing sessions with an empty or guessable key.
 */
function getSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(accountId: string) {
  return new SignJWT({ accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    if (typeof payload.accountId !== "string") {
      return null;
    }

    return {
      accountId: payload.accountId,
    };
  } catch {
    return null;
  }
}

/**
 * Reads the "session" cookie from the current request (App Router
 * route handlers) and returns the logged-in account's id, or null
 * if there's no valid session. Use this in any API route that needs
 * to know "who is making this request" instead of guessing.
 */
export async function getSessionAccountId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  const session = await verifySession(token);
  return session?.accountId ?? null;
}