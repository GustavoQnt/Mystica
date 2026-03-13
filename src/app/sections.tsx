import Link from 'next/link'
import { redirect } from 'next/navigation'

import { TodaysAdvice } from '@/components/TodaysAdvice'
import { getCardImageCandidates } from '@/lib/card-images'
import { decryptForUser } from '@/lib/encryption'
import { createClient } from '@/lib/supabase/server'
import { getCard } from '@/lib/tarot'

async function getReadings() {
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

  return Promise.all(
    (readings ?? []).map(async (reading) => ({
      ...reading,
      question: await decryptForUser(user.id, reading.question),
    }))
  )
}

export async function AdviceSection() {
  const readings = await getReadings()
  const latest = readings[0]

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
    <TodaysAdvice
      advice={advice}
      question={latest?.question}
      createdAt={latest?.created_at}
    />
  )
}

export async function RecentReadingsSection() {
  const readings = await getReadings()

  return (
    <div className="mt-8 grid gap-5 md:grid-cols-3">
      {readings.slice(0, 3).map((reading) => (
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
          <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
            {(reading.card_ids ?? []).slice(0, 3).map((cardId: number) => (
              (() => {
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
              })()
            ))}
          </div>
        </Link>
      ))}
    </div>
  )
}
