"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BenchmarkDeleteButton({ benchmarkId }: { benchmarkId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (busy) return;

    const confirmed = window.confirm(
      "Delete this benchmark?\n\n" +
        "Its scenarios and everyone's score history for it go too. " +
        "This cannot be undone."
    );

    if (!confirmed) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/benchmarks/${benchmarkId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        // Inline rather than alert(): the button stays where it was, so the
        // message lands next to the thing that failed.
        setError(data.error || "Failed to delete benchmark");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="text-xs text-red-400 hover:text-red-300 underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Deleting..." : "Delete"}
      </button>
      {error ? (
        <span role="alert" className="text-[10px] text-red-400">
          {error}
        </span>
      ) : null}
    </span>
  );
}
