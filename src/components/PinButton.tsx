"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PinButtonProps {
  benchmarkId: string;
  /** The viewer's own state, so the star is gold on first paint. */
  pinned: boolean;
  /** Community total, shown next to the star. */
  count: number;
  /** Anonymous visitors get a prompt instead of a toggle. */
  loggedIn: boolean;
  /** Optional size bump for the detail page header. */
  size?: "sm" | "md";
}

/**
 * A star that turns gold once starred.
 *
 * Placement: the card's top-right corner, beside the scenario count, and
 * mirrored in the benchmark header on the detail page. That corner is the
 * one spot on the card that carries no information, so the star costs no
 * reading space and is reachable by thumb on mobile without covering the
 * title or the link.
 *
 * The optimistic flip matters here more than usual — the PATCH is one
 * round trip to another continent and a star that lags a click reads as
 * broken. A failure rolls the star back and says so, so the count is
 * never left quietly wrong.
 */
export default function PinButton({
  benchmarkId,
  pinned: initialPinned,
  count: initialCount,
  loggedIn,
  size = "sm",
}: PinButtonProps) {
  const [pinned, setPinned] = useState(initialPinned);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
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
    setCount((n) => n + (wanted ? 1 : -1));
    setBusy(true);
    setFailed(false);

    try {
      const response = await fetch("/api/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: benchmarkId, pinned: wanted }),
      });

      if (!response.ok) throw new Error("pin failed");

      const data = (await response.json()) as { pin_count?: number };

      // Trust the server's total over the local arithmetic: it is the one
      // that counts the rest of the community too.
      if (typeof data.pin_count === "number") setCount(data.pin_count);
    } catch {
      setPinned(!wanted);
      setCount((n) => n + (wanted ? -1 : 1));
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const icon = size === "md" ? "text-2xl" : "text-lg";
  const countClass =
    size === "md"
      ? "text-sm"
      : count > 0
        ? "text-xs font-medium text-zinc-400"
        : "text-xs text-zinc-600";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={pinned}
      title={
        loggedIn
          ? pinned
            ? "Remove from your starred benchmarks"
            : "Star this benchmark"
          : "Log in to star a benchmark"
      }
      className="group/pin flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 -mr-1.5 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={`${icon} leading-none transition-transform duration-150 group-hover/pin:scale-110 ${
          pinned
            ? "text-amber-400 [text-shadow:0_0_10px_rgba(251,191,36,0.45)]"
            : "text-zinc-600 group-hover/pin:text-zinc-400"
        }`}
      >
        {pinned ? "★" : "☆"}
      </span>

      <span className={countClass}>{count}</span>

      <span className="sr-only" role="status">
        {failed ? "Could not save your star, try again" : ""}
      </span>
    </button>
  );
}
