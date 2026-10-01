# AIMBENCH — Session Handoff

Read this first in a new session.

---

## What this is

A community aim-benchmark leaderboard. People create benchmarks out of
EasyAim scenarios, set a score cutoff per rank tier, and everyone competes
on the same scenarios. Scores come from the EasyAim API, not from anyone
typing a number in.

Live at `aim-bench.vercel.app`. Repo at `C:\Users\uki\Music\aim-bench`,
branch `main`, remote `uday2006y/Aim-bench`.

---

## Stack

- Next.js 16.3.5, App Router, TypeScript, React 19
- Tailwind v4, Vercel
- Supabase (Postgres + PostgREST), accessed **server-side only** via the
  service-role key
- Discord OAuth for login, with auto-linking to EasyAim
- No test framework — `npm test` uses Node 24's built-in runner

---

## Commands

```
npm test          # 46 tests, no dependencies needed
npx tsc --noEmit  # must be clean
npm run lint      # must be clean
npm run build     # must compile
```

All four are clean. There is no lint baseline to ignore any more — the old
"42 errors, all pre-existing" line is retired, and most of what it covered
was dead code and `any`.

Dev server pattern used throughout:

```
npx next dev -p 31XX          # background
npx next dev -p 31XX          # then kill the port and delete .next/dev
```

**Gotcha:** removing a route or page requires deleting `.next` — a stale
`validator.ts` in `.next/dev/types` fails the build. After clearing `.next`,
`tsc` fails until `next build` runs, because `LayoutProps<"/">` is a
generated type.

---

## Architecture you need to know

### Two sources of score data, and why

| | Used for | Source |
|---|---|---|
| `easyaim_pbs` | Benchmark cards, **leaderboard** | Live — computed on read |
| `benchmark_scores` | Rank history only | Written by the sync engine |

`benchmark_scores` is *history* — it records **when** someone completed
something. Live standings are computed from `easyaim_pbs` on every read.

This was deliberate. They used to disagree: the cards derived a rank the
moment a PB existed, while the leaderboard only showed people the sync had
reached, so a player could see "Gold" on their card and be absent from the
board. Both now call the same `computeAggregates`, so they cannot disagree
by construction. **Do not reintroduce a second rank calculation.**

There was exactly one violation of that rule and it is gone:
`easyaimSync.ts` carried its own hand-copied walk, with a comment saying the
two had to be kept in agreement. It calls `computeAggregates` like
everything else now.

### `src/lib/aggregates.ts` — pure, no I/O

`computeAggregates(benchmarks, scenarios, pbByScenario)` → `Map<id, Aggregate>`.
The single rank walk. Tested in `aggregates.test.mts`.

### `src/lib/tierBars.ts` — pure

`computeTierFills(cutoffs, score)` → fill percentages per tier. Each bar
fills across the **gap between the rung below and its own cutoff**, not
`score / cutoff`. Tested in `tierBars.test.mts`.

### `src/lib/benchmarkScenarios.ts` — pure

`sanitizeScenarios`, `sanitizeCategoryDefs`, `renameCutoffKey`. Tested in
`benchmarkScenarios.test.mts`. `renameCutoffKey` exists because the edit form
and the create form used to disagree about renaming a rank, and the edit form
was silently losing cutoffs over it.

### `src/lib/leaderboard.ts` — the one I/O module for standings

`buildLeaderboard(benchmarkId?)`. Four parallel queries, then pure
arithmetic.

### Query discipline — do not regress this

Every page was audited for sequential awaits. Each `await` on a Supabase
query is a full HTTPS round trip from a serverless function, ~300ms each.

| Page | Server round trips, before → after |
|---|---|
| `/profile` | 5 → 1 |
| `/benchmarks` | 5 → 1 |
| `/benchmarks/[id]` | 6 → 2 |
| `/` | 2 → 1 |

And browser requests per page load: leaderboard 3 → 1, rank-history 3 → 1,
benchmarks 3 → 1, edit page 2 → 1, settings 2 → 0.

**Rules that came out of it:**
- Fetch independent things in one `Promise.all`. Never chain awaits that
  don't depend on each other.
- Don't make the browser fetch something a server already knows.
  `loggedIn` and the dropdown options ride along in the page's own response.
- No debounce on first load — only on typing.
- `/api/scores` and `/api/session` are gone. If you find yourself adding an
  endpoint so a client component can learn something the server already had,
  the answer is a server component.
