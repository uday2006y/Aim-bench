"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface Benchmark {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  difficulty: string;
  rank_names: string[];
  rank_thresholds: Record<string, number>;
  scenario_count: number;
}

interface ScoreEntry {
  id: string;
  score: number;
  rank: string | null;
  completed_at: string;
}

export default function BenchmarkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [myScores, setMyScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreInput, setScoreInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadBenchmark();
    loadMyScores();
  }, [id]);

  async function loadBenchmark() {
    setLoading(true);
    try {
      // The benchmarks API filters by platform, not id, so we fetch
      // broadly and find our benchmark client-side. Fine for now
      // given the scale — worth a dedicated /api/benchmarks/[id]
      // route later.
      const res = await fetch(`/api/benchmarks?platform=all`);
      const data = await res.json();
      const found = (data.benchmarks || []).find((b: Benchmark) => b.id === id);
      setBenchmark(found || null);
    } catch (err) {
      console.error("Failed to load benchmark:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyScores() {
    try {
      const res = await fetch(`/api/scores?benchmark_id=${id}`);
      if (!res.ok) return; // not logged in — that's fine, just no history to show
      const data = await res.json();
      setMyScores(data.scores || []);
    } catch (err) {
      console.error("Failed to load scores:", err);
    }
  }

  async function handleSubmitScore() {
    setError("");
    setNotice("");

    const score = Number(scoreInput);

    if (!scoreInput || !Number.isFinite(score) || score < 0) {
      setError("Enter a valid score (0 or higher)");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benchmarkId: id, score }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit score");
        return;
      }

      setNotice(
        `Score submitted: ${data.score.score}${
          data.score.rank ? ` — ${data.score.rank}` : ""
        }`
      );
      setScoreInput("");
      loadMyScores();
    } catch {
      setError("Could not connect to the server");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090b] text-white flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </main>
    );
  }

  if (!benchmark) {
    return (
      <main className="min-h-screen bg-[#08090b] text-white flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-zinc-400">Benchmark not found.</p>
          <Link href="/benchmarks" className="mt-4 inline-block text-sm text-white hover:underline">
            ← Back to benchmarks
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090b] text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/benchmarks" className="text-sm text-zinc-500 hover:text-white transition">
          ← Back to benchmarks
        </Link>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
              {benchmark.platform}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
              {benchmark.difficulty}
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">{benchmark.title}</h1>
          <p className="mt-2 text-zinc-500">
            {benchmark.description || "No description"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {benchmark.scenario_count} scenario{benchmark.scenario_count === 1 ? "" : "s"}
          </p>

          {benchmark.rank_thresholds && (
            <div className="mt-6 flex flex-wrap gap-2">
              {Object.entries(benchmark.rank_thresholds)
                .sort(([, a], [, b]) => a - b)
                .map(([rankName, threshold]) => (
                  <span
                    key={rankName}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400"
                  >
                    {rankName}: {threshold}+
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* SUBMIT SCORE */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-semibold mb-4">Submit a score</h2>

          <div className="flex gap-2">
            <input
              type="number"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              placeholder="Your score"
              min="0"
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
            />
            <button
              onClick={handleSubmitScore}
              disabled={submitting}
              className="rounded-lg bg-white px-6 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              {error}{" "}
              {error.includes("logged in") && (
                <Link href="/login" className="underline">
                  Log in
                </Link>
              )}
            </div>
          )}

          {notice && (
            <div className="mt-4 rounded-lg border border-green-900/50 bg-green-950/30 px-4 py-3 text-sm text-green-400">
              {notice}
            </div>
          )}
        </div>

        {/* MY SCORE HISTORY */}
        {myScores.length > 0 && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-semibold mb-4">Your attempts</h2>
            <div className="space-y-2">
              {myScores.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between border-b border-white/10 py-2 last:border-0"
                >
                  <span className="font-medium">{s.score}</span>
                  <span className="text-sm text-zinc-400">{s.rank || "—"}</span>
                  <span className="text-sm text-zinc-600">
                    {new Date(s.completed_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
