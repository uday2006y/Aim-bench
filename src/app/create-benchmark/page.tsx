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

interface CategoryDef {
  name: string;
  color: string;
  subCategories: string[];
}

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { name: "Other", color: "#7a7a7a", subCategories: [] },
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
  category: string;
  subCategory: string;
}

export default function CreateBenchmarkPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("EasyAim");
  const [difficulty, setDifficulty] = useState("medium");
  const [abbreviation, setAbbreviation] = useState("");
  const [benchmarkColor, setBenchmarkColor] = useState("#b9f2fe");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [dateAdded, setDateAdded] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [note, setNote] = useState("");
  const [useCustomRankCalc, setUseCustomRankCalc] = useState(false);
  const [scenarioCount, setScenarioCount] = useState<number>(1);
  const [scenarios, setScenarios] = useState<AddedScenario[]>([]);
  const [ranks, setRanks] = useState<RankDef[]>(DEFAULT_RANKS);
  const [categories, setCategories] = useState<CategoryDef[]>(
    DEFAULT_CATEGORIES
  );
  // Preselect the first category so the add-destination picker is never
  // blank on a fresh benchmark.
  const [addTargetCategory, setAddTargetCategory] = useState(
    DEFAULT_CATEGORIES[0].name
  );
  const [addTargetSubCategory, setAddTargetSubCategory] = useState("");
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

  const addTargetSubs =
    categories.find((c) => c.name === addTargetCategory)?.subCategories ?? [];

  function addScenario(scenario: ScenarioResult) {
    // Scenarios land in whichever category/sub-category is selected in the
    // "Add scenarios to" picker above the search box, so you can file them
    // straight into a group instead of fixing every one afterwards.
    const targetCategory = addTargetCategory || "Other";
    const targetSubCategory = addTargetSubCategory.trim();

    setScenarios((current) => {
      if (current.some((s) => s.id === scenario.id)) return current;
      return [
        ...current,
        {
          id: scenario.id,
          title: scenario.title,
          cutoffs: {},
          category: targetCategory,
          subCategory: targetSubCategory,
        },
      ];
    });
    setSearchQuery("");
    setResults([]);
  }

  function updateScenarioCategory(id: number, categoryName: string) {
    setScenarios((current) =>
      current.map((s) => {
        if (s.id !== id) return s;

        // Only drop the sub-category if it isn't valid under the new
        // category. Clearing it unconditionally meant re-picking the same
        // category after choosing a sub-category threw it away silently.
        const stillValid = (
          categories.find((c) => c.name === categoryName)?.subCategories ?? []
        ).includes(s.subCategory);

        return {
          ...s,
          category: categoryName,
          subCategory: stillValid ? s.subCategory : "",
        };
      })
    );
  }

  function updateScenarioSubCategory(id: number, subCategoryName: string) {
    setScenarios((current) =>
      current.map((s) =>
        s.id === id ? { ...s, subCategory: subCategoryName } : s
      )
    );
  }

  function addCategory() {
    setCategories((prev) => [
      ...prev,
      { name: `Category ${prev.length + 1}`, color: "#ffffff", subCategories: [] },
    ]);
  }

  function removeCategory(index: number) {
    const removedName = categories[index].name;
    const remaining = categories.filter((_, i) => i !== index);

    setCategories(remaining);
    setScenarios((prev) =>
      prev.map((s) =>
        s.category === removedName ? { ...s, category: "Other", subCategory: "" } : s
      )
    );

    // Don't leave the add-destination pointing at a category that's gone.
    if (addTargetCategory === removedName) {
      setAddTargetCategory(remaining[0]?.name ?? "Other");
      setAddTargetSubCategory("");
    }
  }

  function updateCategoryName(index: number, value: string) {
    const oldName = categories[index].name;
    const newName = value.trim() || `Category ${index + 1}`;
    setCategories((prev) => prev.map((c, i) => (i === index ? { ...c, name: newName } : c)));
    setScenarios((prev) =>
      prev.map((s) => (s.category === oldName ? { ...s, category: newName } : s))
    );
    // Keep the add-destination pointed at the same category after a rename.
    if (addTargetCategory === oldName) {
      setAddTargetCategory(newName);
    }
  }

  function updateCategoryColor(index: number, color: string) {
    setCategories((prev) => prev.map((c, i) => (i === index ? { ...c, color } : c)));
  }

  function addSubCategory(catIndex: number) {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex
          ? { ...c, subCategories: [...c.subCategories, `Sub ${c.subCategories.length + 1}`] }
          : c
      )
    );
  }

  function updateSubCategoryName(catIndex: number, subIndex: number, value: string) {
    const oldName = categories[catIndex].subCategories[subIndex];
    const newName = value.trim() || `Sub ${subIndex + 1}`;
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex
          ? {
              ...c,
              subCategories: c.subCategories.map((sc, si) => (si === subIndex ? newName : sc)),
            }
          : c
      )
    );
    setScenarios((prev) =>
      prev.map((s) =>
        s.category === categories[catIndex].name && s.subCategory === oldName
          ? { ...s, subCategory: newName }
          : s
      )
    );
  }

  function removeSubCategory(catIndex: number, subIndex: number) {
    const removedName = categories[catIndex].subCategories[subIndex];
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex
          ? { ...c, subCategories: c.subCategories.filter((_, si) => si !== subIndex) }
          : c
      )
    );
    setScenarios((prev) =>
      prev.map((s) =>
        s.category === categories[catIndex].name && s.subCategory === removedName
          ? { ...s, subCategory: "" }
          : s
      )
    );
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
        category: scenario.category || "Other",
        subCategory: scenario.subCategory || "",
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
          category_defs: categories,
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

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-400">Abbreviation (optional)</label>
                <input type="text" value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} placeholder="MCB" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-zinc-400">Benchmark Color</label>
                <input type="color" value={benchmarkColor} onChange={(e) => setBenchmarkColor(e.target.value)} className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900 p-1 cursor-pointer" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-zinc-400">Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-white outline-none focus:border-zinc-500">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
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

            {/* GENERAL INFO EXTRAS (Image 1) */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-400">Spreadsheet URL (Optional)</label>
                <input type="url" value={spreadsheetUrl} onChange={(e) => setSpreadsheetUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-zinc-400">Date Added</label>
                <input type="date" value={dateAdded} onChange={(e) => setDateAdded(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-zinc-400">Last Updated (Optional)</label>
                <input type="date" value={lastUpdated} onChange={(e) => setLastUpdated(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white outline-none focus:border-zinc-500" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">Note / Description (Extended)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Additional notes..." rows={3} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500 resize-none" />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input type="checkbox" checked={useCustomRankCalc} onChange={(e) => setUseCustomRankCalc(e.target.checked)} className="rounded border-zinc-600 bg-zinc-900 text-white" />
                Use Custom Rank Calculation
              </label>
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

              {/* Pick the destination group first, then search. Scenarios
                  added from the results below are filed straight into this
                  category and sub-category. */}
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-0.5">
                    Add scenarios to
                  </label>
                  <select
                    value={addTargetCategory}
                    onChange={(e) => {
                      setAddTargetCategory(e.target.value);
                      setAddTargetSubCategory("");
                    }}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none focus:border-zinc-500"
                  >
                    {categories.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-0.5">
                    Sub-category
                    {addTargetSubs.length > 0 && (
                      <span className="ml-1 text-zinc-600">
                        ({addTargetSubs.length})
                      </span>
                    )}
                  </label>
                  <input
                    list="add-sub-options"
                    value={addTargetSubCategory}
                    onChange={(e) => setAddTargetSubCategory(e.target.value)}
                    placeholder="—"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                  />
                  <datalist id="add-sub-options">
                    {addTargetSubs.map((sc) => (
                      <option key={sc} value={sc} />
                    ))}
                  </datalist>
                </div>
                <p className="col-span-2 text-[10px] text-zinc-600">
                  {addTargetCategory}
                  {addTargetSubCategory.trim()
                    ? ` / ${addTargetSubCategory.trim()}`
                    : ""}
                  {" · new scenarios go here. You can change it per scenario below."}
                </p>
              </div>

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
                        {addTargetCategory}
                        {addTargetSubCategory.trim()
                          ? ` / ${addTargetSubCategory.trim()}`
                          : ""}
                        {result.author ? ` · by ${result.author}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {scenarios.map((scenario) => {
                const availableSubs =
                  categories.find((c) => c.name === scenario.category)
                    ?.subCategories ?? [];

                return (
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

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-0.5">Category</label>
                      <select
                        value={scenario.category}
                        onChange={(e) => updateScenarioCategory(scenario.id, e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none focus:border-zinc-500"
                      >
                        {categories.map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-0.5">
                        Sub-category
                        {availableSubs.length > 0 && (
                          <span className="ml-1 text-zinc-600">
                            ({availableSubs.length})
                          </span>
                        )}
                      </label>
                      {/* Text input with a datalist rather than a <select>:
                          it suggests the sub-categories already defined for
                          this category, but still accepts a typed value. */}
                      <input
                        list={`sub-options-${scenario.id}`}
                        value={scenario.subCategory}
                        onChange={(e) => updateScenarioSubCategory(scenario.id, e.target.value)}
                        placeholder="—"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                      />
                      <datalist id={`sub-options-${scenario.id}`}>
                        {availableSubs.map((sc) => (
                          <option key={sc} value={sc} />
                        ))}
                      </datalist>
                    </div>
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
                );
              })}
            </div>

            {/* RANK CONFIG */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-zinc-400">Rank Names & Colors</label>
                <button type="button" onClick={addRank} className="text-xs bg-white text-black px-3 py-1 rounded font-medium hover:bg-zinc-200">+ Add Rank</button>
              </div>
              <div className="space-y-3">
                {ranks.map((rank, idx) => (
                  <div key={`rank-${idx}`} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
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

            {/* DIFFICULTIES SECTION (Image 2 style) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
              <h2 className="text-xl font-bold tracking-tight mb-4">Difficulties</h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 mb-4">
                <div className="grid grid-cols-3 gap-3 mb-2">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Difficulty Name</label>
                    <input type="text" defaultValue="Easy" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">KovaaK's ID</label>
                    <input type="number" defaultValue={0} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Shortcode</label>
                    <input type="text" placeholder="KovaaKsShareCodeHere" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none" />
                  </div>
                </div>
                <div className="text-xs text-zinc-400 mt-3 mb-3">Ranks</div>
                <div className="space-y-2">
                  {DEFAULT_RANKS.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="text" value={r.name} readOnly className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
                      <input type="color" value={r.color} readOnly className="w-8 h-8 rounded border border-zinc-700 shrink-0" />
                      <span className="text-xs font-mono text-zinc-500 truncate">{r.color.toUpperCase()}</span>
                      <button type="button" className="ml-auto text-xs text-red-400 hover:text-red-300">&#128465;</button>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-3 text-xs bg-white text-black px-3 py-1 rounded font-medium hover:bg-zinc-200">+ Add Rank</button>

                                <div className="text-xs text-zinc-400 mt-4 mb-2">Categories</div>
                <div className="space-y-3">
                  {categories.map((cat, catIdx) => (
                    <div key={catIdx} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) => updateCategoryName(catIdx, e.target.value)}
                          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none"
                        />
                        <input
                          type="color"
                          value={cat.color}
                          onChange={(e) => updateCategoryColor(catIdx, e.target.value)}
                          className="w-8 h-8 rounded border border-zinc-700 shrink-0 cursor-pointer p-1"
                        />
                        <span className="text-xs font-mono text-zinc-500 truncate">{cat.color.toUpperCase()}</span>
                        <button
                          type="button"
                          onClick={() => removeCategory(catIdx)}
                          className="text-xs text-red-400 hover:text-red-300"
                          disabled={categories.length <= 1}
                        >
                          &#128465;
                        </button>
                      </div>
                      <div className="mt-2 pl-3 space-y-1.5">
                        {cat.subCategories.map((sub, subIdx) => (
                          <div key={subIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={sub}
                              onChange={(e) => updateSubCategoryName(catIdx, subIdx, e.target.value)}
                              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeSubCategory(catIdx, subIdx)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              &#10005;
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addSubCategory(catIdx)}
                          className="text-xs border border-zinc-600 text-white px-2 py-1 rounded font-medium hover:bg-zinc-800"
                        >
                          + Add Subcategory
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addCategory} className="mt-3 text-xs border border-zinc-600 text-white px-3 py-1 rounded font-medium hover:bg-zinc-800">+ Add Category</button>
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