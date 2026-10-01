# AIMBENCH — Session Handoff

Read this first in a new session. **Section 0 is unfinished work — start there.**

Written 1 Oct 2026, at commit `6bed3c2`.

---

## 0. Where this stands

The last commit (`6bed3c2`, "scenarios, categories and cutoffs belong to a tier")
is **code-complete and verified, but not deployed and not run against the
database.** tsc clean, 83 tests pass, lint clean, build passes.

### Do this first, in this order

**1. Run the migration.** `supabase-final.sql`, the tier section at the bottom.
It has not been run against the live database in its current form. It:

- creates `benchmark_tiers`
- adds `benchmark_scenarios.tier_id`
- **drops** `benchmark_tier_cutoffs` — it existed, the code no longer uses it
- hands every existing scenario to its benchmark's `primary` tier
- moves the unique constraint from `(benchmark_id, easyaim_scenario_id)` to
  `(tier_id, easyaim_scenario_id)`

All idempotent. Re-runnable. Run `supabase-verify.sql` afterwards.

**2. Push, then manually test this specific path**, because no automated test
can reach it:

- Create a benchmark with 2 tiers, put a different scenario in each
- Open tier A, confirm it shows *only* tier A's scenarios
- Switch to tier B, confirm the columns and rows change
- Edit tier B: rename a rank, change a cutoff, add a scenario, save, reload
- Check the tier still exists and the switcher still lists both

**3. Known gaps, in the order I'd do them.** These are real and unfinished:

| Gap | Where | Why it matters |
|---|---|---|
| **Per-tier ranks on cards/leaderboard** | `api/benchmarks/route.ts`, `leaderboard.ts`, `easyaimSync.ts` | A card and a leaderboard row still describe the *first* tier. Correct and deliberate, but a player on Elite sees a Novice number. Needs `tier_id` on `benchmark_scores` and a tier argument on the read paths. |
| **Leaderboard tier filter** | `leaderboard/page.tsx` | The dropdown picks a benchmark. It should pick a tier too, once ranks are per tier. |
| **`benchmark_scenarios.scenario_count`** | `api/benchmarks/[id]/route.ts` PUT | Recomputed as a count across *all* tiers. Arguably right for a card, definitely wrong for a tier page. Decide and comment. |
| **Sync does not recompute per tier** | `easyaimSync.ts` `recordAggregatesFor` | Same root cause as the first row. PBs are stored per EasyAim scenario, correctly, but the aggregate written to `benchmark_scores` is primary-tier only. |
| **Category rails are per benchmark** | `benchmarks.category_defs` | Fine — evxl.app shares its rails across tiers too. Left alone on purpose. |

### Things that were mid-edit when the session ended

The per-tier scenario list on the **edit page** is wired end to end
(`replaceTierScenarios` in `lib/tiers.ts`, `PUT` on the tiers route, the form
posts `scenarios` with `tierSlug`, the page round-trips through
`selectTier`). It was **not** manually exercised. If the edit page's scenario
list misbehaves, look there first — it is the least-tested path in the app.

---

## 1. What this is

A community aim-benchmark leaderboard. People create benchmarks out of EasyAim
scenarios, set a score cutoff per rank tier, and everyone competes on the same
scenarios. Scores come from the EasyAim API, not from anyone typing a number in.

Live at `aim-bench.vercel.app`. Repo at `C:\Users\uki\Music\aim-bench`, branch
`main`, remote `uday2006y/Aim-bench`.

---

## 2. Stack

- Next.js 16.3.5, App Router, TypeScript, React 19
- Tailwind v4, Vercel
- Supabase (Postgres + PostgREST), accessed **server-side only** via the
  service-role key
- Discord OAuth for login, auto-linking to EasyAim
- No test framework — `npm test` uses Node 24's built-in runner

---

## 3. Commands

```
npm test          # 83 tests, no dependencies needed
npx tsc --noEmit  # must be clean
npm run lint      # must be clean
npm run build     # must compile
```

