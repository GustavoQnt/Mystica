'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { AppHeader } from '@/components/AppHeader'
import { CardReveal } from '@/components/CardReveal'
import { ReadingStream } from '@/components/ReadingStream'
import type { ReadingMetadata } from '@/lib/gemini'
import type { SpreadType } from '@/lib/tarot'

interface ReadingRecord {
  id: string
  status: 'drawn' | 'completed' | 'failed'
  spread_type: SpreadType
  question: string
  card_ids?: number[]
  interpretation?: string | null
  metadata?: ReadingMetadata | null
}

export default function ReadingDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [reading, setReading] = useState<ReadingRecord | null>(null)
  const [cardIds, setCardIds] = useState<number[]>([])
  const [spreadType, setSpreadType] = useState<SpreadType>('tres-cartas')
  const [loading, setLoading] = useState(true)
  const [streamKey, setStreamKey] = useState(0)
  const [streamError, setStreamError] = useState<string | null>(null)

  useEffect(() => {
    async function loadReading() {
      setLoading(true)

      const response = await fetch(`/api/reading/${params.id}`)
      if (!response.ok) {
        router.replace('/reading')
        return
      }

      const data = (await response.json()) as { reading: ReadingRecord }
      setReading(data.reading)
      setSpreadType(data.reading.spread_type)
      setCardIds(data.reading.card_ids ?? [])
      setLoading(false)
    }

    loadReading()
  }, [params.id, router])

  async function refreshReading() {
    const response = await fetch(`/api/reading/${params.id}`)
    if (!response.ok) {
      return
    }

    const data = (await response.json()) as { reading: ReadingRecord }
    setReading(data.reading)
    setSpreadType(data.reading.spread_type)
    setCardIds(data.reading.card_ids ?? cardIds)
  }

  if (loading || !reading) {
    return (
      <main className="mystica-shell">
        <AppHeader />
        <section className="mx-auto max-w-3xl px-6 py-28 text-center text-[var(--muted)]">
          Preparando o círculo da leitura...
        </section>
      </main>
    )
  }

  const advice = reading.metadata?.next_step_advice
  const shouldStream = reading.status !== 'completed' || !reading.interpretation

  return (
    <main className="mystica-shell">
      <AppHeader />

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-8 md:px-10 md:pt-14">
        <div className="mystica-fade-up max-w-3xl">
          <p className="mystica-label">Leitura selada</p>
          <h1 className="font-display mt-5 text-5xl leading-none text-[var(--foreground)] md:text-7xl">
            {reading.spread_type === 'tres-cartas' ? 'Três cartas' : 'Carta do dia'}
          </h1>
          <p className="mt-6 text-sm leading-7 text-[var(--muted)] md:text-base">
            {reading.question}
          </p>
        </div>

        {cardIds.length > 0 ? (
          <section className="mt-12">
            <CardReveal cardIds={cardIds} spreadType={spreadType} />
          </section>
        ) : (
          <section className="mystica-panel mystica-fade-up mt-12 rounded-[2rem] px-8 py-14 text-center">
            <p className="mystica-label">Revelação</p>
            <p className="mt-5 text-sm text-[var(--muted)]">
              As cartas vão se mostrar no primeiro sopro do oráculo.
            </p>
          </section>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {shouldStream ? (
            <ReadingStream
              key={streamKey}
              readingId={reading.id}
              onCards={(payload) => {
                setCardIds(payload.card_ids)
                setSpreadType(payload.spread_type)
                setStreamError(null)
              }}
              onComplete={() => {
                setStreamError(null)
                void refreshReading()
                window.setTimeout(() => {
                  void refreshReading()
                }, 1200)
              }}
              onError={(message) => setStreamError(message)}
            />
          ) : (
            <section className="mystica-panel rounded-[2rem] px-6 py-8 md:px-8">
              <p className="mystica-label">Interpretação</p>
              <h2 className="font-display mt-3 text-4xl text-[var(--foreground)]">
                A voz do oráculo
              </h2>
              <div className="mystica-scroll mt-8 max-h-[420px] overflow-y-auto pr-2">
                <p className="text-sm leading-8 text-[var(--foreground)]/92 md:text-[15px]">
                  {reading.interpretation}
                </p>
              </div>
            </section>
          )}

          <aside className="space-y-6">
            <section className="mystica-panel rounded-[2rem] px-6 py-7">
              <p className="mystica-label">Conselho prático</p>
              {advice ? (
                <>
                  <h2 className="font-display mt-4 text-3xl text-[var(--accent)]">
                    {advice.action}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                    {advice.why}
                  </p>
                  <p className="mt-5 text-xs uppercase tracking-[0.3em] text-[var(--accent)]">
                    {advice.timing}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                  O conselho surgirá assim que a leitura terminar de se assentar.
                </p>
              )}
            </section>

            <section className="mystica-panel rounded-[2rem] px-6 py-7">
              <p className="mystica-label">Próximo gesto</p>
              <div className="mt-5 grid gap-3">
                <Link
                  href="/reading"
                  className="rounded-full bg-[var(--accent)] px-5 py-3 text-center text-sm font-semibold text-[#1d1406]"
                >
                  Nova tiragem
                </Link>
                <Link
                  href="/history"
                  className="rounded-full border border-[var(--border)] px-5 py-3 text-center text-sm text-[var(--foreground)]"
                >
                  Ver histórico
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setStreamError(null)
                    setStreamKey((value) => value + 1)
                  }}
                  className="rounded-full border border-[var(--border)] px-5 py-3 text-sm text-[var(--muted)]"
                >
                  Tentar novamente
                </button>
              </div>
              {streamError && (
                <p className="mt-4 text-sm text-red-100/90">{streamError}</p>
              )}
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
