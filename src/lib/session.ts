import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

export async function createSession(accountId: string) {
  return new SignJWT({ accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);

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