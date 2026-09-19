"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface EasyAimLinkInfo {
  easyaim_player_id: number;
  easyaim_username: string;
  display_name: string | null;
  avatar_url: string | null;
  last_synced_at: string | null;
  backfill_done: boolean | null;
}

const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000;

export function EasyAimLinkCard({ link }: { link: EasyAimLinkInfo | null }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const syncingRef = useRef(false);

  const syncNow = useCallback(
    async (manual: boolean) => {
      if (syncingRef.current) return;

      syncingRef.current = true;

      if (manual) {
        setSyncing(true);
        setError("");
        setNotice("");
      }

      try {
        const response = await fetch("/api/easyaim/sync", { method: "POST" });
        const data = await response.json();

        if (!response.ok) {
          if (manual) setError(data.error || "Sync failed");
          return;
        }

        if (manual) {
          const newPbs = data.newPbs?.length ?? 0;
          const updated = data.benchmarksUpdated ?? 0;

          setNotice(
            newPbs > 0
              ? `Found ${newPbs} new PB${newPbs === 1 ? "" : "s"} — updated ${updated} benchmark${updated === 1 ? "" : "s"}`
              : `Checked ${data.scanned ?? 0} runs — no new PBs`
          );
        }

        if ((data.newPbs?.length ?? 0) > 0 || (data.benchmarksUpdated ?? 0) > 0) {
          router.refresh();
        }
      } catch {
        if (manual) setError("Could not reach the server");
      } finally {
        syncingRef.current = false;
        if (manual) setSyncing(false);
      }
    },
    [router]
  );

  const playerId = link?.easyaim_player_id ?? null;

  useEffect(() => {
    if (!playerId) return;

    const initial = setTimeout(() => syncNow(false), 1500);
    const interval = setInterval(() => syncNow(false), AUTO_SYNC_INTERVAL_MS);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [playerId, syncNow]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <h2 className="text-lg font-semibold mb-4">EasyAim account</h2>

      {link ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {link.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={link.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full bg-zinc-800"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm">
                  {(link.display_name || link.easyaim_username).slice(0, 2)}
                </div>
              )}

              <div>
                <p className="font-medium">
                  {link.display_name || link.easyaim_username}
                </p>
                <p className="text-xs text-zinc-500">
                  @{link.easyaim_username} · ID {link.easyaim_player_id}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => syncNow(true)}
              disabled={syncing}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync now"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-xs text-zinc-500">
            <span>
              Last synced:{" "}
              {link.last_synced_at
                ? new Date(link.last_synced_at).toLocaleString()
                : "Never"}
            </span>
            <span>
              History import:{" "}
              {link.backfill_done ? "complete" : "in progress"}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Your EasyAim account links automatically through Discord. If
          nothing shows here, make sure your EasyAim Account Center shows
          Discord as connected (Account Center → Connected With), then log
          out and back in.
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-lg border border-green-900/50 bg-green-950/30 px-4 py-3 text-sm text-green-400">
          {notice}
        </div>
      )}
    </div>
  );
}