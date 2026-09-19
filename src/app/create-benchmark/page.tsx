"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const RANK_NAMES = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Champion",
  "Radiant",
  "Immortal",
];

interface ScenarioResult {
  id: number;
  title: string;
  difficulty: number;
  plays: number;
  author: string | null;
}

interface AddedScenario {
  id: number;
  title: string;
  cutoffs: Record<string, string>;
}

export default function CreateBenchmarkPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("EasyAim");
  const [difficulty, setDifficulty] = useState("medium");
  const [scenarioCount, setScenarioCount] = useState<number>(1);
  const [scenarios, setScenarios] = useState<AddedScenario[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);

      try {
        const response = await fetch(
          `/api/easyaim/scenarios?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        setResults(response.ok ? data.scenarios || [] : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  function addScenario(scenario: ScenarioResult) {
    setScenarios((current) => {
      if (current.some((s) => s.id === scenario.id)) return current;
      return [
        ...current,
        { id: scenario.id, title: scenario.title, cutoffs: {} },
      ];
    });
    setSearchQuery("");
    setResults([]);
  }

  function removeScenario(id: number) {
    setScenarios((current) => current.filter((s) => s.id !== id));
  }

  function updateCutoff(id: number, rank: string, value: string) {
    setScenarios((current) =>
      current.map((scenario) =>
        scenario.id === id
          ? { ...scenario, cutoffs: { ...scenario.cutoffs, [rank]: value } }
          : scenario
      )
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payloadScenarios = scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        cutoffs: Object.fromEntries(
          Object.entries(scenario.cutoffs)
            .filter(([, value]) => value.trim() !== "")
            .map(([rank, value]) => [rank, Number(value)])
        ),
      }));

      const response = await fetch("/api/benchmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          platform: scenarios.length > 0 ? "easyaim" : platform,
          difficulty,
          scenarioCount:
            scenarios.length > 0 ? scenarios.length : scenarioCount,
          scenarios: payloadScenarios,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create benchmark");
        return;
      }

      router.push(`/benchmarks/${data.benchmark.id}`);
    } catch {
      setError("Could not connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-white transition"
          >
            ← Back to AIMBENCH
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold tracking-tight">
            Create Benchmark
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Share your aim trainer benchmark with the community.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Benchmark Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter benchmark title"
                required
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the benchmark..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500 resize-none"
                rows={3}
              />
            </div>

            {/* EASYAIM SCENARIOS */}
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                EasyAim Scenarios (optional)
              </label>
              <p className="mb-3 text-xs text-zinc-600">
                Add scenarios to score this benchmark automatically from
                linked EasyAim accounts. Set the score required for each rank
                per scenario. When scenarios are added, the platform becomes
                EasyAim.
              </p>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search EasyAim scenarios..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />

              {searching && (
                <p className="mt-2 text-xs text-zinc-500">Searching...</p>
              )}

              {results.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => addScenario(result)}
                      className="flex w-full items-center justify-between gap-4 border-b border-white/5 px-4 py-3 text-left text-sm last:border-0 hover:bg-white/5"
                    >
                      <span className="truncate">{result.title}</span>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {result.author ? `by ${result.author}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm font-medium">
                      {scenario.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeScenario(scenario.id)}
                      className="shrink-0 text-xs text-zinc-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {RANK_NAMES.map((rank) => (
                      <label key={rank} className="block">
                        <span className="mb-1 block text-xs text-zinc-500">
                          {rank} score
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={scenario.cutoffs[rank] ?? ""}
                          onChange={(e) =>
                            updateCutoff(scenario.id, rank, e.target.value)
                          }
                          placeholder="—"
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Platform
              </label>
              <select
                value={scenarios.length > 0 ? "easyaim" : platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={scenarios.length > 0}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500 disabled:opacity-60"
              >
                <option value="easyaim">EasyAim</option>
              </select>
              {scenarios.length > 0 && (
                <p className="mt-2 text-xs text-zinc-600">
                  Platform is set to EasyAim because this benchmark uses
                  EasyAim scenarios.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {scenarios.length === 0 && (
              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Scenario Count
                </label>
                <input
                  type="number"
                  value={scenarioCount}
                  onChange={(e) => setScenarioCount(Number(e.target.value))}
                  min="1"
                  placeholder="1"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Benchmark"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            View all benchmarks{" "}
            <Link href="/benchmarks" className="text-white hover:underline">
              here
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}