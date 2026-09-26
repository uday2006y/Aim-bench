# AIMBENCH — FULL PROJECT INVENTORY & DEEP DIVE

## 1. PROJECT IDENTITY
Name: `aim-bench` (package.json name)
Type: Next.js 16 App Router web application (dark theme, Tailwind CSS v4)
Purpose: Aim benchmark tracking platform integrated with EasyAim (staging API). Allows users to create benchmarks, submit scores, view leaderboards, track rank history, link EasyAim accounts, and sync personal bests.
Deployment: Vercel (vercel.json with 4am daily cron)
Repo: Git repo (git) in C:\Users\uki\Music\aim-bench

## 2. COMPLETE FILE INVENTORY (non-node_modules)
Root:
- .env.local (live secrets — see Security section)
- .gitignore
- AGENTS.md (Next.js agent rules block)
- CLAUDE.md (points to AGENTS.md)
- README.md (standard Next.js template)
- package.json / package-lock.json
- postcss.config.mjs
- eslint.config.mjs
- tsconfig.json / tsconfig.tsbuildinfo
- next.config.ts (empty/default)
- next-env.d.ts
- vercel.json (cron at 4am)
- supabase-setup.sql (original schema)
- supabase-final.sql (updated schema with alphanumeric IDs, text IDs changed to bigint)
- TODO-EVXL.md (94 lines of missing features vs evxl.app)

Public: /public/file.svg, globe.svg, next.svg, vercel.svg, window.svg

Source (src/):
src/app/ (pages):
- page.tsx (home)
- layout.tsx
- globals.css
- favicon.ico
- benchmarks/page.tsx
- benchmarks/[id]/page.tsx
- benchmarks/[id]/BenchmarkClient.tsx
- benchmarks/[id]/edit/page.tsx
- create-benchmark/page.tsx
- groups/page.tsx
- leaderboard/page.tsx
- login/page.tsx
- profile/page.tsx
- profile/easyaim-link.tsx
- profile/benchmark-delete.tsx
- rank-history/page.tsx
- register/page.tsx
- theme-settings/page.tsx

src/app/api/:
- auth/login/route.ts
- auth/register/route.ts
- auth/logout/route.ts
- auth/discord/route.ts
- auth/discord/callback/route.ts
- session/route.ts
- benchmarks/route.ts
- benchmarks/[id]/route.ts
- benchmarks/[id]/edit-route.ts
- scores/route.ts
- leaderboard/route.ts
- rank-history/route.ts
- easyaim/link/route.ts
- easyaim/scenarios/route.ts
- easyaim/sync/route.ts
- easyaim/sync-all/route.ts

src/components/:
- ThemeProvider.tsx

src/lib/:
- supabase.ts (public/client)
- supabaseAdmin.ts (service role)
- session.ts (JWT cookie session)
- easyaim.ts (EasyAim staging API client)
- easyaimSync.ts (sync PBs, aggregates, backfill)

## 3. DATABASE SCHEMA (Supabase / PostgreSQL)
Two SQL files exist: setup (original) and final (updated for alphanumeric IDs, discord, edit, delete).

Tables:
- accounts (uuid pk, username unique, password_hash, discord_id unique, role default user, created_at)
- profiles (id -> accounts.id, display_name, created_at)
- benchmarks (uuid pk, user_id fk accounts, title, description, platform default 'easyaim', difficulty default medium, rank_names array, rank_colors array, rank_thresholds jsonb, scenario_count int default 1, created_at, updated_at)
- benchmark_scores (uuid pk, benchmark_id fk, user_id fk, score int, rank text, rank_index int, completed_at)
- benchmark_edits (uuid pk, benchmark_id fk, user_id fk, changed_field, old_value, new_value, changed_at)
- benchmark_scenarios (uuid pk, benchmark_id fk, easyaim_scenario_id [text in setup, bigint in final], title, position int default 0, category default 'Other', cutoffs jsonb, created_at, unique benchmark+scenario)
- easyaim_links (account_id pk -> accounts.id, easyaim_player_id [bigint/text], easyaim_username, display_name, avatar_url, last_run_id bigint, backfill_cursor text, backfill_done bool default false, last_synced_at, created_at)
- easyaim_pbs (account_id fk, scenario_id [bigint/text], score int, run_id bigint, achieved_at, updated_at, pk composite account_id+scenario_id)

