"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import {
  renameCutoffKey,
  MAX_SCENARIOS_PER_BENCHMARK,
} from "@/lib/benchmarkScenarios";
import {
  MAX_TIERS,
  slugifyTierName,
  type TierDraft,
} from "@/lib/benchmarkTiers";

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
  author: string | null;
}

interface AddedScenario {
  id: number;
  title: string;
  cutoffs: Record<string, string>;
  category: string;
  subCategory: string;
  /** Which tier this scenario belongs to. Scenarios are owned by a tier. */
  tierSlug: string;
}

/**
 * A tier being named on the create form.
 *
 * Cutoffs are not collected here. A tier's ladder and its per-scenario
 * requirements are the same shape of work as the benchmark's own, and asking
 * for six of them before the benchmark exists would mean re-entering the same
 * ladder six times in one sitting. Every tier starts from the benchmark's
 * ladder and its scenarios' cutoffs are copied in, so each tier is immediately
 * real and can be tuned on the edit page one tier at a time.
 */
interface TierDraftRow extends TierDraft {
  id: string;
  /**
   * Set once the slug stops tracking the name. Editing the create form does not
   * need it — there are no addresses yet — but it keeps the "slug follows the
   * name" rule in one place for the edit form, which does.
   */
  slugLocked?: boolean;
}

/**
 * The platform value stored on the row. Lower-case on purpose: the list
 * endpoint filters with an exact `.eq("platform", ...)`, and this used to
 * initialise as "EasyAim" while the only <option> was value="easyaim". A
 * benchmark saved with no scenarios therefore stored "EasyAim" and could
 * never be reached by the "easyaim" filter. The label in the picker is
 * free to be pretty; the value is not.
 */
const PLATFORM = "easyaim";

