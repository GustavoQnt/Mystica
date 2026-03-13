'use client'

import { useState } from 'react'

import { getCardImageCandidates } from '@/lib/card-images'
import { getCard, getPositionLabel, type SpreadType } from '@/lib/tarot'

interface CardRevealProps {
  cardIds: number[]
  spreadType: SpreadType
}

export function CardReveal({ cardIds, spreadType }: CardRevealProps) {
  return (
    <div className={`-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-12 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:p-0 ${cardIds.length === 1 ? 'justify-center md:flex md:justify-center' : 'md:grid md:grid-cols-3'}`}>
      {cardIds.map((cardId, index) => (
        <RevealCard
          key={`${cardId}-${index}`}
          cardId={cardId}
          label={getPositionLabel(spreadType, index)}
        />
      ))}
    </div>
  )
}

function RevealCard({
  cardId,
  label,
}: {
  cardId: number
  label: string
}) {
  const imageCandidates = getCardImageCandidates(cardId)
  const [imageIndex, setImageIndex] = useState(0)
  const card = getCard(cardId)
  const imageSrc = imageCandidates[imageIndex]
  const hasImage = Boolean(imageSrc)

  return (
    <article className="group perspective-[1200px] mystica-fade-up relative w-[85vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none">
      <div className="relative h-[460px] md:h-[480px] rounded-[1.8rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(29,21,47,0.95),rgba(11,9,22,0.95))] p-4 shadow-[0_28px_70px_rgba(6,5,14,0.45)]">
        <div className="absolute inset-0 rounded-[1.8rem] bg-[radial-gradient(circle_at_top,rgba(201,169,110,0.12),transparent_34%)]" />
        <div className="relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[rgba(201,169,110,0.14)] bg-[#100d1e]">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={card.name}
              className="h-full w-full object-contain"
              onError={() => setImageIndex(current => current + 1)}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[linear-gradient(180deg,#1a1331,#0d0a19)] px-8 text-center">
              <div>
                <p className="mystica-label">Arcano revelado</p>
                <h3 className="font-display mt-5 text-4xl text-[var(--accent)]">
                  {card.name}
                </h3>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="px-3 pb-1 pt-5 text-center">
        <p className="font-display text-2xl text-[var(--accent)]">{card.name}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          {label}
        </p>
      </div>
    </article>
  )
}
