import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppHeader } from '@/components/AppHeader'
import { TodaysAdvice } from '@/components/TodaysAdvice'
import { createClient } from '@/lib/supabase/server'
import { getCard } from '@/lib/tarot'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: readings } = await supabase
    .from('readings')
    .select('id, question, spread_type, card_ids, metadata, created_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(4)

  const latest = readings?.[0]
  const advice =
    latest?.metadata &&
    typeof latest.metadata === 'object' &&
    'next_step_advice' in latest.metadata
      ? (latest.metadata.next_step_advice as {
          action: string
          why: string
          timing: string
        })
      : null

  return (
    <main className="mystica-shell">
      <AppHeader />

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-8 md:px-10 md:pt-14">
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

        <div className="mt-14">
          <TodaysAdvice
            advice={advice}
            question={latest?.question}
            createdAt={latest?.created_at}
          />
        </div>

        <div className="mt-14 flex justify-center">
          <Link
            href="/reading"
            className="rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-semibold text-[#1d1406]"
          >
            Abrir nova tiragem
          </Link>
        </div>

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

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {(readings ?? []).slice(0, 3).map((reading) => (
              <Link
                key={reading.id}
                href={`/reading/${reading.id}`}
                className="mystica-panel rounded-[1.7rem] p-6"
              >
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-strong)]">
                  {new Date(reading.created_at).toLocaleDateString('pt-BR')}
                </p>
                <h3 className="font-display mt-4 text-3xl text-[var(--foreground)]">
                  {reading.spread_type === 'tres-cartas' ? 'Três cartas' : 'Carta do dia'}
                </h3>
                <p className="mt-4 line-clamp-3 text-sm leading-7 text-[var(--muted)]">
                  {reading.question}
                </p>
                <div className="mt-6 flex gap-3">
                  {(reading.card_ids ?? []).slice(0, 3).map((cardId: number) => (
                    <div
                      key={cardId}
                      className="flex h-20 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,#1c1530,#100d1f)] px-2 text-center text-[11px] leading-4 text-[var(--accent)]"
                    >
                      {getCard(cardId).name}
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
