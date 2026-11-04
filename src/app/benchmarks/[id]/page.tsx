import BenchmarkTierView from "./BenchmarkTierView";

/**
 * `/benchmarks/<id>` shows the benchmark's first tier directly.
 *
 * It used to look the tiers up and redirect to `/benchmarks/<id>/<tier>`,
 * which put a whole extra request in front of every benchmark page, and every
 * link on the site (home, the list, the profile) goes through here. The tier
 * pills still link to the explicit per-tier addresses.
 */
export default async function BenchmarkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BenchmarkTierView id={id} />;
}
