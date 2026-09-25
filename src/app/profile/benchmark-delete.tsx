"use client";

export default function BenchmarkDeleteButton({ benchmarkId }: { benchmarkId: string }) {
  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this benchmark? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/benchmarks/${benchmarkId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete benchmark");
        return;
      }
      alert("Benchmark deleted.");
      window.location.reload();
    } catch {
      alert("Could not delete benchmark.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-xs text-red-400 hover:text-red-300 underline"
    >
      Delete
    </button>
  );
}
