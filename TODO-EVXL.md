# AIMBENCH Feature Todo — Based on evxl.app (https://evxl.app/)

## CORE / ALREADY DONE
- [x] Next.js 16 app with dark theme, Tailwind CSS v4
- [x] Custom auth (username + bcrypt + JWT cookie session) — NOT Supabase Auth
- [x] Supabase DB with RLS policies, service-role writes
- [x] Benchmark creation (title, description, difficulty, platform, scenarios with cutoffs)
- [x] Benchmark listing (/benchmarks) with search + filter
- [x] Benchmark detail (/benchmarks/[id]) with scenario progress bars, rank display
- [x] Score submission + score history per user
- [x] Leaderboard (/leaderboard) — best score per user per benchmark, sorted by rank_index
- [x] Rank history (/rank-history) — previous vs new score/rank per benchmark
- [x] Profile page (/profile) with account info, EasyAim link, PB list
- [x] EasyAim integration (link account, sync PBs, scenario search, backfill)
- [x] Theme settings (/theme-settings) with color picker (bg/text/accent), localStorage persistence
- [x] Edit benchmark (/benchmarks/[id]/edit) — future-proof with scenario add/remove/update, platform, difficulty
- [x] SQLite / Supabase schema supports text IDs (new alphanumeric EasyAim format like 692fc9afe296376b3bdceed2)
- [x] Deployment on Vercel with vercel.json cron (sync-all at 4am)
- [x] Build passes, TypeScript clean

## MISSING FROM EVXL.APP — HIGH PRIORITY
### 1. Platform / Group Browser (like evxl.app "Browse")
- [ ] Add groups/pages for each aim trainer platform: KovaaK's, Aimbeast, AIMCORE, Aimerz+, cAt, Continium, cryoAlchemists, Jade Palace, Meowcoholics, MIRA, Point Zero, Raw Input, REVENGE, Revosect, RXZU, Snakbox, Stellar, Tosoku, Voltaic, Worst Aimers, XYZ
- [ ] Each group shows benchmarks using that platform
- [ ] Navigation link from homepage

### 2. Search / Quick Access (Ctrl+K style)
- [ ] Search bar that searches benchmarks, users, scenarios by title or ID
- [ ] Keyboard shortcut (Ctrl+K) to open quick search modal
- [ ] Example input format shown: Steam ID (17-digit), Vanity ID, Profile URL

### 3. User Identity / Stats Display (like evxl.app profile cards)
- [ ] On benchmark detail: show user avatar, username, current rank, energy/score
- [ ] Add "Compare scores with friends" section
- [ ] Show aggregate stats per user (total benchmarks, best rank, energy)

### 4. Benchmark Cards on Home (enhanced like evxl.app)
- [ ] Each benchmark card shows scenario count with better styling
- [ ] Add "No Login Required" label/badge for public benchmarks
- [ ] Add platform icons (KovaaKs, Aimbeast) on cards

### 5. Charts & Comparisons
- [ ] Visual comparison charts between users for same benchmark (bar charts, radar charts)
- [ ] Energy metric calculation (like evxl.app energy column)

### 6. Scenarios Page (/scenarios)
- [ ] Dedicated page listing all EasyAim scenarios with descriptions, difficulty, plays
- [ ] Link each scenario back to benchmarks that use it

### 7. Affiliates (/affiliates)
- [ ] Page or section listing affiliate links / partners

### 8. Additional Pages (evxl.app links)
- [ ] Leaderboards with filter options (per benchmark, per platform)
- [ ] Rank History with chart visualization
- [ ] Scenarios page (dedicated)
- [ ] Affiliates page
- [ ] Old Site redirect / archive reference

### 9. Profile Enhancement
- [ ] Show "Account Center" style layout (avatar + stats row: account ID, member since, connected platforms, linked accounts count)
- [ ] Show "Player Identities" section (connected accounts with update/delete)
- [ ] Show additional identity management (merge accounts, add identity)

### 10. Design / Visual Improvements (evxl.app exact style copy)
- [ ] Benchmark detail table: angled progress bars per scenario with exact colors (cyan gradient, dark gray empty)
- [ ] Scenario tags with "SCENARIO" label (vertical rotated text on left, like evxl.app)
- [ ] Score percentage display next to score
- [ ] Energy column showing aggregate energy
- [ ] Rank columns: Platinum, Diamond, Jade, Master, etc. with colored headers and progress bars
- [ ] Full-width table layout on 1920x1080 (no empty right space)
- [ ] Clean dark card borders, consistent rounded corners (rounded-3xl), shadow-2xl
- [ ] Navigation bar styling exactly like evxl.app (back arrow, tabs, buttons on right)
- [ ] Footer: copyright, Discord server link, support/donate button

### 11. Functionality / UX
- [ ] Profile link works with both old numeric and new alphanumeric EasyAim IDs
- [ ] Unlink account + confirm dialog
- [ ] Auto-refresh after sync/link/unlink
- [ ] Error messages exactly like evxl.app ("Invalid OAuth2 redirect_uri", clean error states)
- [ ] Responsive layout for mobile (table scroll, grid adjustments)
- [ ] Performance: lazy loading for benchmark images/cards, pagination for large scenario lists

### 12. Data Integrity / Sync
- [ ] Ensure edit benchmark updates `scenario_count`, `benchmark_scenarios`, and `benchmark_scores` when scenarios change
- [ ] Recompute aggregates after edit
- [ ] Backfill completes correctly for new alphanumeric player IDs
- [ ] Sync handles both old `/api/v1/players/{id}` and new `/api/v1/players/by-id/{id}` endpoints

### 13. Security / Environment
- [ ] Confirm `.env.local` secrets are secure (not committed)
- [ ] Discord OAuth redirect URI updated for production (`https://aim-bench.vercel.app`)
- [ ] RLS policies work with new `text` columns
- [ ] All routes protected with session verification
