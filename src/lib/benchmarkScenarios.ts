export interface ScenarioInput {
  easyaimScenarioId: number;
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
 * Ids are de-duplicated and cutoffs are coerced to finite, non-negative
 * numbers so `benchmark_scenarios.cutoffs` is always numeric jsonb.
 */
export function sanitizeScenarios(input: unknown): ScenarioInput[] {
  if (!Array.isArray(input)) return [];

  const scenarios: ScenarioInput[] = [];
  const seen = new Set<number>();

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
    const rawId = record.id ?? record.easyaim_scenario_id;
    const id = Number(rawId);

    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);

    const cutoffs: Record<string, number> = {};

    if (record.cutoffs && typeof record.cutoffs === "object") {
      for (const [rank, value] of Object.entries(
        record.cutoffs as Record<string, unknown>
      )) {
        // Number() also collapses the "" and null that number inputs and
        // cleared fields produce, which we want to drop rather than store.
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric >= 0) {
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
      easyaimScenarioId: id,
      title,
      category,
      subCategory,
      cutoffs,
    });
  }

  return scenarios.slice(0, MAX_SCENARIOS_PER_BENCHMARK);
}

/**
 * Normalises the `category_defs` array stored on a benchmark: a list of
 * `{ name, color, subCategories }` that drives the category tags rendered
 * on the benchmark detail table. Returns undefined when the caller didn't
 * send the key at all, so the route can tell "leave it alone" apart from
 * "set it to empty".
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
