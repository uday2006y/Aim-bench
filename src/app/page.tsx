import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";
import { loadTopPinned } from "@/lib/pins";
import SiteHeader from "@/components/SiteHeader";

interface BenchmarkCard {
  id: string;
  title: string;
  platform: string;
  scenario_count: number | null;
  created_at: string | null;
  pin_count: number;
}

const FEATURED_LIMIT = 4;
const CARD_SCAN_LIMIT = 500;

export default async function Home() {
  const accountId = await getSessionAccountId();
  const [pinTotals, cardResult] = await Promise.all([
    loadTopPinned(),
    supabaseAdmin
      .from("benchmarks")
      .select("id, title, platform, scenario_count, created_at")
      .order("created_at", { ascending: false })
      .limit(CARD_SCAN_LIMIT),
  ]);

  const pinCountById = new Map(pinTotals.map((entry) => [entry.id, entry.pin_count]));
  const benchmarks: BenchmarkCard[] = (cardResult.data || [])
    .map((row) => ({
      ...(row as Omit<BenchmarkCard, "pin_count">),
      pin_count: pinCountById.get((row as { id: string }).id) ?? 0,
    }))
    .filter((card) => card.pin_count > 0)
    .sort((a, b) => b.pin_count - a.pin_count || new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, FEATURED_LIMIT);

  return (
    <main className="site-shell min-h-screen text-white">
      <SiteHeader loggedIn={Boolean(accountId)} />
      <div className="site-content">
        <section className="home-hero">
          <div className="hero-copy">
            <p className="eyebrow">Aim performance, made measurable</p>
            <h1>Turn every session into a <em>signal.</em></h1>
            <p className="hero-lede">AIMBENCH is the open benchmark platform for players who want to practice with intent, compare with context, and see real progress.</p>
            <div className="hero-actions">
              <Link href="/benchmarks" className="btn btn-primary">Explore benchmarks <span aria-hidden="true">↗</span></Link>
              <Link href="/create-benchmark" className="btn btn-ghost">Build a benchmark</Link>
            </div>
            <div className="hero-proof" aria-label="AIMBENCH highlights">
              <span><strong>01</strong> Curated scenarios</span>
              <span><strong>02</strong> Community scores</span>
              <span><strong>03</strong> Progress history</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="target-ring ring-one" />
            <div className="target-ring ring-two" />
            <div className="target-ring ring-three" />
            <div className="target-crosshair horizontal" />
            <div className="target-crosshair vertical" />
            <span className="target-dot" />
            <span className="visual-label label-top">CALIBRATE / 001</span>
            <span className="visual-label label-bottom">PRECISION OVER REPETITION</span>
            <span className="visual-score">98<span>%</span></span>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div><p className="eyebrow">Community signal</p><h2>Benchmarks worth your time.</h2></div>
            <Link href="/benchmarks" className="text-link">View the full library <span aria-hidden="true">→</span></Link>
          </div>
          {benchmarks.length === 0 ? (
            <div className="empty-state"><p>No benchmarks have been starred yet.</p><Link href="/benchmarks" className="text-link">Browse the library →</Link></div>
          ) : (
            <div className="benchmark-grid">
              {benchmarks.map((benchmark, index) => (
                <Link key={benchmark.id} href={`/benchmarks/${benchmark.id}`} className="benchmark-card">
                  <div className="card-index">0{index + 1}</div>
                  <div className="card-meta"><span>{benchmark.platform}</span><span className="star">★ {benchmark.pin_count}</span></div>
                  <h3>{benchmark.title}</h3>
                  <p>{benchmark.scenario_count ?? 1} scenario{(benchmark.scenario_count ?? 1) === 1 ? "" : "s"}</p>
                  <span className="card-arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="home-cta">
          <div><p className="eyebrow">Make the next rep count</p><h2>Your best score is a starting point.</h2></div>
          <Link href="/create-benchmark" className="btn btn-primary">Create your benchmark <span aria-hidden="true">↗</span></Link>
        </section>
      </div>
    </main>
  );
}