RLS (Row Level Security):
- accounts: enabled, no select policies (server-only)
- profiles: select true (public read)
- benchmarks: select true, no anon writes
- benchmark_scores: select true, no anon writes
- benchmark_edits: no policies (server-only)
- benchmark_scenarios: select true
- easyaim_links: no policies
- easyaim_pbs: no policies

Note: final schema changed benchmark_scenarios.easyaim_scenario_id from text to bigint. Setup uses text. The code treats IDs as numbers (Number() conversions) which aligns with final.

## 4. TECHNOLOGY STACK
- Next.js 16.3.5 (App Router)
- React 19.2.8
- TypeScript 5
- Tailwind CSS v4 (@tailwindcss/postcss)
- Supabase (supabase-js 2.116.0) — public + service-role clients
- bcryptjs (password hashing)
- jose (JWT cookie sessions)
- curl (dependency, likely unused in code)
- Font: Geist + Geist_Mono (Google fonts)

## 5. AUTH SYSTEM (Custom — NOT Supabase Auth)
Flow:
1. User submits username + password to /api/auth/login (POST)
2. Server compares bcrypt hash from accounts table (supabaseAdmin)
3. On match: creates JWT cookie (session) with jose (HS256, 7d expiry, accountId payload)
4. Cookie set: httpOnly, secure=in-prod, sameSite=lax, path=/

Register (/api/auth/register):
- Creates account + profile row, hashes password (bcrypt, 12 rounds), sets session cookie.

Discord OAuth (/api/auth/discord -> /callback):
- Uses DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET from .env.local
- Exchanges code for access token, fetches Discord user identity
- Creates/link account by discord_id; if username taken, appends last 4 chars of discord id
- Auto-links EasyAim account via lookupPlayerByDiscordId (bonus, never breaks login)
- Sets session cookie, redirects to /profile

Session verification:
- getSessionAccountId() reads cookie, verifies JWT with SESSION_SECRET
- Used in API routes to know current user

Logout (/api/auth/logout):
- Clears cookie (maxAge 0), redirects to /

## 6. EASYIM INTEGRATION (Deep Dive)
Staging API: https://staging.easyaim.com (API_URL env)
API Key: EASYAIM_API_KEY (Bearer auth)

lib/easyaim.ts:
- Interfaces: EasyAimPlayer, EasyAimRun, EasyAimScenario
- getPlayer(id): tries /api/v1/players/{id}, falls back to /api/v1/players/by-id/{id} (handles alphanumeric IDs)
- lookupPlayerByDiscordId: /api/v1/lookup/discord/{discordId} -> returns player linked to Discord
- searchScenarios(query): /api/v1/scenarios?q=...
- getRunPage(playerId, cursor?, limit=25): /api/v1/players/{playerId}/runs?...

lib/easyaimSync.ts (core sync logic):
- PAGE_SIZE = 25
- NEW_RUNS_MAX_PAGES = 4 (scans newest runs first)
- BACKFILL_MAX_PAGES = 8 (backfills old history once)

