"use client";

import { useEffect } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

/**
 * Last line of defence for a server-component crash.
 *
 * Without this, a thrown error in any page renders Next's raw error screen:
 * a stack trace, a build ID, and nothing a player can do about it. During
 * alpha testing "it didn't work" arrives with no way to tell what the server
 * was doing at the time.
 *
 * So the visible half of the answer is on screen, and the useful half is
 * attached to it: the digest and the stack go to the console, which lands in
 * Vercel's logs next to the request that produced them. Anyone reporting the
 * problem can quote the reference below and the failure can be found.
 *
 * `reset` retries the render without a full page load, so a transient
 * database blip does not need a hard refresh.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The console is the only sink available without adding error-reporting
    // infrastructure. Vercel captures it against the request.
    console.error("Unhandled error while rendering:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-app text-white">
      <SiteHeader />

      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-zinc-500">
          Something went wrong
        </p>

        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          This page failed to load
        </h1>

        <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">
          The error has been logged. Trying again often works — this is usually
          a temporary problem reaching the database rather than anything wrong
          with your account.
        </p>

        {error.digest ? (
          <p className="mt-6 font-mono text-xs text-zinc-600">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Try again
          </button>

          <Link
            href="/"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
