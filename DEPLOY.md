# AIMBENCH — BUILD & VERCEL DEPLOY

## Build Status
✓ `npm run build` passes (Next.js 16.3.5, TypeScript clean)

## What was fixed (minimum for build/export)
- BenchmarkClient.tsx: restored from broken JSX, fixed `energy` -> `totalEnergy`, replaced broken fragment syntax with `Fragment`, added missing closing tags (`</main>`, etc.)
- .env.local: stripped live secrets, replaced with template (DO NOT COMMIT real values)
- supabase-setup.sql + supabase-final.sql: aligned `easyaim_scenario_id` and other fields to `bigint`
- benchmarks/page.tsx: removed duplicate profile links, made platform filter dynamic
- groups/page.tsx: added basic header/navigation
- profile/page.tsx: added basic stats cards, removed duplicate profile links
- leaderboard/page.tsx + rank-history/page.tsx: removed duplicate profile links
- Deleted unused `edit-route.ts`

## Deploy to Vercel
1. Push code to repo (without real `.env.local` — it is ignored by `.gitignore`)
2. In Vercel dashboard → Project → Settings → Environment Variables, add all secrets from `.env.local` template:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   - SESSION_SECRET
   - EASYAIM_API_URL
   - EASYAIM_API_KEY
   - CRON_SECRET
   - SUPABASE_SECRET_KEY
   - DISCORD_CLIENT_ID
   - DISCORD_CLIENT_SECRET
3. In Vercel dashboard → Project → Settings → General → Build Command: `npm run build`
4. Deploy
5. Verify cron job is configured in `vercel.json` (`/api/easyaim/sync-all` at 4am)

## Security Note
Previous `.env.local` contained live secrets (Supabase service role, EasyAim API key, Discord client secret, Vercel OIDC token, session secret). Those keys must be rotated/revoked in their respective services (Supabase, EasyAim, Discord, Vercel) since they were previously exposed.
