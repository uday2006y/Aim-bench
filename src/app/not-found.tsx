import Link from "next/link";

/**
 * Shown for any URL that does not match a route.
 *
 * Note that `notFound()` is not the only thing that lands here. The benchmark
 * detail page renders its own "Benchmark not found" state for a missing row,
 * because it has to distinguish that from a database failure and say which
 * happened.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-app text-white">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.25em] text-zinc-600">
          404
        </p>

        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          There is nothing here
        </h1>

        <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">
          That address does not match anything on AIMBENCH. It may have been a
          benchmark that was deleted, or a link with a typo in it.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/benchmarks"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Browse benchmarks
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