All four are clean. There is no lint baseline to ignore any more.

**Gotcha:** removing a route or page requires deleting `.next` — a stale
`validator.ts` fails the build. After clearing `.next`, `tsc` fails until
`next build` runs, because `LayoutProps<"/">` is a generated type.

---

## 4. Tiers — the newest subsystem

A benchmark has up to six named tiers. Each has its own **scenarios, categories,
cutoffs and rank ladder**. `/benchmarks/<id>/<tier>` renders one;
`/benchmarks/<id>` redirects to the first, so old links still land somewhere.

| Path | What |
|---|---|
| `src/lib/benchmarkTiers.ts` | Pure: count cap, slug rules, ladder validation, **primary-tier scoping**. Tested |
| `src/lib/tiers.ts` | The only module that knows the tier table names |
| `src/lib/benchmarkScenarios.ts` | `groupScenariosByTier`, `tierSlug` on every scenario. Tested |
| `src/components/TierSwitcher.tsx` | The header pills |
| `src/app/benchmarks/[id]/[tier]/page.tsx` | One tier's page |
| `src/app/api/benchmarks/[id]/tiers/route.ts` | POST add · PATCH rename/ladder · PUT scenarios · DELETE |

### The rule that matters most

**`scenariosInPrimaryTiers`.** Scenarios belong to a tier, so a three-tier
benchmark has three times the rows. Summing them all into one aggregate adds a
player's Novice score to their Elite score and calls the total neither — a card
and a leaderboard row both wrong, no error anywhere. Every benchmark-level read
narrows to the first tier through this one function, and it is tested.

If you add a read that touches scenarios across benchmarks, it must go through
this. It is the same class of bug as the two rank-walk copies that came before.

### Ownership, in one line each

- **Scenario → tier.** A tier's page is its own rows.
- **Cutoffs → scenario row.** Not a side table. With one owner per scenario there
  was nothing to share, and two owners means every read has to arbitrate.
- **Rank ladder → tier.** `benchmarks.rank_names` survives only so pre-tier rows
  still resolve.
- **Category rails → benchmark.** Shared across tiers, like the reference.

### Slugs

`Elite (Unofficial)` → `/elite-unofficial`. Display names keep their
punctuation; only the address is slugified. Two tiers cannot normalise to the
same slug — `sanitizeTiers` drops the second, and `slugifyTierName` is tested
against it.

---

## 5. The two data sources, and why

| | Used for | Source |
|---|---|---|
| `easyaim_pbs` | Benchmark cards, **leaderboard** | Live — computed on read |
| `benchmark_scores` | Rank history only | Written by the sync engine |

`benchmark_scores` is *history* — when someone completed something. Live
standings are computed from `easyaim_pbs` on every read.

Both go through the same `computeAggregates`, so they cannot disagree by
construction. **Do not reintroduce a second rank calculation.** There were two
violations of that rule and both are gone: the sync engine's hand-copied walk,
and `POST /api/scores`, which let anyone publish arbitrary numbers into the
public rank history. Scores come from EasyAim. That endpoint is deleted and
its dead UI with it.

---

## 6. Pure modules — all tested

| Module | Rule it owns |
|---|---|
| `lib/aggregates.ts` | The rank walk. One implementation. |
| `lib/tierBars.ts` | How full each rank's bar draws — fills the *gap* below, not from zero |
| `lib/benchmarkScenarios.ts` | Scenario/category normalisation, tier grouping, `renameCutoffKey` |
| `lib/benchmarkTiers.ts` | Tier count, slugs, ladder validation, primary-tier scoping |

**If a rule protects data, it lives in one of these with a test.** Every
serious bug in this codebase was a copy of a rule that had drifted from its
original: the edit form's rank rename, the sync engine's rank walk, the
zero-cutoff storage rule, the scenario-id type. Four times. That is the pattern
to watch for.

### Scenario ids are strings

