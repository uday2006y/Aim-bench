import { redirect } from "next/navigation";

import { loadTiers } from "@/lib/tiers";
import { tierHref } from "@/lib/benchmarkTiers";

/**
 * `/benchmarks/<id>` forwards to the benchmark's first tier.
 *
 * The tier is part of the address — `/benchmarks/<id>/novice` — because which
 * ladder you are looking at changes what every column means, and a link that
 * does not say which one is not a link to anything in particular. This keeps
 * the old url working, so links already shared still land somewhere real,
 * while making the switcher's "current" pill unambiguous.
 *
 * One query. No session read: the tier page needs one anyway and doing it here
 * as well would be a round trip for a redirect.
 */
export default async function BenchmarkRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tiers = await loadTiers(id);

  // No tiers means a database that has not had the tier block run. The tier
  // page explains that in words; sending it there beats a bare "not found".
  const slug = tiers[0]?.slug ?? "primary";

  redirect(tierHref(id, slug));
}
