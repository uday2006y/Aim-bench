# AIMBENCH

A community aim-benchmark leaderboard. Benchmarks are built from EasyAim
scenarios with a score cutoff per rank tier; scores come from the EasyAim API,
never from anyone typing a number in. Live at `aim-bench.vercel.app`.

## Running it

```
npm install
npm run dev        # http://localhost:3000
```

**The database is not reachable from a local checkout.** `.env.local` holds
template values; the real secrets live in Vercel's environment. Any code path
that touches Supabase will fail locally by design. Verify database-dependent
work by deploying, or by asking the user to run SQL and paste the output.

## Checks

```
npm test           # Node's built-in runner, no test framework installed
npx tsc --noEmit
npm run lint
npm run build
```

All four are expected to be clean. See `SESSION-HANDOFF.md` for what the
architecture is and why, and `DEPLOY.md` for shipping it.

## Reading the code

Start with `SESSION-HANDOFF.md`. It explains the one rule that matters most —
there is a single rank calculation, in `src/lib/aggregates.ts`, and everything
else calls it.

| Path | What |
|---|---|
| `src/lib/aggregates.ts` | The rank walk. Pure, tested, the only one |
| `src/lib/tierBars.ts` | How full each rank's bar draws. Pure, tested |
| `src/lib/benchmarkScenarios.ts` | Input normalisation for the create/edit forms. Pure, tested |
| `src/lib/leaderboard.ts` | Standings, computed from personal bests |
| `src/lib/easyaimSync.ts` | Pulls runs from EasyAim, records bests, writes history |
| `src/app/` | Pages and route handlers |
| `supabase-*.sql` | Schema, migrations, and a read-only verification script |