export default function CreateBenchmarkForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState(PLATFORM);
  const [difficulty, setDifficulty] = useState("medium");
  const [scenarioCount, setScenarioCount] = useState<number>(1);
  const [scenarios, setScenarios] = useState<AddedScenario[]>([]);
  const [ranks, setRanks] = useState<RankDef[]>(DEFAULT_RANKS);
  const [categories, setCategories] = useState<CategoryDef[]>(DEFAULT_CATEGORIES);
  // How many tiers this benchmark has, and what they are called. The count is
  // the author's choice up to six — the switcher in the header is a menu, and
  // past six it stops being one.
  const [tiers, setTiers] = useState<TierDraftRow[]>([
    { id: "tier-0", slug: "standard", name: "Standard", isOfficial: true },
  ]);
  // Preselect the first category so the add-destination picker is never
  // blank on a fresh benchmark.
  const [addTargetCategory, setAddTargetCategory] = useState(
    DEFAULT_CATEGORIES[0].name
  );
  const [addTargetSubCategory, setAddTargetSubCategory] = useState("");
  // Which tier a newly picked scenario is filed under. Scenarios belong to a
  // tier, so this is a first-class choice rather than something inferred.
  const [addTargetTier, setAddTargetTier] = useState(tiers[0]?.slug ?? "primary");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  /**
   * Confirms a destructive edit. Removing a rank drops every scenario
   * requirement filed under it, and the row just disappearing gives no clue
   * that anything else went with it.
   */
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // Search responses can arrive out of order — a slow request for "eas"
  // landing after a fast one for "easyaim" would replace the newer results
  // with the older ones. Only the most recent request is allowed to write.
  const searchRequest = useRef(0);

  const query = searchQuery.trim();
  const longEnough = query.length >= 2;

  useEffect(() => {
    // Invalidate anything in flight before doing anything else, so a response
    // for a longer query cannot land after the visitor has deleted back below
    // the minimum length.
    const ticket = ++searchRequest.current;

    if (!longEnough) return;

    const timeout = setTimeout(async () => {
      setSearching(true);

      try {
        const response = await fetch(
          `/api/easyaim/scenarios?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();

        if (ticket !== searchRequest.current) return;

        setResults(response.ok ? data.scenarios || [] : []);
      } catch {
        if (ticket !== searchRequest.current) return;
        setResults([]);
      } finally {
        if (ticket === searchRequest.current) setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, longEnough]);

  // Whether results are shown is derived from the query rather than cleared
  // from state: emptying the box hides the list without needing an effect to
  // write to it, and cannot leave a stale list on screen.
  const visibleResults = longEnough ? results : [];

  const addTargetSubs =
    categories.find((c) => c.name === addTargetCategory)?.subCategories ?? [];

  const atScenarioLimit = scenarios.length >= MAX_SCENARIOS_PER_BENCHMARK;

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
          tierSlug: addTargetTier,
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
    setNotice("");
    setRanks((prev) => [...prev, { name: `Rank ${prev.length + 1}`, color: "#ffffff" }]);
  }

  /**
   * Deletes a rank and every scenario requirement filed under it.
   *
   * The count comes from the scenarios as they are now, before the state
   * update lands, so it reports what was on screen when the button was
   * pressed rather than what survived the re-render.
   */
  function removeRank(index: number) {
    const rankName = ranks[index].name;
    const dropped = scenarios.filter((s) => s.cutoffs?.[rankName] !== undefined).length;

    setRanks((prev) => prev.filter((_, i) => i !== index));
    // Remove this rank from all scenario cutoffs
    setScenarios((prev) => prev.map((s) => {
      const newCutoffs = { ...s.cutoffs };
      delete newCutoffs[rankName];
      return { ...s, cutoffs: newCutoffs };
    }));

    setNotice(
      dropped > 0
        ? `Deleted ${rankName} and its score requirement on ${dropped} scenario${dropped === 1 ? "" : "s"}.`
        : `Deleted ${rankName}. It had no score requirements set.`
    );
    setError("");
  }

  function updateRankName(index: number, value: string) {
    const oldName = ranks[index].name;
    const newName = value.trim() || `Rank ${index + 1}`;

    if (oldName === newName) return;

    setNotice("");
    setRanks((prev) => prev.map((r, i) => i === index ? { ...r, name: newName } : r));
    // Carry every scenario's requirement onto the new key. Shared with the
    // edit form via renameCutoffKey, because the two used to disagree here.
    setScenarios((prev) =>
      prev.map((s) => ({ ...s, cutoffs: renameCutoffKey(s.cutoffs, oldName, newName) }))
    );
  }

  function updateRankColor(index: number, color: string) {
    setNotice("");
    setRanks((prev) => prev.map((r, i) => (i === index ? { ...r, color } : r)));
  }

  // ------------------------------------------------------------------ tiers

  /**
   * Adds a tier, or does nothing at the ceiling.
   *
   * This is an "Add" button rather than a "how many" number input on purpose.
   * A count and a list are two pieces of state that have to agree; the number
   * input was the only way to desynchronise them, and when it did the count
   * said six and the benchmark got one. A button cannot be out of step with
   * what is on screen.
   */
  function addTier() {
    setTiers((current) => {
      if (current.length >= MAX_TIERS) return current;

      const suggestions = [
        "Novice",
        "Intermediate",
        "Advanced",
        "Elite",
        "Legendary",
        "Custom",
      ];

      // Never suggest a name already in use: two tiers that slugify alike would
      // make /benchmarks/<id>/<slug> ambiguous, and the second is silently
      // dropped on the server.
      const taken = new Set(current.map((tier) => tier.slug));

      let name = suggestions.find((option) => !taken.has(slugifyTierName(option)));

      if (!name) {
        for (let n = 1; ; n++) {
          const candidate = `Tier ${current.length + n}`;
          if (!taken.has(slugifyTierName(candidate))) {
            name = candidate;
            break;
          }
        }
      }

      return [
        ...current,
        {
          id: `tier-${current.length}`,
          slug: slugifyTierName(name),
          name,
          isOfficial: true,
        },
      ];
    });
  }

  function removeTierAt(index: number) {
    setTiers((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, i) => i !== index);
    });
  }

  function updateTierName(index: number, name: string) {
    setTiers((current) =>
      current.map((tier, i) =>
        i === index
          ? {
              ...tier,
              name,
              // Slug tracks the name only while the author has not typed one
              // themselves; once it does, renaming is free without moving the
              // tier's address.
              slug: tier.slugLocked ? tier.slug : slugifyTierName(name) || tier.slug,
            }
          : tier
      )
    );
  }

  function toggleTierOfficial(index: number) {
    setTiers((current) =>
      current.map((tier, i) =>
        i === index ? { ...tier, isOfficial: !tier.isOfficial } : tier
      )
    );
  }

  /**
   * Two tiers cannot slugify to the same address, so flag it here rather than
   * letting the server silently drop the second one.
   */
  const tierSlugClash = useMemo(() => {
    const seen = new Set<string>();
    const clashes = new Set<string>();

    for (const tier of tiers) {
      const slug = slugifyTierName(tier.name) || tier.slug;
      if (seen.has(slug)) clashes.add(tier.id);
      seen.add(slug);
    }

    return clashes;
  }, [tiers]);

  const unnamedTiers = tiers.filter((tier) => !tier.name.trim());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Give the benchmark a title");
      return;
    }

    if (unnamedTiers.length > 0) {
      setError("Every tier needs a name, or remove the ones you do not want");
      return;
    }

    if (tierSlugClash.size > 0) {
      setError("Two tiers end up with the same address — give them different names");
      return;
    }

    if (scenarios.length > MAX_SCENARIOS_PER_BENCHMARK) {
      setError(`A benchmark can hold at most ${MAX_SCENARIOS_PER_BENCHMARK} scenarios`);
      return;
    }

    // A rank with no cutoff anywhere can never be reached, which is a
    // legitimate thing to leave half-configured while you build a benchmark
    // out — but only a benchmark with scenarios actually uses the ladder.
    if (scenarios.length > 0) {
      const unreachable = ranks.filter((rank) =>
        scenarios.every((s) => !String(s.cutoffs[rank.name] ?? "").trim())
      );

      if (unreachable.length > 0 && scenarios.length > 0) {
        const proceed = window.confirm(
          `No score is set for ${unreachable.map((r) => r.name).join(", ")}, ` +
            `so ${unreachable.length === 1 ? "that rank can" : "those ranks can"} never be reached. ` +
            "Save anyway?"
        );

        if (!proceed) return;
      }
    }

    setLoading(true);

    try {
      const payloadScenarios = scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        category: scenario.category || "Other",
        subCategory: scenario.subCategory || "",
        tierSlug: scenario.tierSlug,
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
          title: title.trim(),
          description,
          platform: scenarios.length > 0 ? PLATFORM : platform,
          difficulty,
          rank_names: ranks.map((r) => r.name),
          rank_colors: ranks.map((r) => r.color),
          // The ladder is defined by the per-scenario cutoffs. The legacy
          // total-score thresholds are only a fallback for rows written
          // before cutoffs existed, so an empty object here is correct and
          // sending the old defaults would invent a ladder nothing obeys.
          rank_thresholds: {},
          category_defs: categories,
          scenarios: payloadScenarios,
          // Each tier starts from the benchmark's ladder. The server copies the
          // benchmark's cutoffs onto every tier too, so all of them are real
          // and editable the moment the benchmark exists.
          tiers: tiers.map((tier) => ({
            name: tier.name.trim(),
            slug: tier.slug,
            isOfficial: tier.isOfficial,
          })),
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
    <main className="min-h-screen text-white">
      <SiteHeader loggedIn />

      <div className="mx-auto max-w-2xl px-6 py-12">
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
                maxLength={200}
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

              {/* Pick the destination first, then search. A scenario belongs to
                  a tier, so the tier is the first choice here and the category
                  is scoped to it. */}
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-500 mb-0.5">
                    Add scenarios to tier
                  </label>
                  <select
                    value={addTargetTier}
                    onChange={(e) => setAddTargetTier(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none focus:border-zinc-500"
                  >
                    {tiers.map((tier) => (
                      <option key={tier.id} value={tier.slug}>
                        {tier.isOfficial ? tier.name : `${tier.name} (Unofficial)`}
                      </option>
                    ))}
                  </select>
                </div>
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
                  {tiers.find((t) => t.slug === addTargetTier)?.name ?? addTargetTier}
                  {addTargetCategory ? ` / ${addTargetCategory}` : ""}
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

              {searching && longEnough && (
                <p className="mt-2 text-xs text-zinc-500">Searching...</p>
              )}

              {atScenarioLimit && (
                <p className="mt-2 text-xs text-amber-300/90">
                  This is the maximum of {MAX_SCENARIOS_PER_BENCHMARK}{" "}
                  scenarios. Remove one to add another.
                </p>
              )}

              {visibleResults.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900">
                  {visibleResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => addScenario(result)}
                      disabled={atScenarioLimit}
                      className="flex w-full items-center justify-between gap-4 border-b border-white/5 px-4 py-3 text-left text-sm last:border-0 hover:bg-white/5 disabled:opacity-40"
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
                      /* Keyed by index, deliberately. This used to key on
                         the rank's own name, and the input below writes to
                         that name — so every keystroke changed the key,
                         React remounted the input, and the field lost focus
                         after one character. The row's position is what
                         identifies it; the name is data. */
                      <div key={`cutoff-${idx}`} className="block">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={rank.name}
                            onChange={(e) => updateRankName(idx, e.target.value)}
                            aria-label={`Rank ${idx + 1} name`}
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
                          step="any"
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
                      aria-label={`Rank ${idx + 1} name`}
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
              <p className="mt-2 text-xs text-zinc-600">
                Renaming a rank carries its per-scenario scores across.
                Removing one deletes them.
              </p>
            </div>

            {/* CATEGORIES */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
              <h2 className="text-xl font-bold tracking-tight mb-1">Categories</h2>
              <p className="mb-4 text-xs text-zinc-600">
                Group scenarios into categories and sub-categories. These
                become the coloured rails on the benchmark table.
              </p>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="space-y-3">
                  {categories.map((cat, catIdx) => (
                    <div key={catIdx} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) => updateCategoryName(catIdx, e.target.value)}
                          aria-label={`Category ${catIdx + 1} name`}
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
                          aria-label={`Remove ${cat.name}`}
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
                              aria-label={`Sub-category ${subIdx + 1} in ${cat.name}`}
                              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeSubCategory(catIdx, subIdx)}
                              className="text-xs text-red-400 hover:text-red-300"
                              aria-label={`Remove sub-category ${sub}`}
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

            {/* TIERS */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Tiers</h2>
                  <p className="mt-1 max-w-md text-xs text-zinc-600">
                    Up to {MAX_TIERS} ways to score this benchmark. Each tier
                    gets its own rank ladder and its own cutoffs, and each is a
                    page of its own at{" "}
                    <code className="font-mono">/benchmarks/&lt;id&gt;/&lt;tier&gt;</code>{" "}
                    with a switcher in the header. One tier is fine — the
                    switcher only appears once there is a choice to make.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">
                    {tiers.length} of {MAX_TIERS}
                  </span>
                  <button
                    type="button"
                    onClick={addTier}
                    disabled={tiers.length >= MAX_TIERS}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
                  >
                    + Add tier
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {tiers.map((tier, index) => {
                  const clash = tierSlugClash.has(tier.id);
                  const slug = slugifyTierName(tier.name) || tier.slug;

                  return (
                    <div
                      key={tier.id}
                      className={`flex flex-wrap items-center gap-3 rounded-lg border bg-zinc-900/60 p-3 ${
                        clash ? "border-red-900/60" : "border-zinc-800"
                      }`}
                    >
                      <span className="w-5 shrink-0 text-xs font-mono text-zinc-600">
                        {index + 1}
                      </span>

                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => updateTierName(index, e.target.value)}
                        placeholder="Tier name"
                        maxLength={40}
                        aria-label={`Tier ${index + 1} name`}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
                      />

                      {/* The address this tier will live at. Shown because a
                          name that slugs badly is otherwise invisible until
                          someone shares the link. */}
                      <code className="shrink-0 font-mono text-[11px] text-zinc-600">
                        /{slug}
                      </code>

                      <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500">
                        <input
                          type="checkbox"
                          checked={!tier.isOfficial}
                          onChange={() => toggleTierOfficial(index)}
                          className="rounded border-zinc-600 bg-zinc-900 text-white"
                        />
                        Unofficial
                      </label>

                      <button
                        type="button"
                        onClick={() => removeTierAt(index)}
                        disabled={tiers.length <= 1}
                        aria-label={`Remove ${tier.name || `tier ${index + 1}`}`}
                        className="shrink-0 text-xs text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        &#10005;
                      </button>
                    </div>
                  );
                })}
              </div>

              {tierSlugClash.size > 0 && (
                <p role="alert" className="mt-3 text-xs text-red-400">
                  Two of those names produce the same address. Change one.
                </p>
              )}

              {tiers.length > 1 && (
                <p className="mt-3 text-xs text-zinc-600">
                  Every tier starts from the rank ladder and cutoffs below. Tune
                  each one separately on the edit page after saving.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Platform
              </label>
              <select
                value={scenarios.length > 0 ? PLATFORM : platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={scenarios.length > 0}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500 disabled:opacity-60"
              >
                <option value={PLATFORM}>EasyAim</option>
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
                  onChange={(e) =>
                    setScenarioCount(Math.max(1, Number(e.target.value) || 1))
                  }
                  min="1"
                  step="1"
                  placeholder="1"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                />
                <p className="mt-2 text-xs text-zinc-600">
                  A benchmark with no EasyAim scenarios has nothing to sync,
                  so its score can only be read from the value above. Adding
                  scenarios is what makes it playable.
                </p>
              </div>
            )}

            {notice && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300"
              >
                {notice}
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
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
