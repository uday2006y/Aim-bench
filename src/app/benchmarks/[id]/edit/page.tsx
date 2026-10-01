"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { renameCutoffKey } from "@/lib/benchmarkScenarios";
import { MAX_TIERS, sanitizeLadder, type Tier } from "@/lib/benchmarkTiers";
import SiteHeader from "@/components/SiteHeader";

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

/** A benchmark_scenarios row as GET /api/benchmarks/[id] returns it. */
interface EditScenarioRow {
  easyaim_scenario_id: number;
  title: string;
  cutoffs?: Record<string, number>;
  category?: string;
  sub_category?: string | null;
}

/** An EasyAim scenario search hit. */
interface SearchHit {
  id: number;
  title: string;
  author: string | null;
}

export default function EditBenchmarkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("easyaim");
  const [difficulty, setDifficulty] = useState("medium");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>(DEFAULT_CATEGORIES);
  // Records why the load failed so the page can explain itself instead of
  // rendering an empty form that looks like a fresh benchmark.
  const [loadError, setLoadError] = useState("");
  // Where the next scenario picked from EasyAim search will be filed.
  const [addTargetCategory, setAddTargetCategory] = useState("");
  const [addTargetSubCategory, setAddTargetSubCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
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
  /**
   * Confirms a destructive edit before it is saved.
   *
   * Removing a rank deletes every scenario requirement for it, straight away
   * and with no undo. The row simply vanishing was the only feedback, which
   * is indistinguishable from the button misfiring.
   */
  const [notice, setNotice] = useState("");
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Tiers. The ladder being edited and the tier selected to edit it are the
  // same thing here, so one state holds both rather than a ladder per tier
  // that would all have to be kept in sync.
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [newTierName, setNewTierName] = useState("");
  const [tierBusy, setTierBusy] = useState(false);

  // Search responses can arrive out of order — a slow request for "eas"
  // landing after a fast one for "easyaim" would replace the newer results
  // with the older ones. Only the most recent request is allowed to write.
  const searchRequest = useRef(0);

  const searchTerm = searchQuery.trim();
  const searchLongEnough = searchTerm.length >= 2;

  useEffect(() => {
    if (loadError || notFound) {
      document.title = "Benchmark not found — AIMBENCH";
    }
  }, [loadError, notFound]);

  useEffect(() => {
    // Every exit from this function has to clear `loading`. It used to have
    // no catch at all, so a dropped connection or an aborted request left
    // the page on "Loading..." for good with no way forward and no message.
    async function checkAndLoad() {
      try {
        // The tab the user arrived on wins over the tier we would default to,
        // so "Edit Benchmark" from a tier page opens that tier.
        const wanted = searchParams.get("tab");

        const res = await fetch(
          `/api/benchmarks/${id}${wanted ? `?tier=${encodeURIComponent(wanted)}` : ""}`
        );

        if (!res.ok) {
          setNotFound(true);
          setLoadError(
            res.status === 404
              ? "Benchmark not found. It may have been deleted."
              : `Could not load this benchmark (${res.status}).`
          );
          return;
        }

        const data = await res.json();
        const benchmarkData = data.benchmark;

        // The route answers whether the caller owns this benchmark rather
        // than handing back their account id, so the client learns exactly
        // what it needs and nothing more.
        if (!benchmarkData) {
          setNotFound(true);
          setLoadError("Benchmark not found. It may have been deleted.");
          return;
        }

        if (!data.isOwner) {
          setIsOwner(false);
          setNotFound(true);
          setLoadError(
            data.loggedIn
              ? "You can only edit benchmarks you created."
              : "You need to be logged in to edit a benchmark."
          );
          return;
        }

        setIsOwner(true);
        setLoadError("");
        setTitle(benchmarkData.title);
        setDescription(benchmarkData.description || "");
        setPlatform(benchmarkData.platform || "easyaim");
        setDifficulty(benchmarkData.difficulty || "medium");

        // Load the rank ladder from the tier being edited. Without this the
        // form kept its hardcoded 8-rank default on every page load, so
        // removing a rank and saving appeared to work (the detail page showed
        // the shortened ladder) but the next visit showed the deleted rank
        // again — and saving from that state re-added it.
        setTiers(Array.isArray(data.tiers) ? data.tiers : []);
        setActiveSlug(typeof data.tierSlug === "string" ? data.tierSlug : null);

        const activeTier = Array.isArray(data.tiers)
          ? data.tiers.find(
              (t: Tier) => t.slug === data.tierSlug
            ) as Tier | undefined
          : undefined;

        const ladderNames = activeTier?.rank_names ?? benchmarkData.rank_names;
        const ladderColors = activeTier?.rank_colors ?? benchmarkData.rank_colors;

        if (Array.isArray(ladderNames) && ladderNames.length > 0) {
          setRanks(
            ladderNames.map((name: string, index: number) => ({
              name,
              color: ladderColors?.[index] || "#ffffff",
            }))
          );
        }

        const loadedCategories =
          Array.isArray(benchmarkData.category_defs) &&
          benchmarkData.category_defs.length > 0
            ? benchmarkData.category_defs
            : DEFAULT_CATEGORIES;

        setCategories(loadedCategories);
        setAddTargetCategory(loadedCategories[0]?.name ?? "Other");

        setScenarios(
          ((data.scenarios ?? []) as EditScenarioRow[]).map((s) => ({
            id: Number(s.easyaim_scenario_id),
            title: s.title,
            cutoffs: s.cutoffs || {},
            category: s.category || "Other",
            subCategory: s.sub_category || "",
          }))
        );
      } catch {
        setNotFound(true);
        setLoadError("Could not reach the server. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }

    checkAndLoad();
  }, [id, searchParams]);

  useEffect(() => {
    // Invalidate anything in flight before doing anything else, so a response
    // for a longer query cannot land after the visitor has deleted back below
    // the minimum length.
    const ticket = ++searchRequest.current;

    if (!searchLongEnough) return;

    const timeout = setTimeout(async () => {
      setSearching(true);

      try {
        const res = await fetch(
          `/api/easyaim/scenarios?q=${encodeURIComponent(searchTerm)}`
        );
        const data = await res.json();

        if (ticket !== searchRequest.current) return;

        setSearchResults(res.ok ? data.scenarios || [] : []);
      } catch {
        if (ticket !== searchRequest.current) return;
        setSearchResults([]);
      } finally {
        if (ticket === searchRequest.current) setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm, searchLongEnough]);

  // Derived rather than cleared from state: emptying the box hides the list
  // without an effect writing to it, and cannot leave a stale list behind.
  const visibleSearchResults = searchLongEnough ? searchResults : [];

  function addScenarioFromResult(scenario: SearchHit) {
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
    const oldName = ranks[index].name;
    const newName = value.trim() || `Rank ${index + 1}`;

    if (oldName === newName) return;

    setNotice("");
    setRanks((prev) => prev.map((r, i) => i === index ? { ...r, name: newName } : r));

    // Cutoffs are keyed by rank name, so the rename has to take them with
    // it. This used to only rename the rank, which left every scenario's
    // requirement filed under a name no rank matched — the tier became
    // unreachable and every score below it wrong, silently, on save.
    setScenarios((prev) =>
      prev.map((s) => ({ ...s, cutoffs: renameCutoffKey(s.cutoffs, oldName, newName) }))
    );
  }

  function addRank() {
    setNotice("");
    setRanks((prev) => [...prev, { name: `Rank ${prev.length + 1}`, color: "#ffffff" }]);
  }

  /**
   * Deletes a rank and every scenario requirement filed under it.
   *
   * The requirement count is taken from the scenarios as they are now, before
   * the state update lands, so the message reports what was on screen when the
   * button was pressed. Saying so matters because there is no undo and no
   * confirmation step: without a message, a vanished row reads as a button
   * that did nothing.
   */
  function removeRank(index: number) {
    const rankName = ranks[index].name;
    const dropped = scenarios.filter((s) => s.cutoffs?.[rankName] !== undefined).length;

    setRanks((prev) => prev.filter((_, i) => i !== index));
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

  function updateRankColor(index: number, color: string) {
    setNotice("");
    setRanks((prev) => prev.map((r, i) => i === index ? { ...r, color } : r));
  }

  // ------------------------------------------------------------------ tiers

  const activeTier = tiers.find((tier) => tier.slug === activeSlug) ?? null;

  /**
   * Switching tiers swaps the ladder and the cutoffs in one go, so what is on
   * screen always describes exactly one tier. Both come from the same request,
   * which is why this is a navigation rather than a local toggle.
   */
  async function selectTier(slug: string) {
    setTierBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/benchmarks/${id}?tier=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error("Could not load that tier");

      const data = await res.json();
      const tier = (data.tiers ?? []).find((t: Tier) => t.slug === slug) as
        | Tier
        | undefined;

      setActiveSlug(slug);

      setRanks(
        (tier?.rank_names ?? []).map((name: string, index: number) => ({
          name,
          color: tier?.rank_colors?.[index] || "#ffffff",
        }))
      );

      setScenarios(
        ((data.scenarios ?? []) as EditScenarioRow[]).map((s) => ({
          id: Number(s.easyaim_scenario_id),
          title: s.title,
          cutoffs: s.cutoffs || {},
          category: s.category || "Other",
          subCategory: s.sub_category || "",
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that tier");
    } finally {
      setTierBusy(false);
    }
  }

  async function addTier() {
    const name = newTierName.trim();

    if (!name) return;
    if (tiers.length >= MAX_TIERS) {
      setError(`A benchmark can have at most ${MAX_TIERS} tiers`);
      return;
    }

    setTierBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/benchmarks/${id}/tiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not add the tier");
        return;
      }

      setNewTierName("");
      await selectTier(data.slug);
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setTierBusy(false);
    }
  }

  async function removeTier() {
    if (!activeTier) return;
    if (tiers.length <= 1) return;

    const confirmed = window.confirm(
      `Remove the "${activeTier.name}" tier?\n\n` +
        "Its rank ladder and every score requirement in it are deleted. " +
        "The scenarios themselves are not affected."
    );

    if (!confirmed) return;

    setTierBusy(true);
    setError("");

    try {
      const res = await fetch(
        `/api/benchmarks/${id}/tiers?tierId=${encodeURIComponent(activeTier.id)}`,
        { method: "DELETE" }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not remove the tier");
        return;
      }

      // Land on whatever is now first rather than on a tier that is gone.
      const remaining = tiers.filter((tier) => tier.id !== activeTier.id);
      setTiers(remaining);
      await selectTier(remaining[0].slug);
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setTierBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        title: title.trim(),
        description,
        difficulty,
        platform,
        category_defs: categories,
        // Scenarios are NOT sent here. They belong to a tier and this route
        // does not know which tier is meant; the tier endpoint owns them.
        // Sending them anyway used to rewrite the benchmark-wide list.
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

      // The ladder and the cutoffs now belong to the tier, not the benchmark,
      // so they are a second write. Done after the benchmark so a tier failure
      // cannot leave a benchmark whose scenarios have moved but whose cutoffs
      // have not.
      if (activeTier) {
        const ladder = sanitizeLadder(
          ranks.map((r) => r.name),
          ranks.map((r) => r.color)
        );

        // The LADDER goes first, deliberately.
        //
        // These two writes used to run scenarios-then-ladder, so any failure in
        // the first threw before the second ran. That is how deleting half the
        // ranks appeared to do nothing: the ladder was never sent, and on reload
        // every rank was back. The user's most deliberate edit silently vanished
        // because an unrelated write failed first.
        //
        // Ladder first means a scenario failure can no longer discard it, and a
        // scenario failure still surfaces as an error rather than a silent loss.
        const patchRes = await fetch(`/api/benchmarks/${id}/tiers`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tierId: activeTier.id,
            rankNames: ladder.rank_names,
            rankColors: ladder.rank_colors,
          }),
        });

        if (!patchRes.ok) {
          const data = await patchRes.json();
          throw new Error(data.error || "Benchmark saved, but its ladder was not");
        }

        const tierRes = await fetch(`/api/benchmarks/${id}/tiers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tierId: activeTier.id,
            // The tier's whole scenario list: which scenarios it has, the
            // category each is filed under, and the score required for each
            // rank. One write, because they are one thing — a tier.
            scenarios: scenarios.map((s) => ({
              id: s.id,
              title: s.title,
              category: s.category || "Other",
              subCategory: s.subCategory || "",
              cutoffs: Object.fromEntries(
                Object.entries(s.cutoffs).filter(
                  ([, v]) => v !== undefined && v !== ""
                )
              ),
            })),
          }),
        });

        if (!tierRes.ok) {
          const data = await tierRes.json();
          throw new Error(
            data.error || "Benchmark saved, but this tier's scenarios were not"
          );
        }
      }

      router.push(`/benchmarks/${id}/${activeTier?.slug ?? "primary"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen text-white flex items-center justify-center"><p>Loading...</p></main>;
  }

  // Previously the load-failure paths set notFound but nothing rendered it,
  // so a deleted benchmark or a non-owner saw a blank edit form that looked
  // like a brand new benchmark — and saving it would have overwritten
  // whatever was actually there.
  if (notFound || !isOwner) {
    return (
      <main className="min-h-screen text-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {notFound ? "Benchmark unavailable" : "Nothing to edit"}
          </h1>
          <p className="mt-3 max-w-md text-sm text-zinc-500">
            {loadError || "You can only edit benchmarks you created."}
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/benchmarks"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              All benchmarks
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Log in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white">
      <SiteHeader loggedIn width="max-w-3xl" />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href={`/benchmarks/${id}`} className="text-sm text-zinc-500 hover:text-white mb-6 inline-block">← Back</Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit Benchmark</h1>

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          {/* TIERS */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Editing the{" "}
                  <span className="text-accent">{activeTier?.name ?? "only tier"}</span>{" "}
                  tier
                </h2>
                <p className="mt-0.5 text-xs text-zinc-600">
                  The rank ladder and the score requirements below belong to
                  this tier only. Each tier is its own page on the benchmark.
                </p>
              </div>

              {tiers.length > 1 ? (
                <button
                  type="button"
                  onClick={removeTier}
                  disabled={tierBusy}
                  className="rounded-lg border border-red-900/60 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-950/30 disabled:opacity-50"
                >
                  Remove tier
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
              {tiers.map((tier) => {
                const active = tier.slug === activeSlug;

                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => selectTier(tier.slug)}
                    disabled={tierBusy}
                    aria-current={active ? "true" : undefined}
                    className={[
                      "relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                      "before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:content-['']",
                      active
                        ? "bg-white/[0.07] text-white before:bg-accent"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-white before:bg-transparent",
                    ].join(" ")}
                  >
                    {tier.is_official ? tier.name : `${tier.name} (Unofficial)`}
                  </button>
                );
              })}

              {tiers.length < MAX_TIERS ? (
                <div className="ml-auto flex items-center gap-1.5 pl-2">
                  <input
                    type="text"
                    value={newTierName}
                    onChange={(e) => setNewTierName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTier();
                      }
                    }}
                    placeholder="New tier name"
                    maxLength={40}
                    aria-label="New tier name"
                    className="w-32 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={addTier}
                    disabled={tierBusy || !newTierName.trim()}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-zinc-500 outline-none" required />
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

          {/* CATEGORIES */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="text-xl font-bold tracking-tight mb-1">Categories</h2>
            <p className="mb-4 text-xs text-zinc-600">
              Group scenarios into categories and sub-categories. These
              become the coloured rails on the benchmark table.
            </p>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
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
            {searching && searchLongEnough && <p className="text-xs text-zinc-500 mt-2">Searching...</p>}
            {visibleSearchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900">
                {visibleSearchResults.map((r) => (
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

          {notice && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300"
              >
                {notice} Save to make it permanent.
              </div>
            )}

            {error && <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">{error}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
