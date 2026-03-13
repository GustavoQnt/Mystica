export default function ReadingDetailLoading() {
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
        <div className="max-w-3xl">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--accent)]/10" />
          <div className="mt-6 h-14 max-w-sm animate-pulse rounded-2xl bg-white/5" />
          <div className="mt-6 h-4 max-w-xl animate-pulse rounded bg-white/4" />
        </div>

        {/* Cards skeleton */}
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[480px] animate-pulse rounded-[1.8rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(22,17,37,0.9),rgba(12,10,24,0.82))]"
            />
          ))}
        </div>

        {/* Interpretation skeleton */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(22,17,37,0.9),rgba(12,10,24,0.82))] px-6 py-8">
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--accent)]/10" />
            <div className="mt-4 h-10 w-48 animate-pulse rounded-xl bg-white/5" />
            <div className="mt-8 space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-3 animate-pulse rounded bg-white/4" style={{ width: `${85 - i * 10}%` }} />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-48 animate-pulse rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(22,17,37,0.9),rgba(12,10,24,0.82))]" />
            <div className="h-52 animate-pulse rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(22,17,37,0.9),rgba(12,10,24,0.82))]" />
          </div>
        </div>
      </section>
    </main>
  )
}
