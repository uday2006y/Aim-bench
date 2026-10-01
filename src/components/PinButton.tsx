"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PinButtonProps {
  benchmarkId: string;
  /** The viewer's own state, so the star is gold on first paint. */
  pinned: boolean;
  /** Anonymous visitors get a prompt instead of a toggle. */
  loggedIn: boolean;
  /** Optional size bump for the detail page header. */
  size?: "sm" | "md";
  /**
   * Extra classes for the button. Needed where the star is not in the normal
   * flow -- on a benchmark card the whole card is a link, so the star sits in
   * a sibling layer above it and has to be positioned rather than inlined.
   */
  className?: string;
}

/**
 * A star that turns gold once starred.
 *
 * No number next to it. The count was useful while the feature was new and
 * nobody had starred anything, so every card read "0". Once it is a
 * familiar gesture the total is noise on a card that is already dense, and
 * a number that changes under a click pulls attention away from the star
 * actually flipping. The community total still decides what the home page
 * features — it just is not printed on the star.
 *
 * The optimistic flip matters more here than usual: the PATCH is one round
 * trip to another continent and a star that lags a click reads as broken.
 * A failure rolls it back and says so, rather than leaving a gold star on
 * a benchmark that was never saved.
 */
export default function PinButton({
  benchmarkId,
  pinned: initialPinned,
  loggedIn,
  size = "sm",
  className = "",
}: PinButtonProps) {
  const [pinned, setPinned] = useState(initialPinned);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const router = useRouter();

  async function toggle() {
    if (busy) return;

    if (!loggedIn) {
      // No ?next= — the login flow does not carry a return path, and
      // sending one anyway would drop the visitor on the home page after
      // Discord auth with no idea what they were trying to do.
      router.push("/login");
      return;
    }

    const wanted = !pinned;

    setPinned(wanted);
    setBusy(true);
    setFailed(null);

    try {
      const response = await fetch("/api/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: benchmarkId, pinned: wanted }),
      });

      if (!response.ok) {
        // Surface the server's reason. A star that silently springs back
        // reads as a broken button; the actual cause is almost always the
        // schema not being applied, and the route says so.
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          detail?: string;
          hint?: string;
        } | null;

        throw new Error(
          body?.hint || body?.error || `Request failed (${response.status})`
        );
      }
    } catch (error) {
      setPinned(!wanted);
      setFailed(
        error instanceof Error ? error.message : "Could not save your star"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={pinned}
        aria-label={
          loggedIn
            ? pinned
              ? "Remove from your starred benchmarks"
              : "Star this benchmark"
            : "Log in to star a benchmark"
        }
        title={
          loggedIn
            ? pinned
              ? "Remove from your starred benchmarks"
              : "Star this benchmark"
            : "Log in to star a benchmark"
        }
        className={`group/pin shrink-0 rounded-lg p-1 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:opacity-60 ${className}`}
      >
        <span
          aria-hidden="true"
          className={`block leading-none transition-all duration-200 group-hover/pin:scale-110 ${
            size === "md" ? "text-4xl" : "text-3xl"
          } ${
            pinned
              ? "text-amber-300 [text-shadow:0_0_16px_rgba(252,211,77,0.75),0_0_4px_rgba(255,255,255,0.5)]"
              : "text-zinc-600 group-hover/pin:text-zinc-400"
          }`}
        >
          {pinned ? "★" : "☆"}
        </span>
      </button>

      {/* The reason a star sprang back, in the open. Silently reverting
          is what made this look like a button that only un-stars. */}
      {failed ? (
        <div
          role="alert"
          className="animate-card-in pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-500/30 bg-zinc-950 px-4 py-2.5 text-xs text-red-300 shadow-2xl"
        >
          {failed}
        </div>
      ) : null}
    </>
  );
}
