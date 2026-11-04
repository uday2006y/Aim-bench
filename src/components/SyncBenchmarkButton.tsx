"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** How long the button rests after a sync, so it cannot be hammered. */
const COOLDOWN_MS = 8000;

interface SyncResponse {
  scanned?: number;
  saved?: number;
  failed?: number;
  newPbs?: { title: string; score: number }[];
  error?: string;
}

/**
 * "Sync now" for one benchmark.
 *
 * Same sync the profile page runs, narrowed to this benchmark's scenarios.
 * On success the page is refreshed so the table shows the new scores.
 */
export default function SyncBenchmarkButton({
  benchmarkId,
}: {
  benchmarkId: string;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [resting, setResting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [needsLink, setNeedsLink] = useState(false);
  const busy = useRef(false);

  async function sync() {
    if (busy.current) return;
    busy.current = true;

    setSyncing(true);
    setNotice("");
    setError("");
    setNeedsLink(false);

    try {
      const response = await fetch(
        `/api/easyaim/sync?benchmarkId=${encodeURIComponent(benchmarkId)}`,
        { method: "POST" }
      );
      const data = (await response.json()) as SyncResponse;

      if (!response.ok) {
        setError(data.error || "Sync failed");
        setNeedsLink(data.error === "No EasyAim account linked");
        return;
      }

      const fmt = (n: number) =>
        n.toLocaleString(undefined, { maximumFractionDigits: 3 });
      const scanned = data.scanned ?? 0;
      const failed = data.failed ?? 0;
      const pbs = data.newPbs ?? [];

      if (scanned === 0) {
        setNotice("This benchmark has no scenarios to sync.");
      } else if (pbs.length > 0) {
        const more = pbs.length > 1 ? ` (+${pbs.length - 1} more)` : "";
        setNotice(`New PB: ${pbs[0].title} ${fmt(pbs[0].score)}${more}`);
      } else if (failed > 0) {
        setNotice(
          `Checked ${scanned - failed} of ${scanned} scenarios; ${failed} could not be reached.`
        );
      } else {
        setNotice(
          `Up to date. Checked ${scanned} scenario${scanned === 1 ? "" : "s"}.`
        );
      }

      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setSyncing(false);
      busy.current = false;
      setResting(true);
      setTimeout(() => setResting(false), COOLDOWN_MS);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={sync}
        disabled={syncing || resting}
        className="btn btn-ghost px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={`mr-1.5 inline-block ${syncing ? "animate-spin" : ""}`}
        >
          ↻
        </span>
        {syncing ? "Syncing..." : "Sync now"}
      </button>

      {notice ? (
        <p role="status" className="max-w-[18rem] text-right text-[11px] text-zinc-400">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="max-w-[18rem] text-right text-[11px] text-red-400">
          {error}
          {needsLink ? (
            <>
              {" "}
              <Link href="/profile" className="underline">
                Open profile
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
