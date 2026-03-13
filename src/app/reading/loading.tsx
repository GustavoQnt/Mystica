export default function ReadingLoading() {
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
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto h-3 w-24 animate-pulse rounded bg-[var(--accent)]/10" />
          <div className="mx-auto mt-6 h-14 max-w-xl animate-pulse rounded-2xl bg-white/5" />
          <div className="mx-auto mt-6 h-4 max-w-sm animate-pulse rounded bg-white/4" />
        </div>

        {/* Form skeleton */}
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(22,17,37,0.9),rgba(12,10,24,0.82))] px-6 py-8 md:px-8 md:py-10">
            <div className="grid gap-8">
              <div>
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--accent)]/10" />
                <div className="mt-3 h-40 animate-pulse rounded-[1.5rem] bg-white/4" />
              </div>
              <div>
                <div className="h-3 w-28 animate-pulse rounded bg-[var(--accent)]/10" />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="h-24 animate-pulse rounded-[1.6rem] bg-white/5" />
                  <div className="h-24 animate-pulse rounded-[1.6rem] bg-white/5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
