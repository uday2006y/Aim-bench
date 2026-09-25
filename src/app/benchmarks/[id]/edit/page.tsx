"use client";



import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const RANK_NAMES = [
  "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Champion", "Radiant", "Immortal",
];

interface Scenario {
  id: number;
  title: string;
  cutoffs: Record<string, number | string | undefined>;
}

export default function EditBenchmarkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("easyaim");
  const [difficulty, setDifficulty] = useState("medium");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [ranks, setRanks] = useState<{name: string; color: string}[]>([
    { name: "Bronze", color: "#b87333" },
    { name: "Silver", color: "#c0c0c0" },
    { name: "Gold", color: "#ffd700" },
    { name: "Platinum", color: "#e5e4e2" },
    { name: "Diamond", color: "#b9f2fe" },
    { name: "Champion", color: "#ffd700" },
    { name: "Radiant", color: "#ff0000" },
    { name: "Immortal", color: "#9f9f9f" },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function checkAndLoad() {
      const res = await fetch(`/api/benchmarks/${id}`);
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const benchmarkData = data.benchmark;

      const sessionRes = await fetch("/api/session");
      const sessionData = await sessionRes.json();
      const accId = sessionData.accountId ?? null;
      if (benchmarkData && accId && benchmarkData.user_id === accId) {
        setIsOwner(true);
        setTitle(benchmarkData.title);
        setDescription(benchmarkData.description || "");
        setPlatform(benchmarkData.platform || "easyaim");
        setDifficulty(benchmarkData.difficulty || "medium");
        setScenarios(
          (data.scenarios || []).map((s: any) => ({
            id: s.easyaim_scenario_id,
            title: s.title,
            cutoffs: s.cutoffs || {},
          }))
        );
      } else {
        setIsOwner(false);
        setNotFound(true);
        setLoading(false);
        router.push(`/benchmarks/${id}`);
        return;
      }

      setLoading(false);
    }
    checkAndLoad();
  }, [id]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/easyaim/scenarios?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSearchResults(res.ok ? data.scenarios || [] : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  function addScenarioFromResult(scenario: any) {
    setScenarios((prev) => {
      if (prev.some((s) => s.id === scenario.id)) return prev;
      return [...prev, { id: scenario.id, title: scenario.title, cutoffs: {} }];
    });
    setSearchQuery("");
    setSearchResults([]);
  }

  function addScenario() {
    setScenarios((prev) => [...prev, { id: Date.now(), title: "New Scenario", cutoffs: {} }]);
  }

  function removeScenario(index: number) {
    setScenarios((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCutoff(index: number, rank: string, value: string) {
    setScenarios((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, cutoffs: { ...s.cutoffs, [rank]: value ? Number(value) : undefined } }
          : s
      )
    );
  }

  function addRank() {
    setRanks((prev) => [...prev, { name: `Rank ${prev.length + 1}`, color: "#ffffff" }]);
  }

  function removeRank(index: number) {
    const rankName = ranks[index].name;
    setRanks((prev) => prev.filter((_, i) => i !== index));
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
    setScenarios((prev) => prev.map((s) => {
      const newCutoffs: Record<string, string | number | undefined> = {};
      for (const [k, v] of Object.entries(s.cutoffs)) {
        newCutoffs[k === oldName ? newName : k] = v;
      }
      return { ...s, cutoffs: newCutoffs };
    }));
  }

  function updateRankColor(index: number, color: string) {
    setRanks((prev) => prev.map((r, i) => i === index ? { ...r, color } : r));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        title,
        description,
        difficulty,
        platform,
        rank_names: ranks.map((r) => r.name),
        rank_colors: ranks.map((r) => r.color),
        scenarios: scenarios.map((s) => ({
          id: s.id,
          title: s.title,
          cutoffs: Object.fromEntries(
            Object.entries(s.cutoffs).filter(([, v]) => v !== undefined && v !== "")
          ),
        })),
      };
      const res = await fetch(`/api/benchmarks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      router.push(`/benchmarks/${id}`);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen text-white flex items-center justify-center"><p>Loading...</p></main>;
  }

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href={`/benchmarks/${id}`} className="text-sm text-zinc-500 hover:text-white mb-6 inline-block">← Back</Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit Benchmark</h1>

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none" required />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none resize-none" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none">
              <option value="easyaim">easyaim</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-zinc-400 mb-2">Add EasyAim Scenario (optional)</label>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search EasyAim scenarios..." className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none" />
            {searching && <p className="text-xs text-zinc-500 mt-2">Searching...</p>}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900">
                {searchResults.map((r: any) => (
                  <button key={r.id} type="button" onClick={() => addScenarioFromResult(r)} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 border-b border-zinc-800 last:border-0">
                    {r.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-zinc-400">Scenarios</label>
              <button type="button" onClick={addScenario} className="text-xs bg-white text-black px-3 py-1 rounded font-medium hover:bg-zinc-200">+ Add Scenario</button>
            </div>
            <div className="space-y-3">
              {scenarios.map((scenario, idx) => (
                <div key={scenario.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <input value={scenario.title} onChange={(e) => setScenarios((prev) => prev.map((s, i) => i === idx ? { ...s, title: e.target.value } : s))} className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Scenario title" />
                    <button type="button" onClick={() => removeScenario(idx)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {ranks.map((rankDef, rIdx) => (
                      <div key={`${scenario.id}-${rankDef.name}-${rIdx}`} className="block">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs text-zinc-500 truncate">{rankDef.name}</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={scenario.cutoffs[rankDef.name] ?? ""}
                          onChange={(e) => updateCutoff(idx, rankDef.name, e.target.value)}
                          placeholder="—"
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-zinc-400">Rank Names & Colors</label>
              <button type="button" onClick={addRank} className="text-xs bg-white text-black px-3 py-1 rounded font-medium hover:bg-zinc-200">+ Add Rank</button>
            </div>
            <div className="space-y-2">
              {ranks.map((rankDef, idx) => (
                <div key={`${rankDef.name}-${idx}`} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
                  <input
                    type="text"
                    value={rankDef.name}
                    onChange={(e) => updateRankName(idx, e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white outline-none focus:border-zinc-500"
                    placeholder="Rank name"
                  />
                  <input
                    type="color"
                    value={rankDef.color}
                    onChange={(e) => updateRankColor(idx, e.target.value)}
                    className="w-8 h-8 rounded border border-white/10 shrink-0 cursor-pointer p-0.5"
                    title={`${rankDef.name} color`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRank(idx)}
                    className="text-xs text-red-400 hover:text-red-300 px-1"
                    disabled={ranks.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-600">Changing rank names updates scenario score inputs. Removing a rank removes its scores.</p>
          </div>

          {error && <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">{error}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
