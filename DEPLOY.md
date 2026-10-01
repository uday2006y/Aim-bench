# AIMBENCH — BUILD & VERCEL DEPLOY

## Build status

```
npm test          # 46 tests, Node's built-in runner, no dependencies
npx tsc --noEmit  # must be clean
npm run lint      # must be clean
npm run build     # must compile
```

All four are clean as of the commit that last touched this file. If any of
them is not, the build is not ready to ship — the lint baseline used to be
"42 errors, ignore them" and that habit is over.

## Deploy

1. **Schema first.** Run `supabase-verify.sql` (read-only) against the target
   database and read the output. If sections 1–3 report MISSING, run the
   matching `.sql` file. If section 7 reports `bigint` or `integer`, run the
   type block at the bottom of `supabase-final.sql` — scores are being
   rounded and alphanumeric ids will be rejected until you do.

2. Push. `.env*` is gitignored and `.env.local` holds template values only.

3. In Vercel → Project → Settings → Environment Variables:

   | Variable | Notes |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Not used by any code path — see below |
   | `SESSION_SECRET` | Rotating this signs everyone out |
   | `SUPABASE_SECRET_KEY` | Service role. Full database access |
   | `EASYAIM_API_URL` | Defaults to staging if unset |
   | `EASYAIM_API_KEY` | |
   | `CRON_SECRET` | Guards `/api/easyaim/sync-all`. Rotate to re-authorise the cron |
   | `DISCORD_CLIENT_ID` | |
   | `DISCORD_CLIENT_SECRET` | |

4. Build command `npm run build`, deploy.

5. Confirm the cron is live: Vercel → Project → Cron Jobs. It runs
   `/api/easyaim/sync-all` daily at 04:00 UTC. The response tells you how
   many accounts it attempted and whether it `caughtUp` — if `caughtUp` is
   false, the community has outgrown one run and it will keep working through
   the backlog, just not all in one night.

### `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is not needed

Nothing imports the anon client any more. There used to be a
`src/lib/supabase.ts` building one, which is deleted. The app talks to
Supabase only through the service-role client on the server, so this variable
can go. Kept in the table above because removing an env var from a running
project is a change with its own blast radius — do it when convenient, not as
part of a deploy.

## Discord OAuth redirect URIs

Register both, then drop the old one:

```
https://<your-domain>/api/auth/discord/callback
https://aim-bench.vercel.app/api/auth/discord/callback   (temporary)
```

## Cron timing

`/api/easyaim/sync-all` declares `maxDuration = 300` and syncs at most 100
accounts per run, five at a time, oldest-sync-first. On a Hobby plan Vercel
caps the function below that; the run is written so that being cut short costs
latency rather than correctness — whoever is left gets picked up first next
time. If `caughtUp` is consistently false, raise `BATCH_SIZE` or add a second
cron entry.

## Security notes

- **`.env.local` is a template.** It has never been committed; `.gitignore`
  covers `.env*`. Earlier versions of this project's docs claimed live
  secrets were in the repository — that was wrong, and the claim has been
  removed rather than left for someone to act on.
- **Historical note:** live secrets *were* once committed, before the git
  history was cleaned. The keys from that era were rotated at the time. If you
  are deploying from a fork or a restored backup, rotate `SUPABASE_SECRET_KEY`,
  `EASYAIM_API_KEY`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` and
  `CRON_SECRET` before anything else.
- **RLS is the security model.** Every table has RLS enabled and no policies,
  so the anon key is useless against the database while the service-role client
  bypasses it. `benchmark_pin_totals` is `security_invoker = on` — without
  that the view is `SECURITY DEFINER` and exposes every pin row through the
  anon key. Section 4 of `supabase-verify.sql` checks both.
- **Rate limiting is best-effort.** `src/lib/throttle.ts` is a per-instance
  in-memory counter. It stops a script hammering one warm function and nothing
  more. A real limit needs a shared store or a WAF rule; see the handoff.
