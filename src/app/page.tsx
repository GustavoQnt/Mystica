import Link from 'next/link'
import { Suspense } from 'react'

import { AppHeader } from '@/components/AppHeader'
import { AdviceSection, RecentReadingsSection } from './sections'

function AdviceSkeleton() {
  return (
    <div className="mystica-panel mystica-fade-up mx-auto max-w-3xl rounded-[2rem] px-8 py-14">
      <div className="mx-auto h-3 w-28 animate-pulse rounded bg-[var(--accent)]/10" />
      <div className="mx-auto mt-6 h-12 max-w-md animate-pulse rounded-xl bg-white/5" />
      <div className="mx-auto mt-6 h-4 max-w-sm animate-pulse rounded bg-white/4" />
    </div>
  )
}

function ReadingsSkeleton() {
  return (
    <div className="mt-8 grid gap-5 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="mystica-panel rounded-[1.7rem] p-6"
        >
          <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
          <div className="mt-4 h-8 w-32 animate-pulse rounded-lg bg-white/5" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-white/4" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-white/4" />
          </div>
          <div className="mt-6 flex gap-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-20 w-14 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="mystica-shell">
      <AppHeader />

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-8 md:px-10 md:pt-14">
        {/* Hero — renders INSTANTLY, no data needed */}
        <div className="mystica-fade-up text-center">
          <p className="mystica-label">Santuário pessoal</p>
          <h1 className="font-display mx-auto mt-6 max-w-4xl text-6xl leading-[0.92] text-[var(--foreground)] md:text-8xl">
            Um espaço silencioso para ouvir o que insiste em querer nascer.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
            Mystica guarda a memória das suas tiragens e devolve o conselho
            essencial com calma, contexto e precisão ritual.
          </p>
        </div>

        {/* Advice — streams in when data is ready */}
        <div className="mt-14">
          <Suspense fallback={<AdviceSkeleton />}>
            <AdviceSection />
          </Suspense>
        </div>

        {/* CTA — renders INSTANTLY */}
        <div className="mt-14 flex justify-center">
          <Link
            href="/reading"
            className="rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-semibold text-[#1d1406]"
          >
            Abrir nova tiragem
          </Link>
        </div>

        {/* Recent readings — streams in when data is ready */}
        <section className="mt-20">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="mystica-label">Memória recente</p>
              <h2 className="font-display mt-4 text-4xl text-[var(--foreground)]">
                Seus últimos sinais
              </h2>
            </div>
            <Link href="/history" className="text-sm text-[var(--accent)]">
              Ver histórico completo
            </Link>
          </div>

          <Suspense fallback={<ReadingsSkeleton />}>
            <RecentReadingsSection />
          </Suspense>
        </section>
      </section>
    </main>
  )
}