syncEasyAimAccount(accountId) steps:
1. Read easyaim_links row for account
2. Read benchmark_scenarios to know attached scenario IDs (only tracks scenarios attached to benchmarks)
3. If no attached scenarios -> return empty (nothing to track)
4. Collect runs: newest first (up to 4 pages) until reaching last_run_id. Then backfill older runs (up to 8 pages) if backfill_done is false.
5. Persist progress (last_run_id, backfill_cursor, backfill_done, last_synced_at) BEFORE computing PBs (so failure doesn't repeat scans)
6. Find best run per scenario from collected runs
7. Read stored PBs (easyaim_pbs) for changed scenarios
8. Compare new best vs stored: if higher, create new PB row; else skip
9. For each changed scenario, find benchmarks that contain it (benchmark_scenarios query), then recompute aggregate for that benchmark for this account
10. Aggregate computation (recomputeBenchmarkAggregate):
    - Gets benchmark rank_names and rank_thresholds
    - Gets all benchmark_scenarios for benchmark
    - Gets user's PB scores for those scenario IDs
    - Score = sum of PB scores per scenario
    - Rank = highest rank where ALL scenarios meet their cutoffs (iterates from highest to lowest)
    - If no rank passes -> rank = null, rank_index = null
11. For each affected benchmark: compute aggregate. Compare to last benchmark_scores entry for user+benchmark. If score/rank/rank_index changed -> insert new score row.

Backfill mechanism:
- One-time import of older history. Uses backfill_cursor (next page token). When result.next is null -> backfill_done = true.
- If user links a new EasyAim account (new player id), resets last_run_id, backfill_cursor, backfill_done.

Auto-sync:
- Profile page (easyaim-link.tsx) starts syncNow(false) after 1.5s and every 2 minutes (AUTO_SYNC_INTERVAL_MS = 2*60*1000)
- syncNow(manual=true) shows loading and messages
- If new PBs or benchmarks updated -> router.refresh()

Sync-all API (/api/easyaim/sync-all):
- Protected by Bearer CRON_SECRET (from .env.local)
- Loops through up to 200 easyaim_links rows and calls syncEasyAimAccount for each
- Called by Vercel cron at 4am daily (vercel.json)

Link API (/api/easyaim/link):
- GET: returns current link info
- POST: accepts profile string (player ID, profile URL, or username). Parses with parseEasyAimPlayerId (handles URLs like https://easyaim.com/players/username/1234, numeric IDs, alphanumeric IDs). If API call fails, creates synthetic player. Upserts easyaim_links.
- DELETE: removes link
- After POST, tries initial sync (syncEasyAimAccount)

## 7. BENCHMARK LIFECYCLE (Pages + API)
Create (/create-benchmark):
- Client form with title, description, difficulty, platform, scenario count (optional), EasyAim scenario search (via /api/easyaim/scenarios?q=...)
- Scenario selection: user picks scenarios, sets score cutoffs per rank
- Rank config: editable names and colors (default 8 ranks: Bronze -> Immortal)
- POST to /api/benchmarks: creates benchmark row + benchmark_scenarios rows + resets all linked accounts' backfill to false (so they rescan new scenarios)

List (/benchmarks):
- Client-side fetch /api/benchmarks?platform=...&q=...
- Shows grid cards with platform, scenario count, title, description, date
- Filter by platform (hardcoded select with only "easyaim" currently — missing dynamic platforms)

Detail (/benchmarks/[id]):
- Server component fetches benchmark + scenarios (with user PB best_score attached if logged in) + user's score history
- Passes data to BenchmarkClient (client component for interactivity)
- BenchmarkClient shows:
  - Scenario table grouped by category
  - Score input + submit to /api/scores
  - Progress bars for each rank cutoff
  - Energy display (BUG: uses `energy` variable which doesn't exist; should use `totalEnergy`)
  - Edit link (only if accountId == benchmark.user_id)

Edit (/benchmarks/[id]/edit):
- Client page loads via /api/benchmarks/{id} and checks session for ownership
- Allows updating title, description, platform, difficulty, scenarios (add/remove/update cutoffs), rank names/colors
- PUT to /api/benchmarks/{id} (or edit-route — see Issues)

Delete:
- Component (benchmark-delete.tsx) calls DELETE /api/benchmarks/{id}
- Only allowed if session account == benchmark user

Score submission (/api/scores):
- POST: requires benchmarkId + numeric score
- Calculates rank based on benchmark.rank_thresholds (sorted thresholds, best matching rank)
- Inserts into benchmark_scores with rank and rank_index
- Returns { score: submittedScore }

GET /api/scores: returns user's own score history (optionally filtered by benchmark_id)

## 8. LEADERBOARD & RANK HISTORY
Leaderboard (/api/leaderboard):
- Selects from benchmark_scores with joins to benchmarks and accounts/profiles
- Sorts by rank_index DESC then score DESC (if benchmark filter) or just score DESC
- Deduplicates to best score per user per benchmark (bestPerUser Map)
- Returns array mapped to { id, username, score, rank, benchmark_title, platform, completed_at }

Rank History (/api/rank-history):
- Selects benchmark_scores ordered by user_id ASC, completed_at ASC
- Builds previous/current pairs per (user_id + benchmark_id) key
- Only pushes when a previous score exists (i.e., compares consecutive entries for same user+benchmark)
- Returns sorted by date DESC, limited to 100
- Client page shows cards with previous/current scores and rank changes

## 9. PROFILE & THEME
Profile (/profile):
- Requires login (redirects to /login if no session)
- Shows account info (username, created_at)
- EasyAim link card (with sync, auto-sync, refresh)
- Personal bests (easyaim_pbs joined with scenario titles from benchmark_scenarios)
- User's benchmarks list (with View, Edit, Delete actions)

Theme Settings (/theme-settings):
- Client component with color pickers for bg, text, accent
- Stores in localStorage (key: aimbench-theme)
- Applies instantly to body styles
- Default: bg #0a0a0a, text #ffffff, accent #b9f2fe

ThemeProvider (src/components/ThemeProvider.tsx):
- Simple wrapper, no complex logic (just provides context for theme if needed)

## 10. NAVIGATION & PAGES OBSERVATIONS
- Home page has custom header (not using layout header consistently?)
- Benchmarks, Leaderboard, Theme pages have duplicate header code embedded in page components instead of using a shared layout/nav
- Profile links appear twice in benchmarks/leaderboard/rank-history headers (duplicate buttons: "Profile" text + "Profile" button)
- Groups page is static (hardcoded array) linking to /benchmarks?platform=... but filter select is hardcoded to only show "easyaim"

## 11. ENVIRONMENT / SECRETS (CRITICAL)
File: .env.local (committed to repo — NOT in .gitignore properly? .gitignore excludes .env* but file exists)
Contents include:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (public/anonym key — exposed is okay but should rotate if compromised)
- SESSION_SECRET (private JWT secret)
- SUPABASE_SECRET_KEY (service role — FULL ACCESS)
- EASYAIM_API_KEY (live API key for staging)
- EASYAIM_API_URL
- DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET
- CRON_SECRET
- VERCEL_OIDC_TOKEN (live JWT token for Vercel deployment)

Security Note: All secrets are committed in the repo. The .gitignore excludes .env* but the file is present. The Supabase service-role key and Vercel OIDC token grant significant access. EasyAim API key grants access to staging data.

## 12. DEPLOYMENT
vercel.json:
- Cron job: path /api/easyaim/sync-all, schedule 0 4 * * * (4am daily)
- Protected by Bearer token (CRON_SECRET)

Build passes (per TODO). TypeScript clean. Next.js 16.

## 13. ISSUES / BUGS FOUND
1. BenchmarkClient.tsx line 285: `{energy}` is undefined. Should be `{totalEnergy}`.
2. Benchmarks list page (benchmarks/page.tsx): select filter only has `<option value="easyaim">easyaim</option>` — hardcoded, not using fetched platforms dynamically. Also `platforms` state starts with ["easyaim"] and fetch tries `/api/benchmarks?platform=all` but doesn't pass `platform=all` correctly? Actually `platform` query param works but the select doesn't populate.
3. edit-route.ts exists but isn't used by the edit page (edit page uses `/api/benchmarks/${id}` PUT directly via fetch).
4. Groups page links to platforms but the benchmarks API supports platform filter correctly.
5. Schema inconsistency: supabase-setup.sql uses `text` for easyaim_scenario_id; supabase-final.sql uses `bigint`. Code uses `Number()` conversions but database may enforce bigint.
6. supabase-setup.sql uses `easyaim_scenario_id text` but final uses `bigint`. If DB was set up with setup then migrated, column type mismatch possible.
7. In BenchmarkClient, the `scenarios` array is mapped with `category` but categories come from `benchmark_scenarios.category` — default is 'Other'. The group-by logic (`categories`) uses `scenarios.map(s => s.category || "Other")` which works.
8. `energy` variable missing in BenchmarkClient — this breaks the Energy column display.
9. Duplicate profile links in navigation headers on subpages.
10. `.env.local` contains live secrets committed to repo.

## 14. MISSING FEATURES (From TODO-EVXL.md — 94 lines)
Key missing items:
- Platform/Group Browser (like evxl.app "Browse") — groups page exists but doesn't fully integrate
- Search / Quick Access (Ctrl+K style)
- User Identity / Stats Display (avatar, username, current rank, energy)
- Enhanced benchmark cards (scenario count styling, platform icons, "No Login Required" badge)
- Charts & Comparisons (visual comparison charts, energy metric calculation)
- Scenarios Page (/scenarios) — dedicated page for EasyAim scenarios
- Affiliates (/affiliates)
- Additional pages (leaderboard filters, rank history charts, archive redirect)
- Profile enhancement (Account Center layout, Player Identities, merge accounts)
- Design improvements: exact evxl.app style (angled progress bars, scenario tags with rotated text, clean borders, full-width table, footer)
- Profile link works with both old numeric and new alphanumeric EasyAim IDs (partially handled in parseEasyAimPlayerId)
- Unlink account + confirm dialog (currently just deletes, no confirm dialog in link component — though delete benchmark has confirm)
- Auto-refresh after sync/link/unlink (partially done with router.refresh())
- Responsive layout for mobile
- Performance: lazy loading, pagination
- Recompute aggregates after edit (edit updates benchmark but doesn't trigger aggregate recomputation for all linked accounts; only resets backfill)
- Backfill completes correctly for new alphanumeric IDs (partially handled)
- Sync handles both old /api/v1/players/{id} and new /api/v1/players/by-id/{id} endpoints (implemented in getPlayer)

## 15. ARCHITECTURE SUMMARY
Layers:
- Database (Supabase, service-role writes via supabaseAdmin, public reads via supabase client — though code mainly uses admin for everything)
- Auth / Session (custom JWT cookie, server-only session verification)
- Integration (EasyAim staging API, Discord OAuth)
- Sync Engine (easyaimSync — pulls runs, tracks PBs, computes aggregates, writes benchmark_scores)
- API Routes (REST-like, JSON responses, protected by getSessionAccountId for user-specific actions)
- Pages (App Router: server pages for data fetching, client pages for interactivity)
- Components (ThemeProvider, BenchmarkClient, EasyAimLinkCard, BenchmarkDeleteButton)

Data Flow Example (Score Submission):
User -> BenchmarkClient -> POST /api/scores -> Server verifies session -> reads benchmark thresholds -> calculates rank -> inserts benchmark_scores -> returns new score -> Client shows notice -> reloads page (shows new score in myScores)

Data Flow Example (Sync):
Profile -> syncNow (manual or interval) -> POST /api/easyaim/sync -> getSessionAccountId -> syncEasyAimAccount -> reads EasyAim runs -> updates easyaim_pbs -> recomputes aggregates -> inserts new benchmark_scores if changed -> returns result -> Client shows message / refresh