The columns are `text` because EasyAim ids are alphanumeric. PostgREST will not
cast a JSON number into a text column, so a number is a 500 on every write.
`sanitizeScenarios` normalises at the boundary and every map keyed by a scenario
id is keyed by string. Getting this wrong is invisible — a `Map<number,…>`
looked up with a string misses every row and produces an aggregate of all
zeros.

---

## 7. Query discipline

Each `await` on Supabase is a full HTTPS round trip from a serverless function,
~300ms.

- Fetch independent things in one `Promise.all`. Never chain dependent-looking
  awaits.
- Don't make the browser fetch what the server already knows. `/api/scores` and
  `/api/session` are gone for this reason.
- No debounce on first load — only on typing.
- Client pages that do fetch keep a monotonic request ticket in a ref, so a
  slow earlier response cannot overwrite a newer one.

Round trips: `/profile` 5→1, `/benchmarks` 5→1, `/benchmarks/[id]` 6→2, `/` 2→1.

**Deliberate trade-off:** list and detail pages read a viewer's `easyaim_pbs`
by account only, not filtered to the scenarios on screen. That is what lets the
query go out *in parallel with* the scenarios. Bounded by one person's play.

---

## 8. Database

| File | What |
|---|---|
| `supabase-final.sql` | Schema, **plus the type + tier migration block at the bottom** |
| `supabase-pins.sql` | `benchmark_pins` + `benchmark_pin_totals` view |
| `supabase-verify.sql` | **Read-only.** Checks the whole schema is current |

**Run `supabase-verify.sql` first** in any new session. Schema drift has bitten
this project repeatedly and the symptom is always "a feature silently does
nothing".

Three column types were fixed in the same block, all wrong quietly:

- `score` was `integer` while EasyAim scores are fractional — Postgres rounded
  on insert, so 1,012.667 became 1013 and a benchmark's total drifted on every
  re-sync. Nothing noticed because the tests exercise the pure function, not
  the column. Now `double precision`: `numeric` is avoided deliberately, because
  PostgREST can return it as a JSON *string*, which would silently turn every
  `score >= cutoff` comparison into a string comparison.
- `easyaim_scenario_id`, `easyaim_pbs.scenario_id`, `easyaim_player_id` were
  `bigint` while EasyAim ids are alphanumeric. Now `text`.

### RLS is the security model

Every table has RLS on and **no policies**: the anon key is useless, the
service-role client bypasses it. A policy added by accident exposes that table.

`benchmark_pin_totals` is `security_invoker = on`. Without it the view is
`SECURITY DEFINER` and exposes every pin row through the anon key.

`benchmark_edits` is dropped from the schema. Nothing ever wrote to it; it
looked like an audit trail and was not one.

### Local env is a placeholder

`.env.local` holds template values, is gitignored, and
`git log --all -- .env.local` is empty. **You cannot query the database
locally.** Verify by deploying, or by asking the user to run SQL and paste the
output.

---

## 9. Open items

1. **Run the tier migration** (section 0). Blocks everything in section 4.
2. **Per-tier ranks on cards, leaderboard and sync.** See the table in
   section 0. The honest current state: tier *pages* are right, benchmark-level
   numbers describe the first tier.
3. **`vercel.json` says `bom1` (Mumbai)** — a guess. Confirm against the
   Supabase region host and change the one word. Wrong = slow, not broken. The
   user said to leave it.
4. **Rate limiting is best-effort.** `src/lib/throttle.ts` is per-instance
   in-memory: it stops a script hammering one warm function and nothing more.
   A real limit needs a shared store or a WAF rule. Left honest rather than
   half-built.
5. **`resetLinkedAccountsBackfill` nulls `last_run_id` for everyone** on any
   benchmark create or scenario-set change. O(community) per edit. Fine for an
   alpha; worth a "changed since" marker later.
6. **No monitoring.** `console.error` reaches Vercel's logs and nowhere else.
   Error boundaries exist (`error.tsx`, `global-error.tsx`, `not-found.tsx`,
   inline failure states), so a player has a digest to quote and a retry
   button — but nobody is told. Sentry or similar is the next real step.
