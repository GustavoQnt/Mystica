import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getCard } from '@/lib/tarot'

export async function HistoryListSection() {
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

  if (!readings?.length) {
    return (
      <div className="mt-12">
        <div className="mystica-panel rounded-[2rem] px-8 py-14 text-center">
          <p className="font-display text-4xl text-[var(--foreground)]">
            Nenhuma leitura concluída ainda.
          </p>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--muted)]">
            Quando a primeira leitura se encerrar, ela aparecerá aqui com data,
            pergunta e sinais revelados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-12 grid gap-5">
      {readings.map((reading) => (
        <Link
          key={reading.id}
          href={`/reading/${reading.id}`}
          className="mystica-panel rounded-[1.9rem] px-6 py-6 md:px-8"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-strong)]">
                {new Date(reading.created_at).toLocaleDateString('pt-BR')} ·{' '}
                {reading.spread_type === 'tres-cartas' ? 'Três cartas' : 'Carta do dia'}
              </p>
              <h2 className="font-display mt-4 text-3xl text-[var(--foreground)]">
                {reading.question}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                {reading.metadata &&
                typeof reading.metadata === 'object' &&
                'energy' in reading.metadata &&
                typeof reading.metadata.energy === 'string'
                  ? reading.metadata.energy
                  : 'Leitura concluída e guardada na memória do santuário.'}
              </p>
            </div>

            <div className="flex gap-3">
              {(reading.card_ids ?? []).slice(0, 3).map((cardId: number) => (
                <div
                  key={cardId}
                  className="flex h-24 w-16 items-center justify-center rounded-[1.3rem] border border-[var(--border)] bg-[linear-gradient(180deg,#1c1530,#100d1f)] px-2 text-center text-[11px] leading-4 text-[var(--accent)]"
                >
                  {getCard(cardId).name}
                </div>
              ))}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
