import { Suspense } from 'react'

import { AppHeader } from '@/components/AppHeader'
import { HistoryListSection } from './sections'

function HistoryListSkeleton() {
  return (
    <div className="mt-12 grid gap-5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="mystica-panel rounded-[1.9rem] px-6 py-6 md:px-8"
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
  )
}

export default function HistoryPage() {
  return (
    <main className="mystica-shell">
      <AppHeader />

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-8 md:px-10 md:pt-14">
        {/* Header — renders INSTANTLY, no data needed */}
        <div className="mystica-fade-up max-w-3xl">
          <p className="mystica-label">Arquivo ritual</p>
          <h1 className="font-display mt-5 text-5xl leading-none text-[var(--foreground)] md:text-7xl">
            Histórico de leituras
          </h1>
          <p className="mt-6 text-sm leading-7 text-[var(--muted)] md:text-base">
            Um rastro claro das perguntas que já atravessaram você.
          </p>
        </div>

        {/* Reading list — streams in when data is ready */}
        <Suspense fallback={<HistoryListSkeleton />}>
          <HistoryListSection />
        </Suspense>
      </section>
    </main>
  )
}