7. **GitHub issue templates** still not built. No `.github`.

---

## 10. Alpha testing

The user is inviting players onto a Discord server and asking them to report
problems. Everything they can hit is now survivable: error boundaries with
digests, inline failure states, no dead buttons, no silent score submission.

---

## 11. Deliberate, not bugs

- **Bar style is per-device `localStorage`**, via `useSyncExternalStore` rather
  than copied into state on mount.
- **A cutoff of zero counts as no cutoff, everywhere.** Cleared fields used to
  be coerced with `Number()`, and `Number("")` is `0`, so every untouched field
  became a requirement of zero — which every scenario passes. Authors were
  handed the top rung for leaving a field blank, while the page said it was
  unreachable.
- **Ranks with no cutoffs anywhere are skipped**, not auto-passed.
- **`Complete` only at the top rank.** It is a claim about the whole benchmark.
- **A card reads `Gold`, never `Gold of Platinum`.** The ceiling named a tier
  the player is nowhere near.
- **No way to type a score in.** Scores come from EasyAim.
- **Unlinking is destructive** — it deletes stored bests and the history derived
  from them. Deliberate: leaving them merged the next player's bests in.
- **EasyAim links through Discord only.** The manual paste-an-ID form is gone;
  it accepted any id with no proof of ownership and fabricated a player when the
  lookup failed.
- **A benchmark-level number describes the first tier.** Correct today, and it
  is the first thing to change once ranks go per tier.

---

## 12. Conventions

- Conventional-commit subject plus a body explaining **why**, not what.
  Trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  (unconfirmed by the user — drop it if unwanted).
- Verify with measurement, not screenshots. `getBoundingClientRect`,
  `getComputedStyle`, DOM assertions.
- Never commit secrets.
- The user prefers speed and dislikes being asked to choose repeatedly. Make the
  call, state it, offer the alternative in one line.

### On editing files

`PowerShell` line-based rewriting corrupted `src/lib/tiers.ts` and
`src/app/api/benchmarks/[id]/route.ts` mid-session — both silently lost whole
handlers, and both had to be rebuilt. The cause was mixed CRLF/LF from earlier
writes, which makes `Get-Content`, `Select-String` and the Read tool disagree
about line numbers.

**Use the edit tool for edits.** If a shell rewrite is unavoidable, `git diff`
afterwards, and re-run `tsc` — a truncated file often still typechecks if the
missing export is nothing references.

---

## 13. Things I got wrong, worth not repeating

- I diagnosed "Not played" from a screenshot as a card/leaderboard
  disagreement. It was a PB that had not synced yet. The fix was right; the
  cause I asserted was not.
- I added a dark plate behind the bar numbers. It looked like a sticker.
- I hardcoded 150px rank columns; the scenario name collapsed to 0px at 6+
  rungs. `table-fixed` with unwidthed columns is the correct approach.
- **I wrote `FULL-INVENTORY.md` as a snapshot of the codebase, then kept editing
  the codebase.** It went stale within days and by then it claimed live secrets
  were committed to the repository — they never were. A session told to read it
  would have chased a breach that never happened. It is deleted. **Do not write
  a document describing the current state of the code**; it will be a lie by
  next week. Document rules and reasoning; let the code be the inventory.
- I declared the tier cutoffs table's id column `bigint` in the same file that
  migrated the column to `text`, and the migration failed on the seed insert.
  The user ran it and pasted the error. **When a migration changes a type, grep
  the whole file for the old type before committing it.**
- I was interrupted mid-refactor and the user pushed a tree that did not
  compile. Ten Vercel type errors. **Run `npm run build` before handing over a
  refactor**, not just `tsc`.
- A path containing `[id]` is a wildcard to PowerShell's `Select-String -Path`.
  It silently reported false negatives. Use the Read tool or grep.
