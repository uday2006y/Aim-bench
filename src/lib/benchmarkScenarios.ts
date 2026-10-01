export interface ScenarioInput {
  /**
   * Always a string.
   *
   * The column is `text`, because EasyAim ids are alphanumeric
   * (692fc9afe296376b3bdceed2 and so on) and a `bigint` column cannot store
   * one. PostgREST does not cast a JSON number into a text column — it
   * answers `column "easyaim_scenario_id" is of type text but expression is of
   * type integer` — so a number here is not merely wrong, it is a 500 on every
   * write. Normalising at this boundary means every caller below can forget
   * about it.
   */
  easyaimScenarioId: string;
  title: string;
  category: string;
  subCategory: string;
  cutoffs: Record<string, number>;
}

export interface CategoryDef {
  name: string;
  color: string;
  subCategories: string[];
}

export const DEFAULT_CATEGORY = "Other";
export const MAX_SCENARIOS_PER_BENCHMARK = 50;
const MAX_TITLE_LENGTH = 200;
const MAX_NAME_LENGTH = 100;

/**
 * Normalises the `scenarios` array that both the create (POST) and edit
 * (PUT) routes accept into rows that are safe to write.
 *
 * Everything here is deliberately strict, because these rows get deleted
 * and re-inserted wholesale on every edit: anything that slips through
 * unvalidated here (a non-numeric id, a duplicate, a cutoff that isn't a
 * number) either violates a constraint and takes the whole benchmark's
 * scenario list down with it, or lands in the DB as a string that quietly
 * breaks rank comparison during sync.
 *
 * Ids are de-duplicated and cutoffs are coerced to finite, positive numbers so
 * `benchmark_scenarios.cutoffs` is always numeric jsonb.
 *
 * "Positive" rather than "non-negative" on purpose: a cutoff of zero and no
 * cutoff at all are the same thing everywhere else in the app —
 * `computeTierFills` and the detail page's unreachable-rank warning both test
 * `> 0`. Storing 0 here would make `computeAggregates` treat an unfilled field
 * as a requirement of zero, which every scenario passes, so an untouched rank
 * would become reachable while the page said it was not.
 */
export function sanitizeScenarios(input: unknown): ScenarioInput[] {
  if (!Array.isArray(input)) return [];

  const scenarios: ScenarioInput[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const record = item as {
      id?: unknown;
      easyaim_scenario_id?: unknown;
      title?: unknown;
      cutoffs?: unknown;
      category?: unknown;
      subCategory?: unknown;
      sub_category?: unknown;
    };

    // Accept either shape so the same helper serves the create form
    // (`id`) and a future server-side caller (`easyaim_scenario_id`).
    //
    // Kept as a string, never coerced with Number(). Two reasons, and the
    // second one used to be a silent data-loss bug:
    //
    //   1. The column is `text`, and PostgREST will not cast a JSON number
    //      into a text column — it answers "column easyaim_scenario_id is of
    //      type text but expression is of type integer". Writing a number here
    //      was a 500 on every save.
    //   2. EasyAim ids are alphanumeric (692fc9afe296376b3bdceed2 and so on).
    //      Number() turned those into NaN, and NaN failed the isFinite guard,
    //      so the scenario was dropped from the benchmark entirely — with no
    //      error anywhere, just a scenario that quietly was not there.
    const rawId = record.id ?? record.easyaim_scenario_id;

    if (typeof rawId !== "string" && typeof rawId !== "number") continue;

    const id = String(rawId).trim();

    // Bounded and a known shape, so this is not a hole for writing an
    // arbitrary string into a text column that is also used to look up runs.
    //
    // The three rules below are not decoration. A bare `[A-Za-z0-9_-]+` also
    // accepts "-3" and "not-a-number", because both are made of allowed
    // characters — which is how a hand-typed value ends up as a scenario that
    // quietly matches no EasyAim run, forever, with nothing reporting it.
    if (id.length > 64) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) continue; // no leading sign
    if (!/\d/.test(id)) continue; // an id with no digit in it is not an id
    if (/^0+$/.test(id)) continue; // as is zero

    // "1" and " 1" are the same scenario; without this they would both
    // survive and collide on the unique (benchmark_id, easyaim_scenario_id).
    const key = /^\d+$/.test(id) ? String(Number(id)) : id;

    if (seen.has(key)) continue;
    seen.add(key);

    const cutoffs: Record<string, number> = {};

    if (record.cutoffs && typeof record.cutoffs === "object") {
      for (const [rank, value] of Object.entries(
        record.cutoffs as Record<string, unknown>
      )) {
        // Empties are dropped *before* coercion, not after.
        //
        // The old code leaned on Number() to collapse the "" and null that
        // cleared number inputs produce — but Number("") and Number(null) are
        // both 0, and 0 passes both guards, so every cleared field was stored
        // as a cutoff of zero.
        //
        // That is not a harmless rounding. aggregates.ts decides which ranks
        // are scorable with `typeof cutoff === "number"`, so a zero cutoff
        // made an unfilled rank reachable, and `pb >= 0` made it pass on
        // every scenario. Meanwhile computeTierFills and the detail page's
        // "this rank can never be reached" warning both test `> 0` and
        // ignored it. The engine granted a rank the interface was telling the
        // author was impossible.
        if (value === null || value === undefined || value === "") continue;
        if (typeof value === "boolean") continue;

        const numeric = Number(value);

        if (Number.isFinite(numeric) && numeric > 0) {
          cutoffs[rank] = numeric;
        }
      }
    }

    const title =
      typeof record.title === "string" && record.title.trim()
        ? record.title.trim().slice(0, MAX_TITLE_LENGTH)
        : `EasyAim Scenario ${id}`;

    const category =
      typeof record.category === "string" && record.category.trim()
        ? record.category.trim().slice(0, MAX_NAME_LENGTH)
        : DEFAULT_CATEGORY;

    const rawSubCategory = record.subCategory ?? record.sub_category;
    const subCategory =
      typeof rawSubCategory === "string"
        ? rawSubCategory.trim().slice(0, MAX_NAME_LENGTH)
        : "";

    scenarios.push({
      easyaimScenarioId: key,
      title,
      category,
      subCategory,
      cutoffs,
    });
  }

  return scenarios.slice(0, MAX_SCENARIOS_PER_BENCHMARK);
}

