"use client";

import type { ReactNode } from "react";
import { useBarStyle } from "@/lib/useBarStyle";
import RankBar from "@/components/RankBar";

/**
 * Presentation-only building blocks shared by /create-benchmark and
 * /benchmarks/[id]/edit, so the two forms are the same form.
 *
 * Nothing in here owns state, talks to the server or knows what a benchmark
 * is. Every handler is passed in by the page, which is where the logic
 * lives. Colours come from the theme tokens (card, field, btn, border-line,
 * text-accent), so the Theme studio restyles these too.
 */

/* ------------------------------------------------------------------ */
/* Class constants                                                     */
/* ------------------------------------------------------------------ */

/** Full-size text input / select / textarea. */
export const FIELD = "field text-sm";

/** Compact input used inside cards (cutoffs, sub-categories, selects). */
export const FIELD_SM = "field px-2.5 py-1.5 text-xs";

/** Small outlined button ("+ Add rank"). */
export const BTN_TINY =
  "inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

/** Small destructive text button. */
export const BTN_REMOVE =
  "rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500";

/* ------------------------------------------------------------------ */
/* Page frame                                                          */
/* ------------------------------------------------------------------ */

export function FormHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

/** A numbered card. `scope` marks what the section applies to. */
export function Section({
  step,
  title,
  description,
  scope,
  action,
  children,
}: {
  step: number;
  title: string;
  description?: ReactNode;
  /** Small chip next to the title, e.g. "This tier" or "Whole benchmark". */
  scope?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-[11px] font-bold text-accent"
          >
            {step}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">{title}</h2>
              {scope ? <span className="chip px-2 py-0 text-[10px]">{scope}</span> : null}
            </div>
            {description ? (
              <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-zinc-400">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-[11px] leading-4 text-zinc-600">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "info" | "warn" | "error";
  children: ReactNode;
}) {
  const styles = {
    info: "border-line bg-white/[0.03] text-zinc-300",
    warn: "border-amber-900/50 bg-amber-950/20 text-amber-300",
    error: "border-red-900/50 bg-red-950/30 text-red-400",
  }[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? undefined : "polite"}
      className={`rounded-xl border px-4 py-3 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}

/** Sticky save bar. Stays in reach however long the form gets. */
export function ActionBar({
  note,
  children,
}: {
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card sticky bottom-4 z-20 mt-2 flex flex-wrap items-center justify-between gap-3 p-3 backdrop-blur">
      <div className="min-w-0 px-2 text-xs text-zinc-500">{note}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Full-width message used for loading and "can't edit this" states. */
export function StatePanel({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-28 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {children ? (
          <div className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
            {children}
          </div>
        ) : null}
        {actions ? <div className="mt-8 flex gap-3">{actions}</div> : null}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Colour + ranks                                                      */
/* ------------------------------------------------------------------ */

/** A round swatch that opens the native colour picker. */
export function ColorSwatch({
  value,
  onChange,
  label,
  small = false,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  small?: boolean;
}) {
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full border border-white/20 ${
        small ? "h-6 w-6" : "h-9 w-9"
      }`}
      style={{ backgroundColor: value }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        title={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}

interface RankLike {
  name: string;
  color: string;
}

/**
 * The ladder drawn with the visitor's own bar style, so what they pick in
 * Settings is what they see while they build the ranks.
 */
export function LadderPreview({ ranks }: { ranks: RankLike[] }) {
  const [barStyle] = useBarStyle();

  if (ranks.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${ranks.length}, minmax(4.5rem, 1fr))`,
        }}
        aria-label="Rank ladder preview"
      >
        {ranks.map((rank, index) => (
          <div key={`preview-${index}`} className="min-w-0">
            <RankBar
              style={barStyle}
              label={String(index + 1)}
              percent={100}
              color={rank.color}
              cleared
            />
            <p
              className="mt-1.5 truncate text-center text-[10px] font-bold uppercase tracking-wider"
              style={{ color: rank.color }}
            >
              {rank.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RankEditor({
  ranks,
  onAdd,
  onName,
  onColor,
  onRemove,
  note,
}: {
  ranks: RankLike[];
  onAdd: () => void;
  onName: (index: number, value: string) => void;
  onColor: (index: number, color: string) => void;
  onRemove: (index: number) => void;
  note?: ReactNode;
}) {
  return (
    <div>
      <LadderPreview ranks={ranks} />

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {ranks.map((rank, index) => (
          <div
            key={`rank-${index}`}
            className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] p-2"
          >
            <ColorSwatch
              value={rank.color}
              onChange={(color) => onColor(index, color)}
              label={`${rank.name} colour`}
            />
            <input
              type="text"
              value={rank.name}
              onChange={(e) => onName(index, e.target.value)}
              aria-label={`Rank ${index + 1} name`}
              placeholder="Rank name"
              className={`${FIELD_SM} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={ranks.length <= 1}
              aria-label={`Remove ${rank.name}`}
              className={BTN_REMOVE}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-[11px] leading-4 text-zinc-600">{note}</p>
        <button type="button" onClick={onAdd} className={BTN_TINY}>
          + Add rank
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

interface CategoryLike {
  name: string;
  color: string;
  subCategories: string[];
}

export function CategoryEditor({
  categories,
  onAdd,
  onRemove,
  onName,
  onColor,
  onAddSub,
  onSubName,
  onRemoveSub,
}: {
  categories: CategoryLike[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onName: (index: number, value: string) => void;
  onColor: (index: number, color: string) => void;
  onAddSub: (categoryIndex: number) => void;
  onSubName: (categoryIndex: number, subIndex: number, value: string) => void;
  onRemoveSub: (categoryIndex: number, subIndex: number) => void;
}) {
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        {categories.map((category, catIndex) => (
          <div
            key={catIndex}
            className="overflow-hidden rounded-xl border border-line bg-white/[0.02]"
          >
            <div className="h-1" style={{ backgroundColor: category.color }} />

            <div className="p-3">
              <div className="flex items-center gap-2.5">
                <ColorSwatch
                  value={category.color}
                  onChange={(color) => onColor(catIndex, color)}
                  label={`${category.name} colour`}
                />
                <input
                  type="text"
                  value={category.name}
                  onChange={(e) => onName(catIndex, e.target.value)}
                  aria-label={`Category ${catIndex + 1} name`}
                  className={`${FIELD_SM} min-w-0 flex-1 font-semibold`}
                />
                <button
                  type="button"
                  onClick={() => onRemove(catIndex)}
                  disabled={categories.length <= 1}
                  aria-label={`Remove ${category.name}`}
                  className={BTN_REMOVE}
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {category.subCategories.map((sub, subIndex) => (
                  <span
                    key={subIndex}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-white/[0.03] py-0.5 pl-2.5 pr-1"
                  >
                    <input
                      type="text"
                      value={sub}
                      onChange={(e) => onSubName(catIndex, subIndex, e.target.value)}
                      aria-label={`Sub-category ${subIndex + 1} in ${category.name}`}
                      size={Math.max(6, sub.length)}
                      className="min-w-0 bg-transparent text-xs text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveSub(catIndex, subIndex)}
                      aria-label={`Remove sub-category ${sub}`}
                      className="rounded-full px-1.5 text-[10px] text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={() => onAddSub(catIndex)}
                  className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-white/30 hover:text-white"
                >
                  + Sub-category
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={onAdd} className={`${BTN_TINY} mt-3`}>
        + Add category
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

interface SearchResultLike {
  id: number;
  title: string;
  author: string | null;
}

/**
 * "Add scenarios to ..." + the EasyAim search box and its results.
 *
 * `extraDestination` lets the create form put its tier picker in the same
 * panel; the edit form edits one tier at a time and leaves it out.
 */
export function ScenarioPicker({
  categories,
  targetCategory,
  onTargetCategory,
  targetSub,
  onTargetSub,
  targetSubs,
  destinationLabel,
  extraDestination,
  query,
  onQuery,
  searching,
  results,
  onPick,
  atLimit = false,
  limitMessage,
}: {
  categories: CategoryLike[];
  targetCategory: string;
  onTargetCategory: (value: string) => void;
  targetSub: string;
  onTargetSub: (value: string) => void;
  targetSubs: string[];
  destinationLabel: string;
  extraDestination?: ReactNode;
  query: string;
  onQuery: (value: string) => void;
  /** Already combined with "query is long enough". */
  searching: boolean;
  results: SearchResultLike[];
  onPick: (result: SearchResultLike) => void;
  atLimit?: boolean;
  limitMessage?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {extraDestination}

        <Field label="Add scenarios to category">
          <select
            value={targetCategory}
            onChange={(e) => onTargetCategory(e.target.value)}
            className={FIELD_SM}
          >
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={`Sub-category${targetSubs.length > 0 ? ` (${targetSubs.length})` : ""}`}
        >
          <input
            list="add-sub-options"
            value={targetSub}
            onChange={(e) => onTargetSub(e.target.value)}
            placeholder="None"
            className={FIELD_SM}
          />
          <datalist id="add-sub-options">
            {targetSubs.map((sc) => (
              <option key={sc} value={sc} />
            ))}
          </datalist>
        </Field>
      </div>

      <p className="mt-3 text-[11px] text-zinc-600">
        New scenarios go to{" "}
        <span className="font-medium text-zinc-400">{destinationLabel}</span>.
        You can change it per scenario below.
      </p>

      <div className="relative mt-4">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
        >
          ⌕
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search EasyAim scenarios..."
          className={`${FIELD} pl-9`}
        />
      </div>

      {searching ? <p className="mt-2 text-xs text-zinc-500">Searching...</p> : null}

      {atLimit && limitMessage ? (
        <p className="mt-2 text-xs text-amber-300/90">{limitMessage}</p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-line bg-app/60">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => onPick(result)}
              disabled={atLimit}
              className="flex w-full items-center justify-between gap-4 border-b border-line px-4 py-2.5 text-left text-sm transition last:border-0 hover:bg-white/[0.05] disabled:opacity-40"
            >
              <span className="truncate">{result.title}</span>
              <span className="shrink-0 text-[11px] text-zinc-500">
                {result.author ? `by ${result.author} · ` : ""}
                <span className="text-accent">+ Add</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One scenario. `header` is the title (static text or an input). */
export function ScenarioCard({
  accent,
  header,
  meta,
  onRemove,
  children,
}: {
  /** Category colour, drawn as the card's left rail. */
  accent: string;
  header: ReactNode;
  meta?: ReactNode;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-line bg-white/[0.02]">
      <div className="w-1 shrink-0" style={{ backgroundColor: accent }} />

      <div className="min-w-0 flex-1 space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {header}
            {meta ? <div className="mt-1.5 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
          <button type="button" onClick={onRemove} className={BTN_REMOVE}>
            Remove
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

/** Category select + sub-category input for one scenario. */
export function ScenarioFiling({
  categories,
  category,
  subCategory,
  onCategory,
  onSubCategory,
  listId,
}: {
  categories: CategoryLike[];
  category: string;
  subCategory: string;
  onCategory: (value: string) => void;
  onSubCategory: (value: string) => void;
  listId: string;
}) {
  const subs = categories.find((c) => c.name === category)?.subCategories ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Category">
        <select
          value={category}
          onChange={(e) => onCategory(e.target.value)}
          className={FIELD_SM}
        >
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={`Sub-category${subs.length > 0 ? ` (${subs.length})` : ""}`}>
        {/* A text input with a datalist rather than a <select>: it suggests
            the sub-categories already defined for the category but still
            accepts a typed value. */}
        <input
          list={listId}
          value={subCategory}
          onChange={(e) => onSubCategory(e.target.value)}
          placeholder="None"
          className={FIELD_SM}
        />
        <datalist id={listId}>
          {subs.map((sc) => (
            <option key={sc} value={sc} />
          ))}
        </datalist>
      </Field>
    </div>
  );
}

/** The score required for each rank, one cell per rank, coloured by rank. */
export function CutoffGrid({
  ranks,
  value,
  onChange,
  step,
}: {
  ranks: RankLike[];
  value: (rankName: string) => string | number | undefined;
  onChange: (rankName: string, value: string) => void;
  step?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        Score required
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
        {ranks.map((rank, index) => (
          <label key={`cutoff-${index}`} className="block">
            <span className="mb-1 flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: rank.color }}
              />
              <span className="truncate text-[11px] font-medium text-zinc-400">
                {rank.name}
              </span>
            </span>
            <input
              type="number"
              min="0"
              step={step}
              value={value(rank.name) ?? ""}
              onChange={(e) => onChange(rank.name, e.target.value)}
              placeholder="—"
              className={`${FIELD_SM} font-mono`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
