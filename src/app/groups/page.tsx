import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

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
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Browse Groups</h1>
        <p className="mb-8 max-w-2xl text-base text-zinc-400 sm:mb-12 sm:text-lg">
          Select an aim trainer platform to view benchmarks made for that
          community.
        </p>

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
