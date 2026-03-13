export default function HistoryLoading() {
  return (
    <main className="mystica-shell">
      {/* Header skeleton */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <div className="h-9 w-28 animate-pulse rounded-lg bg-white/5" />
        <div className="hidden gap-2 md:flex">
          <div className="h-10 w-24 animate-pulse rounded-full bg-white/5" />
          <div className="h-10 w-28 animate-pulse rounded-full bg-white/5" />
          <div className="h-10 w-24 animate-pulse rounded-full bg-white/5" />
        </div>
        <div className="h-10 w-16 animate-pulse rounded-full bg-white/5" />
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-8 md:px-10 md:pt-14">
        {/* Page header skeleton */}
        <div className="max-w-3xl">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--accent)]/10" />
          <div className="mt-6 h-14 max-w-md animate-pulse rounded-2xl bg-white/5" />
          <div className="mt-6 h-4 max-w-sm animate-pulse rounded bg-white/4" />
        </div>

        {/* Reading cards skeleton */}
        <div className="mt-12 grid gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-[1.9rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(22,17,37,0.9),rgba(12,10,24,0.82))] px-6 py-6 md:px-8"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl flex-1">
                  <div className="h-3 w-36 animate-pulse rounded bg-white/5" />
                  <div className="mt-4 h-8 max-w-lg animate-pulse rounded-lg bg-white/5" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-white/4" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-white/4" />
                  </div>
                </div>
                <div className="flex gap-3">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-24 w-16 animate-pulse rounded-[1.3rem] bg-white/5" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
