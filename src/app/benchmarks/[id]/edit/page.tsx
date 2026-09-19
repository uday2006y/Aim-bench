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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/benchmarks/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setTitle(data.benchmark.title);
        setDescription(data.benchmark.description || "");
        setPlatform(data.benchmark.platform || "easyaim");
        setDifficulty(data.benchmark.difficulty || "medium");
        setScenarios(
          (data.scenarios || []).map((s: any) => ({
            id: s.easyaim_scenario_id,
            title: s.title,
            cutoffs: s.cutoffs || {},
          }))
        );
      } catch {
        setError("Failed to load benchmark");
      } finally {
        setLoading(false);
      }
    }
    load();
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
                  <div className="grid grid-cols-4 gap-2">
                    {RANK_NAMES.map((rank) => (
                      <label key={rank} className="block">
                        <span className="text-xs text-zinc-500 mb-1 block">{rank}</span>
                        <input type="number" min="0" value={scenario.cutoffs[rank] ?? ""} onChange={(e) => updateCutoff(idx, rank, e.target.value)} placeholder="—" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