- Client pages that do fetch keep a monotonic request ticket in a ref, so a
  slow earlier response cannot overwrite a newer one.

### Deliberate trade-off: unfiltered PB reads

The list and detail pages read a viewer's `easyaim_pbs` **by account only**,
not filtered to the scenarios on screen. That is what lets those queries go
out *in parallel with* the scenarios instead of after them. Bounded by how
much that one person has played. Nothing that would change a rank is
skipped.

---

## Database

Schema in `supabase-setup.sql` and `supabase-final.sql`. Migrations the
user runs by hand:

| File | What |
|---|---|
| `supabase-final.sql` (type block at the bottom) | **Run this.** Scores → `numeric`, ids → `text` |
| `supabase-pins.sql` | `benchmark_pins` table + `benchmark_pin_totals` view |
| `supabase-verify.sql` | **Read-only.** Checks the whole schema is current |

**Run `supabase-verify.sql` first** in any new session. Schema drift has
bitten this project repeatedly and the symptom is always "a feature silently
does nothing".

Three column types were wrong, and wrong *quietly*:

- `easyaim_pbs.score` and `benchmark_scores.score` were `integer` while
  EasyAim scores are fractional. Postgres rounded on insert, so 1,012.667
  became 1013 and a benchmark's total drifted on every re-sync. Nothing
  noticed because the tests exercise the pure function, not the column.
- `benchmark_scenarios.easyaim_scenario_id`, `easyaim_pbs.scenario_id` and
  `easyaim_links.easyaim_player_id` were `bigint` while the code has handled
  alphanumeric ids for some time. The client could fetch one and then fail to
  store it.

### RLS is the security model

Every table has RLS enabled with **no policies**. That is deliberate: the
anon key cannot read or write anything, and the service-role client bypasses
RLS. A policy added by accident exposes that table to anyone holding the
anon key.

`benchmark_pin_totals` is `security_invoker = on`. Without it the view is
`SECURITY DEFINER` and ignores the table's RLS, so the anon key could read
every pin row through the `public` schema.

`benchmark_edits` has been dropped from the schema. Nothing ever wrote to it
or read it; it looked like an audit trail and was not one.

### Local env is a placeholder

`.env.local` contains template values, not real secrets, and is gitignored —
`git log --all -- .env.local` is empty. Real values live in Vercel's env
vars. **You cannot query the database or run DB-dependent code locally.**
Verify by deploying or by asking the user to run SQL.

---

## Open items

1. **`supabase-pins.sql` — the user has never confirmed running it.** The
   star fails without it. There is now a toast that names the fix, but they
   may not have seen it. Ask.
2. **The type block in `supabase-final.sql` has not been run.** Until it is,
   scores round and alphanumeric ids are rejected. Section 7 of
   `supabase-verify.sql` reports both.
3. **`vercel.json` says `bom1` (Mumbai)** — that was a *guess*. Confirm the
   Supabase region (Project Settings → Database → connection string host
   contains `ap-south-1` etc.) and change the one word if wrong. Wrong =
   slow, not broken. The user said to leave this one alone.
4. **Rate limiting is best-effort.** `src/lib/throttle.ts` is an in-memory
   per-instance counter: it stops a script hammering one warm function and
   nothing more. A real limit needs a shared store (Upstash) or a WAF rule.
   Left honest rather than half-built, because a per-instance limiter that
   looks like protection is worse than a documented gap.
5. **`resetLinkedAccountsBackfill` still nulls `last_run_id` for everyone.**
   Creating or editing a benchmark resets the whole community's sync cursor,
   so the next run re-reads up to twelve pages per person. It works, but it
   is O(community) per benchmark edit. Worth a "scenarios changed since"
   marker if the alpha grows.
6. **Brunson font licence** — the user downloaded a freeware display font
   from Dafont, we wired it in, then they asked to revert it. Reverted. If it
   comes back, the licence is likely personal-use-only, which doesn't cover a
   public site.

---

## Alpha testing — what the user is doing next

The user is creating a Discord server, adding players, and asking them to
use the site and report bugs and feature requests.

