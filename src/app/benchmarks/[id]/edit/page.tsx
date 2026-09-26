"use client";



import { useState, useEffect, use } from "react";
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

interface CategoryDef {
  name: string;
  color: string;
  subCategories: string[];
}

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { name: "Other", color: "#7a7a7a", subCategories: [] },
];

interface Scenario {
  id: number;
  title: string;
  cutoffs: Record<string, number | string | undefined>;
  category: string;
  subCategory: string;
}

export default function EditBenchmarkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("easyaim");
  const [difficulty, setDifficulty] = useState("medium");
  const [abbreviation, setAbbreviation] = useState("");
  const [benchmarkColor, setBenchmarkColor] = useState("#b9f2fe");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [dateAdded, setDateAdded] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [note, setNote] = useState("");
  const [useCustomRankCalc, setUseCustomRankCalc] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>(DEFAULT_CATEGORIES);
  // Where the next scenario picked from EasyAim search will be filed.
  const [addTargetCategory, setAddTargetCategory] = useState("");
  const [addTargetSubCategory, setAddTargetSubCategory] = useState("");
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
        const loadedCategories =
          Array.isArray(benchmarkData.category_defs) &&
          benchmarkData.category_defs.length > 0
            ? benchmarkData.category_defs
            : DEFAULT_CATEGORIES;

        setCategories(loadedCategories);
        setAddTargetCategory(loadedCategories[0]?.name ?? "Other");

        setScenarios(
          (data.scenarios || []).map((s: any) => ({
            id: s.easyaim_scenario_id,
            title: s.title,
            cutoffs: s.cutoffs || {},
            category: s.category || "Other",
            subCategory: s.sub_category || "",
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
    // Scenarios land in whichever category/sub-category is selected in the
    // "Add scenarios to" picker above the search box, so you can file them
    // straight into a group instead of fixing every one afterwards.
    const targetCategory = addTargetCategory || "Other";
    const targetSubCategory = addTargetSubCategory.trim();

    setScenarios((prev) => {
      if (prev.some((s) => s.id === scenario.id)) return prev;
      return [
        ...prev,
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
    setSearchResults([]);
  }

  function removeScenario(index: number) {
    setScenarios((prev) => prev.filter((_, i) => i !== index));
  }

  function updateScenarioCategory(index: number, categoryName: string) {
    setScenarios((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;

        // Only drop the sub-category if it isn't valid under the new
        // category. Clearing it unconditionally meant that re-picking the
        // same category after choosing a sub-category threw the
        // sub-category away without any visible feedback.
        const stillValid = (categories.find((c) => c.name === categoryName)
          ?.subCategories ?? []).includes(s.subCategory);

        return { ...s, category: categoryName, subCategory: stillValid ? s.subCategory : "" };
      })
    );
  }

  function updateScenarioSubCategory(index: number, subCategoryName: string) {
    setScenarios((prev) =>
      prev.map((s, i) => (i === index ? { ...s, subCategory: subCategoryName } : s))
    );
  }

  const addTargetSubs =
    categories.find((c) => c.name === addTargetCategory)?.subCategories ?? [];

  function addCategory() {
    setCategories((prev) => [
      ...prev,
      {
        name: `Category ${prev.length + 1}`,
        color: "#ffffff",
        subCategories: [],
      },
    ]);
  }

  function removeCategory(index: number) {
    const removedName = categories[index].name;
    const remaining = categories.filter((_, i) => i !== index);

    setCategories(remaining);
    setScenarios((prev) =>
      prev.map((s) =>
        s.category === removedName
          ? { ...s, category: "Other", subCategory: "" }
          : s
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
    setCategories((prev) =>
      prev.map((c, i) => (i === index ? { ...c, name: newName } : c))
    );
    setScenarios((prev) =>
      prev.map((s) => (s.category === oldName ? { ...s, category: newName } : s))
    );
    // Keep the add-destination pointed at the same category after a rename.
    if (addTargetCategory === oldName) {
      setAddTargetCategory(newName);
    }
  }

  function updateCategoryColor(index: number, color: string) {
    setCategories((prev) =>
      prev.map((c, i) => (i === index ? { ...c, color } : c))
    );
  }

  function addSubCategory(catIndex: number) {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex
          ? {
              ...c,
              subCategories: [
                ...c.subCategories,
                `Sub ${c.subCategories.length + 1}`,
              ],
            }
          : c
      )
    );
  }

  function updateSubCategoryName(catIndex: number, subIndex: number, value: string) {
    const oldName = categories[catIndex].subCategories[subIndex];
    const newName = value.trim() || `Sub ${subIndex + 1}`;
    const categoryName = categories[catIndex].name;

    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex
          ? {
              ...c,
              subCategories: c.subCategories.map((sc, si) =>
                si === subIndex ? newName : sc
              ),
            }
          : c
      )
    );

    setScenarios((prev) =>
      prev.map((s) =>
        s.category === categoryName && s.subCategory === oldName
          ? { ...s, subCategory: newName }
          : s
      )
    );
  }

  function removeSubCategory(catIndex: number, subIndex: number) {
    const removedName = categories[catIndex].subCategories[subIndex];
    const categoryName = categories[catIndex].name;

    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex
          ? {
              ...c,
              subCategories: c.subCategories.filter((_, si) => si !== subIndex),
            }
          : c
      )
    );

    setScenarios((prev) =>
      prev.map((s) =>
        s.category === categoryName && s.subCategory === removedName
          ? { ...s, subCategory: "" }
          : s
      )
    );
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

  function updateRankName(index: number, value: string) {
    const newName = value.trim() || `Rank ${index + 1}`;
    setRanks((prev) => prev.map((r, i) => i === index ? { ...r, name: newName } : r));
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
        category_defs: categories,
        scenarios: scenarios.map((s) => ({
          id: s.id,
          title: s.title,
          category: s.category || "Other",
          subCategory: s.subCategory || "",
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
            <select
              value={scenarios.length > 0 ? "easyaim" : platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={scenarios.length > 0}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none disabled:opacity-60"
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
            <label className="block text-sm text-zinc-400 mb-2">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Abbreviation</label>
              <input type="text" value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Color</label>
              <input type="color" value={benchmarkColor} onChange={(e) => setBenchmarkColor(e.target.value)} className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900 p-1 cursor-pointer" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Spreadsheet URL</label>
              <input type="url" value={spreadsheetUrl} onChange={(e) => setSpreadsheetUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Date Added</label>
              <input type="date" value={dateAdded} onChange={(e) => setDateAdded(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Last Updated</label>
              <input type="date" value={lastUpdated} onChange={(e) => setLastUpdated(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none resize-none" />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input type="checkbox" checked={useCustomRankCalc} onChange={(e) => setUseCustomRankCalc(e.target.checked)} className="rounded border-zinc-600 bg-zinc-900 text-white" />
              Use Custom Rank Calculation
            </label>
          </div>

          {/* DIFFICULTIES STUB */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="text-xl font-bold tracking-tight mb-4">Difficulties</h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 mb-4">
              <div className="grid grid-cols-3 gap-3 mb-2">
                <input className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none" defaultValue="Easy" />
                <input type="number" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none" defaultValue={0} />
                <input className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none" placeholder="Shortcode" />
              </div>
              <div className="text-xs text-zinc-400 mt-3 mb-3">Ranks</div>
              <div className="space-y-2">
                {DEFAULT_RANKS.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="text" value={r.name} readOnly className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
                    <input type="color" value={r.color} readOnly className="w-8 h-8 rounded border border-zinc-700 shrink-0" />
                    <span className="text-xs font-mono text-zinc-500">{r.color.toUpperCase()}</span>
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
            <label className="text-sm text-zinc-400 mb-2">Add EasyAim Scenario (optional)</label>

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

            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search EasyAim scenarios..." className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none" />
            {searching && <p className="text-xs text-zinc-500 mt-2">Searching...</p>}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900">
                {searchResults.map((r: any) => (
                  <button key={r.id} type="button" onClick={() => addScenarioFromResult(r)} className="flex w-full items-center justify-between gap-4 border-b border-white/5 px-4 py-3 text-left text-sm last:border-0 hover:bg-white/5">
                    <span className="truncate">{r.title}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {addTargetCategory}
                      {addTargetSubCategory.trim()
                        ? ` / ${addTargetSubCategory.trim()}`
                        : ""}
                      {r.author ? ` · by ${r.author}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-zinc-400">Scenarios</label>
            </div>
            <div className="space-y-3">
              {scenarios.map((scenario, idx) => {
                const availableSubs =
                  categories.find((c) => c.name === scenario.category)
                    ?.subCategories ?? [];

                return (
                <div key={scenario.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <input value={scenario.title} onChange={(e) => setScenarios((prev) => prev.map((s, i) => i === idx ? { ...s, title: e.target.value } : s))} className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Scenario title" />
                    <button type="button" onClick={() => removeScenario(idx)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-0.5">Category</label>
                      <select
                        value={scenario.category}
                        onChange={(e) => updateScenarioCategory(idx, e.target.value)}
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
                      {/* A text input with a datalist rather than a <select>:
                          it suggests the sub-categories already defined for this
                          category, but still accepts a typed value. The old
                          <select> could only ever offer predefined entries, so a
                          category with none looked identical to "no sub-category"
                          and the assignment was easy to miss. */}
                      <input
                        list={`sub-options-${idx}`}
                        value={scenario.subCategory}
                        onChange={(e) => updateScenarioSubCategory(idx, e.target.value)}
                        placeholder="—"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                      />
                      <datalist id={`sub-options-${idx}`}>
                        {availableSubs.map((sc) => (
                          <option key={sc} value={sc} />
                        ))}
                      </datalist>
                    </div>
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
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-zinc-400">Rank Names & Colors</label>
              <button type="button" onClick={addRank} className="text-xs bg-white text-black px-3 py-1 rounded font-medium hover:bg-zinc-200">+ Add Rank</button>
            </div>
            <div className="space-y-2">
              {ranks.map((rankDef, idx) => (
                <div key={`rank-${idx}`} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
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
