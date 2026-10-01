import { NextResponse } from "next/server";

/**
 * Best-effort throttle for the credential endpoints.
 *
 * There is no shared store here, so this is per serverless instance: it
 * stops a single script hammering one warm function, and it disappears on a
 * cold start. It is not a real defence against a distributed attempt, and it
 * should not be described as one. The durable fix is a shared counter
 * (Upstash, or a WAF rule in front of the app) — noted in the handoff rather
 * than half-built here, because a per-instance limiter that looks like
 * protection is worse than an honest gap.
 *
 * What this does buy for free: bcrypt at cost 12 is roughly a quarter of a
 * second of CPU per attempt, so an unthrottled endpoint is also a cheap way
 * to make the function time out.
 */

interface Attempt {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, Attempt>();

export interface ThrottleResult {
  limited: boolean;
  retryAfterSeconds: number;
}

/**
 * Best-effort client identity. Behind Vercel `x-forwarded-for` is set by the
 * edge and the first entry is the real client; the fallback is there so a
 * request without it is throttled under one shared key rather than not at all.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Records an attempt and reports whether this one is over the line. Call
 * before doing the expensive work, so a blocked request costs nothing.
 */
export function checkThrottle(key: string): ThrottleResult {
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > MAX_ATTEMPTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

/**
 * Called after a successful attempt so a legitimate user who fumbled their
 * password a few times is not left throttled.
 */
export function clearThrottle(key: string): void {
  attempts.delete(key);
}

/**
 * Keeps the map from growing without bound on a long-lived instance. Only
 * expired entries are dropped, so a live window is never shortened.
 */
export function sweepThrottle(now = Date.now()): void {
  for (const [key, value] of attempts) {
    if (value.resetAt <= now) attempts.delete(key);
  }
}

/** A 429 that tells the caller how long to wait, which is the useful part. */
export function tooManyAttempts(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too many attempts. Please wait a few minutes and try again.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}
