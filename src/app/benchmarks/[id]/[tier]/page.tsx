import BenchmarkTierView from "../BenchmarkTierView";

/** One tier of a benchmark: `/benchmarks/<id>/<tier>`. */
export default async function BenchmarkTierPage({
  params,
}: {
  params: Promise<{ id: string; tier: string }>;
}) {
  const { id, tier } = await params;

  return <BenchmarkTierView id={id} tierSlug={tier} />;
}
