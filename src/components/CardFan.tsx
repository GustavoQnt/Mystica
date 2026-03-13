'use client'

import { useMemo, useState } from 'react'

interface CardFanProps {
  totalCards?: number
  required: number
  onComplete: (indices: number[]) => void
}

export function CardFan({
  totalCards = 78,
  required,
  onComplete,
}: CardFanProps) {
  const [selected, setSelected] = useState<number[]>([])

  const cards = useMemo(
    () =>
      Array.from({ length: totalCards }, (_, index) => {
        const progress = totalCards === 1 ? 0 : index / (totalCards - 1)
        const rotate = -36 + progress * 72
        const translateY = Math.abs(progress - 0.5) * 110
        const translateX = (progress - 0.5) * 540

        return {
          index,
          rotate,
          translateX,
          translateY,
        }
      }),
    [totalCards]
  )

  function toggleCard(index: number) {
    setSelected((current) => {
      const exists = current.includes(index)
      if (exists) {
        return current.filter((value) => value !== index)
      }

      if (current.length >= required) {
        return current
      }

      return [...current, index]
    })
  }

  return (
    <div className="mystica-panel mystica-fade-up rounded-[2rem] px-4 py-8 md:px-8 md:py-12">
      <div className="text-center">
        <p className="mystica-label">Escolha guiada</p>
        <h2 className="font-display mt-4 text-4xl text-[var(--foreground)]">
          Toque nas cartas que chamarem voce.
        </h2>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {selected.length} de {required} cartas escolhidas
        </p>
      </div>

      <div className="relative mt-10 h-[380px] overflow-hidden md:h-[460px]">
        {cards.map((card, visualIndex) => {
          const isSelected = selected.includes(card.index)
          return (
            <button
              key={card.index}
              type="button"
              onClick={() => toggleCard(card.index)}
              className="absolute left-1/2 top-[40%] h-44 w-24 -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,#241b3b,#130f22)] shadow-[0_20px_40px_rgba(4,3,12,0.4)] md:h-56 md:w-32"
              style={{
                transform: `translate(-50%, -50%) translateX(${card.translateX}px) translateY(${card.translateY - (isSelected ? 36 : 0)}px) rotate(${card.rotate}deg)`,
                zIndex: isSelected ? 200 + visualIndex : visualIndex,
              }}
            >
              <span className="absolute inset-2 rounded-xl border border-[rgba(201,169,110,0.16)]" />
              <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(201,169,110,0.15),transparent_36%)]" />
              <span className="absolute left-1/2 top-1/2 block h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(201,169,110,0.18)]" />
              <span className="absolute inset-x-5 top-5 h-px bg-[rgba(201,169,110,0.25)]" />
              <span className="absolute inset-x-5 bottom-5 h-px bg-[rgba(201,169,110,0.25)]" />
              <span className="sr-only">Carta {card.index + 1}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          disabled={selected.length !== required}
          onClick={() => onComplete(selected)}
          className="rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-medium text-[#1b1408] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Selar tiragem
        </button>
      </div>
    </div>
  )
}
