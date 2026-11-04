/**
 * Shown the instant a page is navigated to, while the server works out the
 * real one. Next prefetches this shell with the link, so the click answers
 * immediately and the content fills in behind it.
 */
export default function Loading() {
  return (
    <main className="min-h-screen text-white" aria-busy="true">
      <div className="mx-auto max-w-7xl px-6 pt-8">
        <div className="h-9 w-44 animate-pulse rounded-lg bg-white/10" />

        <div className="mt-14 space-y-3">
          <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-white/10" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-white/5" />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