/**
 * Moves one rank's cutoffs onto a new name, in place.
 *
 * Cutoffs are keyed by rank name, so renaming a rank has to carry every
 * scenario's requirement across with it. Both the create form and the edit
 * form rename ranks, and both used to do this differently: create remapped
 * the keys, edit only renamed the rank. On the edit page that left every
 * cutoff filed under a name no rank matched any more, so the whole tier
 * silently became unreachable on save — with a line of on-screen text
 * promising the opposite.
 *
 * Lives here, and is tested, rather than inline in either page: it is pure,
 * it is the rule that decides whether a tier keeps its requirements, and
 * two hand-written copies of it is how they drifted apart in the first
 * place.
 *
 * Renaming into a name that already exists overwrites that rank's cutoffs.
 * That is deliberate — the author asked for one rank to become the other,
 * and there is no sensible way to keep both sets.
 */
export function renameCutoffKey<T>(
  cutoffs: Record<string, T>,
  oldName: string,
  newName: string
): Record<string, T> {
  if (oldName === newName || !(oldName in cutoffs)) return cutoffs;

  const next = { ...cutoffs };
  next[newName] = next[oldName];
  delete next[oldName];

  return next;
}

/**
 * Folds any sub-category a scenario is tagged with into its parent
 * category's `subCategories` list.
 *
 * The edit form lets you type a sub-category directly (it's a datalist
 * input, not a fixed <select>), so a sub-category can reach the server
 * that isn't in `category_defs` yet. Without this the value would still
 * save onto the scenario, but the benchmark table's sub-category rail
 * would render blank because the rail reads its labels from
 * `category_defs`. Keeping the two in sync means the rail always has a
 * colour and the editor always offers it as a suggestion next time.
 *
 * Mutates and returns `defs` for convenience at the call site.
 */
export function sanitizeCategoryDefs(input: unknown): CategoryDef[] | undefined {
  if (!Array.isArray(input)) return undefined;

  const defs: CategoryDef[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const record = item as {
      name?: unknown;
      color?: unknown;
      subCategories?: unknown;
    };

    const name =
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim().slice(0, MAX_NAME_LENGTH)
        : "";

    if (!name || seen.has(name)) continue;
    seen.add(name);

    const color =
      typeof record.color === "string" && /^#[0-9a-f]{3,8}$/i.test(record.color.trim())
        ? record.color.trim()
        : "#7a7a7a";

    const subCategories: string[] = [];
    if (Array.isArray(record.subCategories)) {
      const subSeen = new Set<string>();
      for (const sub of record.subCategories) {
        if (typeof sub !== "string") continue;
        const trimmed = sub.trim().slice(0, MAX_NAME_LENGTH);
        if (!trimmed || subSeen.has(trimmed)) continue;
        subSeen.add(trimmed);
        subCategories.push(trimmed);
      }
    }

    defs.push({ name, color, subCategories });
  }

  return defs;
}

/**
 * Ensures every sub-category referenced by `scenarios` also exists in the
 * matching category's `subCategories`, so the detail table's sub-category
 * rail has something to render. Categories that no scenario uses are left
 * untouched, and existing sub-categories keep their order.
 */
export function syncSubCategoriesIntoDefs(
  defs: CategoryDef[],
  scenarios: ScenarioInput[]
): CategoryDef[] {
  if (defs.length === 0 || scenarios.length === 0) return defs;

  const byName = new Map(defs.map((def) => [def.name, def]));

  for (const scenario of scenarios) {
    if (!scenario.subCategory) continue;

    const def = byName.get(scenario.category);
    if (!def) continue;

    if (!def.subCategories.includes(scenario.subCategory)) {
      def.subCategories.push(scenario.subCategory);
    }
  }

  return defs;
}
