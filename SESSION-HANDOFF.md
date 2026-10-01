# AIMBENCH — Session Handoff

Written 1 Oct 2026 at commit `ef7581e`. Read this first in a new session.

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
npm test          # 25 tests, no dependencies needed
npx tsc --noEmit  # must be clean
npm run build     # must compile
npm run lint      # 42 errors / 21 warnings baseline, all pre-existing
```

Dev server pattern used throughout:

```
npx next dev -p 31XX          # background
npx next dev -p 31XX          # then kill the port and delete .next/dev
```

**Gotcha:** removing a route or page requires deleting `.next` — a stale
`validator.ts` in `.next/dev/types` fails the build. After clearing
`.next`, `tsc` fails until `next build` runs, because `LayoutProps<"/">` is
a generated type.

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

### `src/lib/aggregates.ts` — pure, no I/O

`computeAggregates(benchmarks, scenarios, pbByScenario)` → `Map<id, Aggregate>`.
This is the single rank walk. Tested in `aggregates.test.mts` (12 cases).

### `src/lib/tierBars.ts` — pure

`computeTierFills(cutoffs, score)` → fill percentages per tier.
Each bar fills across the **gap between the rung below and its own cutoff**,
not `score / cutoff`. Tested in `tierBars.test.mts` (13 cases).

### `src/lib/leaderboard.ts` — the one I/O module for standings

`buildLeaderboard(benchmarkId?)`. Four parallel queries then pure
arithmetic. All the leaderboard, profile, detail and list data comes
through these three libs.

### Query discipline — do not regress this

Every page was audited for sequential awaits. Each `await` on a Supabase
query is a full HTTPS round trip from a serverless function, ~300ms each.

| Page | Server round trips, before → after |
|---|---|
| `/profile` | 5 → 1 |
| `/benchmarks` | 5 → 1 |
| `/benchmarks/[id]` | 5 → 2 |
| `/` | 2 → 1 |

And browser requests per page load: leaderboard 3 → 1, rank-history 3 → 1,
benchmarks 3 → 1, edit page 2 → 1.

**Rules that came out of it:**
- Fetch independent things in one `Promise.all`. Never chain awaits that
  don't depend on each other.
- Don't make the browser fetch something a server already knows. `loggedIn`
  and the dropdown options ride along in the page's own response.
- No debounce on first load — only on typing.

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
| `supabase-pins.sql` | `benchmark_pins` table + `benchmark_pin_totals` view |
| `supabase-verify.sql` | **Read-only.** Checks the whole schema is current |

**Run `supabase-verify.sql` first** in any new session. Schema drift has
bitten this project three times and the symptom is always "a feature
silently does nothing".

### RLS is the security model

Every table has RLS enabled with **no policies**. That is deliberate: the
anon key cannot read or write anything, and the service-role client
bypasses RLS. A policy added by accident exposes that table to anyone
holding the anon key.

`benchmark_pin_totals` is `security_invoker = on`. Without it the view is
`SECURITY DEFINER` and ignores the table's RLS, so the anon key could read
every pin row through the `public` schema. The Supabase Security Advisor
flagged this correctly.

### Local env is a placeholder

`.env.local` contains template values, not real secrets. Real values live
in Vercel's env vars. **You cannot query the database or run DB-dependent
code locally.** Verify by deploying or by asking the user to run SQL.

---

## Open items

1. **`supabase-pins.sql` — the user has never confirmed running it.** The
   star fails silently without it (there is now a visible toast, but they
   may not have seen it). Ask.
2. **`vercel.json` says `bom1` (Mumbai)** — that was a *guess*. Confirm the
   Supabase region (Project Settings → Database → connection string host
   contains `ap-south-1` etc.) and change the one word if wrong. Wrong =
   slow, not broken. The user said to leave this one alone.
3. **`POST /api/easyaim/link`** — accepts any typed player ID with no
   ownership proof, and fabricates a player object if the API call fails
   (lines 90–97). No UI callers. The user reviewed this and said the
   account linking is fine as-is, so it has been left. Worth re-raising if
   they ever invite strangers.
   - Note: a **verified** path already exists and is wired into login —
     EasyAim's own `/api/v1/lookup/discord/{discordId}`, which returns
     exactly the players that Discord account owns. If the manual route is
     ever revisited, it should use that instead of a typed ID.
4. **Brunson font licence** — the user downloaded a freeware display font
   from Dafont, we wired it in, then they asked to revert it. Reverted. If
   it comes back, the licence is likely personal-use-only, which doesn't
   cover a public site.

---

## Alpha testing — what the user is doing next

The user is creating a Discord server, adding players, and asking them to
use the site and report bugs and feature requests. Two things were built to
make that feedback usable and neither has been confirmed in use:

- **Error boundaries** — proposed, **never built**. There is no `error.tsx`
  anywhere, so a crash in a server component shows a raw Next error page
  and a client throw shows a blank screen. With no monitoring either
  (`console.error` goes to Vercel logs and nothing else), a player's "it
  didn't work" has no diagnostic attached. **This is the highest-value
  remaining work.**
- **GitHub issue templates** — proposed, **never built**. No `.github`
  directory.

---

## Things that are deliberate, not bugs

- **Bar style is per-device `localStorage`**, not per-account. Cosmetic
  only, never touches data. Documented trade-off.
- **Card reads `Platinum`, never `Platinum of Champion`.** The ceiling was
  removed on purpose — it named a tier the player isn't near (30 points off
  Diamond but told the goal was Champion, 674 away).
- **`Complete` only at the top rank.** "Complete" is a claim about the
  whole benchmark.
- **Ranks with no cutoffs anywhere are skipped**, not auto-passed —
  otherwise a decorative top rank is handed to everyone who opens the page.
- **No platform dropdown on `/benchmarks`** — it had one option. The
  `?platform=` API filter is still there; the response default is `all`.
- **No `/groups` page** and **no user theme picker** — both removed at the
  user's request.

---

## Conventions

- Conventional-commit subject plus a body explaining **why**, not what.
  Trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  (the user hasn't objected, but also hasn't confirmed it — drop it if
  unwanted).
- Verify with measurement, not eyeballing a screenshot. `getBoundingClientRect`,
  `getComputedStyle`, and DOM assertions have caught things screenshots
  hid. Throwaway `src/app/preview-temp/page.tsx` pages were the earlier
  approach and were replaced by real tests for anything load-bearing.
- Never commit secrets. `.env*` is gitignored.
- The user prefers speed and dislikes being asked to choose between
  options repeatedly. Make the call, state it, offer the alternative in one
  line.

---

## Things I got wrong, worth not repeating

- I diagnosed "Not played" from a screenshot as a card/leaderboard
  disagreement. It wasn't — the PB simply hadn't synced yet. The fix was
  still correct on its own merits, but I asserted a cause I hadn't checked.
- I added a dark plate behind the bar numbers to make them legible. It
  looked like a sticker. The user rejected it; a soft offset drop shadow is
  what they wanted.
- I hardcoded 150px rank columns and it collapsed the scenario name to 0px
  at 6+ rungs. **Measure column widths** — `table-fixed` with unwidthed
  columns that split the remainder equally is the correct approach.
- A path containing `[id]` is a wildcard to PowerShell's `Select-String
  -Path`. It silently reported false negatives. Use grep for those.
