import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCardImageCandidates } from '@/lib/card-images'
import { decryptForUser } from '@/lib/encryption'
import { getReadingStyleLabel, resolveReadingStyle } from '@/lib/reading-style'
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
    .select('id, question, spread_type, card_ids, metadata, created_at, reading_style')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const decryptedReadings = await Promise.all(
    (readings ?? []).map(async (reading) => ({
      ...reading,
      question: await decryptForUser(user.id, reading.question),
      reading_style: resolveReadingStyle(reading.reading_style),
    }))
  )

  if (!decryptedReadings.length) {
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
      {decryptedReadings.map((reading) => (
        <Link
          key={reading.id}
          href={`/reading/${reading.id}`}
          className="mystica-panel rounded-[1.9rem] px-6 py-6 md:px-8"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl flex-1">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-strong)]">
                {new Date(reading.created_at).toLocaleDateString('pt-BR')} ·{' '}
                {reading.spread_type === 'tres-cartas' ? 'Três cartas' : 'Carta do dia'} ·{' '}
                {getReadingStyleLabel(reading.reading_style)}
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

            <div className="flex gap-4 overflow-x-auto pb-2 md:gap-3 md:pb-0">
              {(reading.card_ids ?? []).slice(0, 3).map((cardId: number) => {
                const card = getCard(cardId)
                const [avif, webp] = getCardImageCandidates(cardId)

                return (
                  <div
                    key={cardId}
                    className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                  >
                    <picture>
                      {avif && <source srcSet={avif} type="image/avif" />}
                      {webp && <source srcSet={webp} type="image/webp" />}
                      <img
                        src={webp || avif}
                        alt={card.name}
                        className="h-24 w-16 rounded-[0.7rem] border border-[var(--border)] object-cover"
                        loading="lazy"
                      />
                    </picture>
                    <span className="text-center text-[10px] leading-tight text-[var(--muted)]">
                      {card.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
