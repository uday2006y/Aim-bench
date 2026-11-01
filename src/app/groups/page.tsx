import Link from "next/link";

const GROUPS = [
  { name: "KovaaK's", link: "/benchmarks?platform=kovaiacks", desc: "The original aim trainer benchmark platform." },
  { name: "Aimbeast", link: "/benchmarks?platform=aimbeast", desc: "Aim training with custom scenarios." },
  { name: "AIMCORE", link: "/benchmarks?platform=aimcore", desc: "Core aim mechanics and reflex training." },
  { name: "Aimerz+", link: "/benchmarks?platform=aimerzplus", desc: "Advanced aim patterns and routines." },
  { name: "cAt", link: "/benchmarks?platform=cat", desc: "Community aim trainer scenarios." },
  { name: "Continium", link: "/benchmarks?platform=continium", desc: "Continuous tracking benchmarks." },
  { name: "cryoAlchemists", link: "/benchmarks?platform=cryoalchemists", desc: "Frozen aim mechanics testing." },
  { name: "Jade Palace", link: "/benchmarks?platform=jade-palace", desc: "Precision and accuracy benchmarks." },
  { name: "Meowcoholics", link: "/benchmarks?platform=meowcoholics", desc: "Fun and competitive aim tracking." },
  { name: "MIRA", link: "/benchmarks?platform=mira", desc: "Mirror-based reflex training." },
  { name: "Point Zero", link: "/benchmarks?platform=point-zero", desc: "Starting from base mechanics." },
  { name: "Raw Input", link: "/benchmarks?platform=raw-input", desc: "Unfiltered input tracking." },
  { name: "REVENGE", link: "/benchmarks?platform=revenge", desc: "Competitive scenario benchmarks." },
  { name: "Revosect", link: "/benchmarks?platform=revosect", desc: "Section-based aim tracking." },
  { name: "RXZU", link: "/benchmarks?platform=rxzu", desc: "Rapid execution zone benchmarks." },
  { name: "Snakbox", link: "/benchmarks?platform=snakbox", desc: "Snake-pattern aim scenarios." },
  { name: "Stellar", link: "/benchmarks?platform=stellar", desc: "Star-level precision tracking." },
  { name: "Tosoku", link: "/benchmarks?platform=tosoku", desc: "Traditional aim mechanics." },
  { name: "Voltaic", link: "/benchmarks?platform=voltaic", desc: "Electric reflex benchmarks." },
  { name: "Worst Aimers", link: "/benchmarks?platform=worst-aimers", desc: "Beginner-friendly benchmarks." },
  { name: "XYZ", link: "/benchmarks?platform=xyz", desc: "Experimental tracking benchmarks." },
];

export default function GroupsPage() {
  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="border-b border-white/10 mb-8">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link href="/" className="text-xl font-bold tracking-tight">
              AIM<span className="text-zinc-500">BENCH</span>
            </Link>
            <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
              <Link href="/benchmarks" className="hover:text-white">Benchmarks</Link>
              <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
              <Link href="/rank-history" className="hover:text-white">Rank History</Link>
              <Link href="/groups" className="text-white">Groups</Link>
            </nav>
            <Link href="/profile" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">Profile</Link>
          </div>
        </header>
        <Link href="/" className="text-sm text-zinc-500 hover:text-white transition mb-8 inline-block">← Back</Link>
        <h1 className="text-5xl font-extrabold tracking-tight mb-4">Browse Groups</h1>
        <p className="text-lg text-zinc-400 mb-12 max-w-2xl">Select an aim trainer platform to view benchmarks made for that community.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {GROUPS.map((g) => (
            <Link
              key={g.name}
              href={g.link}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.05] hover:-translate-y-0.5 shadow-lg hover:shadow-2xl"
            >
              <h3 className="text-lg font-bold tracking-tight mb-1">{g.name}</h3>
              <p className="text-xs text-zinc-500">{g.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