- **Error boundaries — built.** `error.tsx`, `global-error.tsx`,
  `not-found.tsx`, plus inline failure states on every client page that
  fetches. A server crash shows a retry button and a digest instead of a stack
  trace, and every client page says "could not load" rather than hanging or
  rendering nothing. Still **no monitoring** — `console.error` goes to
  Vercel's logs and nowhere else, so a player reporting a problem needs to
  quote the digest. Sentry or similar is the next real step.
- **GitHub issue templates — still not built.** No `.github` directory.

---

## Things that are deliberate, not bugs

- **Bar style is per-device `localStorage`**, not per-account. Cosmetic only,
  never touches data. Read through `useSyncExternalStore`, not copied into
  state on mount.
- **Card reads `Platinum`, never `Platinum of Champion`.** The ceiling was
  removed on purpose — it named a tier the player isn't near.
- **`Complete` only at the top rank.** "Complete" is a claim about the whole
  benchmark.
- **Ranks with no cutoffs anywhere are skipped**, not auto-passed —
  otherwise a decorative top rank is handed to everyone who opens the page.
- **A cutoff of zero counts as no cutoff, everywhere.** This one is not a
  detail. Cleared form fields used to be coerced with `Number()`, and
  `Number("")` is `0`, so every untouched field was stored as 0. The rank
  walk treated a 0 as a real requirement and `pb >= 0` passed on everything,
  so an unfilled tier was handed out while the page said it was unreachable.
- **No platform dropdown on `/benchmarks`** — it had one option. The
  `?platform=` API filter is still there; the response default is `all`.
- **No `/groups` page** and **no user theme picker** — both removed at the
  user's request.
- **No way to type a score in.** Removed deliberately: scores come from
  EasyAim, and the endpoint that accepted typed numbers is deleted. If it
  comes back it needs to be admin-only and rate-limited, not a public POST
  that anyone can put arbitrary numbers into.
- **Unlinking is destructive** — it deletes stored personal bests and the
  history derived from them. Deliberate: leaving them behind merged the next
  player's bests into this one's, permanently. The confirm dialog says so.
- **EasyAim is auto-linked through Discord only.** The manual "paste a player
  id" form is gone: it accepted any id with no proof of ownership and
  fabricated a player object when the lookup failed.

---

## Conventions

- Conventional-commit subject plus a body explaining **why**, not what.
  Trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  (the user hasn't objected, but also hasn't confirmed it — drop it if
  unwanted).
- Verify with measurement, not eyeballing a screenshot. `getBoundingClientRect`,
  `getComputedStyle`, and DOM assertions have caught things screenshots hid.
  Throwaway `src/app/preview-temp/page.tsx` pages were the earlier approach
  and were replaced by real tests for anything load-bearing.
- **If a rule protects data, it lives in a pure function with a test.** Both
  of the worst bugs in this codebase were a copy of a rule that had drifted
  from its original: the edit form's rank rename, and the sync engine's rank
  walk. The zero-cutoff rule drifted a third time, between the storage layer
  and the rank walk.
- Never commit secrets. `.env*` is gitignored.
- The user prefers speed and dislikes being asked to choose between options
  repeatedly. Make the call, state it, offer the alternative in one line.

---

## Things I got wrong, worth not repeating

- I diagnosed "Not played" from a screenshot as a card/leaderboard
  disagreement. It wasn't — the PB simply hadn't synced yet. The fix was still
  correct on its own merits, but I asserted a cause I hadn't checked.
- I added a dark plate behind the bar numbers to make them legible. It looked
  like a sticker. The user rejected it; a soft offset drop shadow is what they
  wanted.
- I hardcoded 150px rank columns and it collapsed the scenario name to 0px at
  6+ rungs. **Measure column widths** — `table-fixed` with unwidthed columns
  that split the remainder equally is the correct approach.
- I wrote `FULL-INVENTORY.md` as a snapshot of the codebase and then kept
  editing the codebase. It went stale within days and by then it was actively
  harmful: it claimed live secrets were committed to the repository (they
  never were — `.env*` is gitignored and `git log --all -- .env.local` is
  empty), and it listed files and bugs that no longer existed. A future
  session told to read it would have chased a breach that never happened. It
  is deleted. **Do not write a document that describes the current state of
  the code** — it will be a lie by next week and someone will believe it.
  Document the rules and the reasoning; let the code be the inventory.
- A path containing `[id]` is a wildcard to PowerShell's `Select-String
  -Path`. It silently reported false negatives. Use grep for those.
