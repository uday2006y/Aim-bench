"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { renameCutoffKey } from "@/lib/benchmarkScenarios";
import { MAX_TIERS, sanitizeLadder, type Tier } from "@/lib/benchmarkTiers";
import SiteHeader from "@/components/SiteHeader";
import {
  ActionBar,
  Banner,
  BTN_TINY,
  CategoryEditor,
  CutoffGrid,
  Field,
  FIELD,
  FIELD_SM,
  FormHeader,
  RankEditor,
  ScenarioCard,
  ScenarioFiling,
  ScenarioPicker,
  Section,
  StatePanel,
} from "@/components/BenchmarkFormKit";

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

  async function handleSave(e: React.FormEvent, stayOnPage = false) {
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

      // A benchmark has several tiers, each its own page. Redirecting after every
    // save threw the author out to the benchmark, and getting back to another
    // tier meant going through that page and clicking Edit again -- three
    // steps to change one cutoff. Staying put lets them move straight to the
    // next tier tab.
    if (stayOnPage) {
      setNotice(
        `Saved${activeTier ? ` the ${activeTier.name} tier` : ""}. ` +
          (tiers.length > 1 ? "Switch tiers to keep editing." : "")
      );
      router.refresh();
      return;
    }

    router.push(`/benchmarks/${id}/${activeTier?.slug ?? "primary"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <StatePanel title="Loading…" />;
  }

  // Previously the load-failure paths set notFound but nothing rendered it,
  // so a deleted benchmark or a non-owner saw a blank edit form that looked
  // like a brand new benchmark — and saving it would have overwritten
  // whatever was actually there.
  if (notFound || !isOwner) {
    return (
      <StatePanel
        title={notFound ? "Benchmark unavailable" : "Nothing to edit"}
        actions={
          <>
            <Link href="/benchmarks" className="btn btn-primary">
              All benchmarks
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Log in
            </Link>
          </>
        }
      >
        {loadError || "You can only edit benchmarks you created."}
      </StatePanel>
    );
  }

  const categoryColor = (name: string) =>
    categories.find((c) => c.name === name)?.color ?? "#7a7a7a";

  const destinationLabel =
    addTargetCategory +
    (addTargetSubCategory.trim() ? ` / ${addTargetSubCategory.trim()}` : "");

  return (
    <main className="min-h-screen text-white">
      <SiteHeader loggedIn />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href={`/benchmarks/${id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-white"
        >
          ← Back
        </Link>

        <FormHeader
          eyebrow="Edit benchmark"
          title={title.trim() || "Edit Benchmark"}
          subtitle="Title, description and categories apply to the whole benchmark. Ranks and scenarios belong to the tier you have selected."
        />

        <form onSubmit={handleSave} className="space-y-5">
          {/* 1. BASICS */}
          <Section
            step={1}
            title="Basics"
            scope="Whole benchmark"
            description="What the benchmark is called and how it is listed."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                  className={FIELD}
                />
              </Field>

              <Field label="Description" className="sm:col-span-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={`${FIELD} resize-none`}
                />
              </Field>

              <Field
                label="Platform"
                hint={
                  scenarios.length > 0
                    ? "Set to EasyAim because this benchmark uses EasyAim scenarios."
                    : undefined
                }
              >
                <select
                  value={scenarios.length > 0 ? "easyaim" : platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  disabled={scenarios.length > 0}
                  className={FIELD}
                >
                  <option value="easyaim">EasyAim</option>
                </select>
              </Field>

              <Field label="Difficulty">
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className={FIELD}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* 2. TIERS */}
          <Section
            step={2}
            title="Tiers"
            scope={`Editing ${activeTier?.name ?? "the only tier"}`}
            description="Each tier is its own page with its own rank ladder and score requirements. Pick the tier to edit; steps 4 and 5 change with it."
            action={
              tiers.length > 1 ? (
                <button
                  type="button"
                  onClick={removeTier}
                  disabled={tierBusy}
                  className="rounded-lg border border-red-900/60 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-950/30 disabled:opacity-50"
                >
                  Remove tier
                </button>
              ) : null
            }
          >
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-black/20 p-1">
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
                      "relative rounded-lg px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50",
                      "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:content-['']",
                      active
                        ? "bg-white/[0.08] text-white before:bg-accent"
                        : "text-zinc-400 before:bg-transparent hover:bg-white/[0.04] hover:text-white",
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
                    className={`${FIELD_SM} w-36`}
                  />
                  <button
                    type="button"
                    onClick={addTier}
                    disabled={tierBusy || !newTierName.trim()}
                    className={BTN_TINY}
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>
          </Section>

          {/* 3. CATEGORIES */}
          <Section
            step={3}
            title="Categories"
            scope="Whole benchmark"
            description="Group scenarios into categories and sub-categories. These become the coloured rails on the benchmark table."
          >
            <CategoryEditor
              categories={categories}
              onAdd={addCategory}
              onRemove={removeCategory}
              onName={updateCategoryName}
              onColor={updateCategoryColor}
              onAddSub={addSubCategory}
              onSubName={updateSubCategoryName}
              onRemoveSub={removeSubCategory}
            />
          </Section>

          {/* 4. RANKS */}
          <Section
            step={4}
            title="Rank ladder"
            scope={activeTier ? `${activeTier.name} tier` : "This tier"}
            description="The ranks a player climbs through, lowest to highest. The strip below is drawn with your bar style from Settings."
          >
            <RankEditor
              ranks={ranks}
              onAdd={addRank}
              onName={updateRankName}
              onColor={updateRankColor}
              onRemove={removeRank}
              note="Changing a rank name updates the scenario score inputs. Removing a rank removes its scores."
            />
          </Section>

          {/* 5. SCENARIOS */}
          <Section
            step={5}
            title="Scenarios"
            scope={activeTier ? `${activeTier.name} tier` : "This tier"}
            description="Search EasyAim, then set the score required for each rank on every scenario."
            action={
              <span className="chip">
                {scenarios.length} scenario{scenarios.length === 1 ? "" : "s"}
              </span>
            }
          >
            <div className="space-y-4">
              <ScenarioPicker
                categories={categories}
                targetCategory={addTargetCategory}
                onTargetCategory={(value) => {
                  setAddTargetCategory(value);
                  setAddTargetSubCategory("");
                }}
                targetSub={addTargetSubCategory}
                onTargetSub={setAddTargetSubCategory}
                targetSubs={addTargetSubs}
                destinationLabel={destinationLabel}
                query={searchQuery}
                onQuery={setSearchQuery}
                searching={searching && searchLongEnough}
                results={visibleSearchResults}
                onPick={addScenarioFromResult}
              />

              {scenarios.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-zinc-500">
                  This tier has no scenarios yet. Search above to add one.
                </div>
              ) : null}

              {scenarios.map((scenario, idx) => (
                <ScenarioCard
                  key={scenario.id}
                  accent={categoryColor(scenario.category)}
                  onRemove={() => removeScenario(idx)}
                  header={
                    <input
                      value={scenario.title}
                      onChange={(e) =>
                        setScenarios((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, title: e.target.value } : s
                          )
                        )
                      }
                      aria-label="Scenario title"
                      placeholder="Scenario title"
                      className={`${FIELD} font-semibold`}
                    />
                  }
                  meta={
                    <span className="font-mono text-[10px] text-zinc-600">
                      ID {scenario.id}
                    </span>
                  }
                >
                  <ScenarioFiling
                    categories={categories}
                    category={scenario.category}
                    subCategory={scenario.subCategory}
                    onCategory={(value) => updateScenarioCategory(idx, value)}
                    onSubCategory={(value) => updateScenarioSubCategory(idx, value)}
                    listId={`sub-options-${idx}`}
                  />

                  <CutoffGrid
                    ranks={ranks}
                    value={(rankName) => scenario.cutoffs[rankName]}
                    onChange={(rankName, value) => updateCutoff(idx, rankName, value)}
                  />
                </ScenarioCard>
              ))}
            </div>
          </Section>

          {notice && <Banner tone="warn">{notice} Save to make it permanent.</Banner>}

          {error && <Banner tone="error">{error}</Banner>}

          <ActionBar
            note={
              activeTier
                ? `Saving writes the benchmark and the ${activeTier.name} tier.`
                : undefined
            }
          >
            <button
              // type="button", not "submit": a submit button here would also
              // fire the form's own onSubmit, so one click would save twice
              // and then redirect anyway -- the exact thing this button
              // exists to avoid.
              type="button"
              disabled={saving || !activeTier}
              onClick={(e) => handleSave(e, true)}
              className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & keep editing"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </ActionBar>
        </form>
      </div>
    </main>
  );
}
