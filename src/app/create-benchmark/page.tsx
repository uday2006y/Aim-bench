"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const DEFAULT_RANKS = [
  { name: "Bronze", color: "#b87333" },
  { name: "Silver", color: "#c0c0c0" },
  { name: "Gold", color: "#ffd700" },
  { name: "Platinum", color: "#e5e4e2" },
  { name: "Diamond", color: "#b9f2fe" },
  { name: "Champion", color: "#ffd700" },
  { name: "Radiant", color: "#ff0000" },
  { name: "Immortal", color: "#9f9f9f" },
];

interface RankDef {
  name: string;
  color: string;
}

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
  const [ranks, setRanks] = useState<RankDef[]>(DEFAULT_RANKS);
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

  function addRank() {
    setRanks((prev) => [...prev, { name: `Rank ${prev.length + 1}`, color: "#ffffff" }]);
  }

  function removeRank(index: number) {
    const rankName = ranks[index].name;
    setRanks((prev) => prev.filter((_, i) => i !== index));
    // Remove this rank from all scenario cutoffs
    setScenarios((prev) => prev.map((s) => {
      const newCutoffs = { ...s.cutoffs };
      delete newCutoffs[rankName];
      return { ...s, cutoffs: newCutoffs };
    }));
  }

  function updateRankName(index: number, value: string) {
    const oldName = ranks[index].name;
    const newName = value.trim() || `Rank ${index + 1}`;
    setRanks((prev) => prev.map((r, i) => i === index ? { ...r, name: newName } : r));
    // Update cutoffs key from old name to new name
    setScenarios((prev) => prev.map((s) => {
      const newCutoffs: Record<string, string> = {};
      for (const [k, v] of Object.entries(s.cutoffs)) {
        newCutoffs[k === oldName ? newName : k] = v;
      }
      return { ...s, cutoffs: newCutoffs };
    }));
  }

  function updateRankColor(index: number, color: string) {
    setRanks((prev) => prev.map((r, i) => i === index ? { ...r, color } : r));
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
          rank_names: ranks.map((r) => r.name),
          rank_colors: ranks.map((r) => r.color),
          rank_thresholds: {},
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
                    {ranks.map((rank, idx) => (
                      <div key={`${rank.name}-${idx}`} className="block">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={rank.name}
                            onChange={(e) => updateRankName(idx, e.target.value)}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-white outline-none focus:border-zinc-500"
                          />
                          <input
                            type="color"
                            value={rank.color}
                            onChange={(e) => updateRankColor(idx, e.target.value)}
                            className="w-6 h-6 rounded border border-white/10 shrink-0 cursor-pointer p-0.5"
                            title={`${rank.name} color`}
                          />
                        </div>
                        <label className="block text-xs text-zinc-500 mb-0.5">Score</label>
                        <input
                          type="number"
                          min="0"
                          value={scenario.cutoffs[rank.name] ?? ""}
                          onChange={(e) => updateCutoff(scenario.id, rank.name, e.target.value)}
                          placeholder="—"
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* RANK CONFIG */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-zinc-400">Rank Names & Colors</label>
                <button type="button" onClick={addRank} className="text-xs bg-white text-black px-3 py-1 rounded font-medium hover:bg-zinc-200">+ Add Rank</button>
              </div>
              <div className="space-y-3">
                {ranks.map((rank, idx) => (
                  <div key={`${rank.name}-${idx}`} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <input
                      type="text"
                      value={rank.name}
                      onChange={(e) => updateRankName(idx, e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
                      placeholder="Rank name"
                    />
                    <input
                      type="color"
                      value={rank.color}
                      onChange={(e) => updateRankColor(idx, e.target.value)}
                      className="w-10 h-10 rounded-lg border border-white/10 shrink-0 cursor-pointer p-1"
                      title={`${rank.name} color`}
                    />
                    <button
                      type="button"
                      onClick={() => removeRank(idx)}
                      className="text-xs text-red-400 hover:text-red-300 px-2"
                      disabled={ranks.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
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