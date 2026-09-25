import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EasyAimLinkCard, type EasyAimLinkInfo } from "./easyaim-link";
import BenchmarkDeleteButton from "./benchmark-delete";

interface AccountRow {
  username: string;
  created_at: string;
}

interface ScenarioTitleRow {
  easyaim_scenario_id: number;
  title: string;
}

interface PbRow {
  scenario_id: number;
  score: number;
  achieved_at: string;
}

export default async function ProfilePage() {
  const accountId = await getSessionAccountId();

  if (!accountId) {
    redirect("/login");
  }

  const { data: accountData } = await supabaseAdmin
    .from("accounts")
    .select("username, created_at")
    .eq("id", accountId)
    .maybeSingle();

  const account = accountData as AccountRow | null;

  const { data: linkData } = await supabaseAdmin
    .from("easyaim_links")
    .select(
      "easyaim_player_id, easyaim_username, display_name, avatar_url, last_synced_at, backfill_done"
    )
    .eq("account_id", accountId)
    .maybeSingle();

  const link = (linkData as EasyAimLinkInfo | null) ?? null;

  // PBs are stored per scenario; look up the names of the scenarios that
  // benchmarks actually use.
  const { data: scenarioRows } = await supabaseAdmin
    .from("benchmark_scenarios")
    .select("easyaim_scenario_id, title");

  const scenarioTitles = new Map<number, string>();
  for (const row of scenarioRows || []) {
    const scenario = row as ScenarioTitleRow;
    if (!scenarioTitles.has(scenario.easyaim_scenario_id)) {
      scenarioTitles.set(scenario.easyaim_scenario_id, scenario.title);
    }
  }

  const { data: pbRows } = await supabaseAdmin
    .from("easyaim_pbs")
    .select("scenario_id, score, achieved_at")
    .eq("account_id", accountId)
    .order("achieved_at", { ascending: false })
    .limit(200);

  const pbs = (pbRows || []).map((row) => {
    const pb = row as PbRow;
    return {
      scenarioId: pb.scenario_id,
      title: scenarioTitles.get(pb.scenario_id) || `Scenario ${pb.scenario_id}`,
      score: pb.score,
      achievedAt: pb.achieved_at,
    };
  });

  const { data: userBenchmarks } = await supabaseAdmin
    .from("benchmarks")
    .select("id, title, description, platform, difficulty, scenario_count, created_at")
    .eq("user_id", accountId)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* HEADER */}
        <header className="border-b border-white/10 mb-8">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
            <Link href="/" className="text-xl font-bold tracking-tight">
              AIM<span className="text-zinc-500">BENCH</span>
            </Link>

            <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
              <Link href="/benchmarks" className="hover:text-white">Benchmarks</Link>
              <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
              <Link href="/rank-history" className="hover:text-white">Rank History</Link>
              <Link href="/profile" className="text-white">Profile</Link>
            </nav>

            <div className="flex gap-3">
              <Link
                href="/profile"
                className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white"
              >
                Profile
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Log Out
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* ACCOUNT */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {account?.username || "Player"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Member since{" "}
            {account?.created_at
              ? new Date(account.created_at).toLocaleDateString()
              : "—"}
          </p>
        </div>

        {/* EASYAIM LINK */}
        <EasyAimLinkCard link={link} />

        {/* PBs */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-semibold mb-4">EasyAim personal bests</h2>

          {pbs.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No personal bests yet. Link your EasyAim account and play
              scenarios that are part of a benchmark to populate this list.
            </p>
          ) : (
            <div>
              {pbs.map((pb) => (
                <div
                  key={pb.scenarioId}
                  className="flex items-center justify-between border-b border-white/10 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{pb.title}</p>
                    <p className="text-xs text-zinc-600">
                      {new Date(pb.achievedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="ml-4 font-semibold">{pb.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* USER BENCHMARKS */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-semibold mb-4">Your benchmarks</h2>
          {!userBenchmarks || userBenchmarks.length === 0 ? (
            <p className="text-sm text-zinc-500">No benchmarks yet.</p>
          ) : (
            <div className="space-y-3">
              {(userBenchmarks || []).map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium truncate max-w-[300px]">{b.title}</p>
                    <p className="text-xs text-zinc-500">
                      {b.platform || "—"} · {b.scenario_count || 0} scenario{b.scenario_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/benchmarks/${b.id}`} className="text-xs text-zinc-400 hover:text-white underline">View</Link>
                    <Link href={`/benchmarks/${b.id}/edit`} className="text-xs text-cyan-400 hover:text-cyan-300 underline">Edit</Link>
                    <BenchmarkDeleteButton benchmarkId={b.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}