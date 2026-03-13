'use client'

import { useMemo, useState } from 'react'

interface CardFanProps {
  totalCards?: number
  required: number
  onComplete: (indices: number[]) => void
}

function CardBackDefs() {
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        <g id="mystic-card-back">
          <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a1525" />
            <stop offset="100%" stopColor="#0d0a14" />
          </linearGradient>
          <pattern id="starPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1" fill="#c9a96e" opacity="0.3" />
            <path d="M10 10 L12 10 L11 9 Z" fill="#c9a96e" opacity="0.5" />
            <path d="M30 30 L32 30 L31 29 Z" fill="#c9a96e" opacity="0.4" />
          </pattern>
          
          <rect width="200" height="300" rx="16" fill="url(#cardBg)" />
          <rect width="200" height="300" rx="16" fill="url(#starPattern)" />
          <rect x="10" y="10" width="180" height="280" rx="12" fill="none" stroke="#c9a96e" strokeWidth="1" opacity="0.6" />
          <rect x="14" y="14" width="172" height="272" rx="8" fill="none" stroke="#c9a96e" strokeWidth="0.5" opacity="0.4" />

          <path d="M 10 30 Q 30 30 30 10" fill="none" stroke="#c9a96e" strokeWidth="1" opacity="0.7"/>
          <path d="M 190 30 Q 170 30 170 10" fill="none" stroke="#c9a96e" strokeWidth="1" opacity="0.7"/>
          <path d="M 10 270 Q 30 270 30 290" fill="none" stroke="#c9a96e" strokeWidth="1" opacity="0.7"/>
          <path d="M 190 270 Q 170 270 170 290" fill="none" stroke="#c9a96e" strokeWidth="1" opacity="0.7"/>

          <circle cx="100" cy="10" r="3" fill="#c9a96e" opacity="0.8" />
          <circle cx="100" cy="290" r="3" fill="#c9a96e" opacity="0.8" />
          <path d="M 100 13 L 105 18 L 95 18 Z" fill="#c9a96e" opacity="0.6" />
          <path d="M 100 287 L 105 282 L 95 282 Z" fill="#c9a96e" opacity="0.6" />

          <g transform="translate(100, 150)">
            <circle cx="0" cy="0" r="54" fill="none" stroke="#c9a96e" strokeWidth="0.5" opacity="0.3" />
            <circle cx="0" cy="0" r="50" fill="none" stroke="#c9a96e" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
            <circle cx="0" cy="0" r="45" fill="none" stroke="#c9a96e" strokeWidth="0.5" opacity="0.5" />
            
            <path d="M 0 -60 L 60 0 L 0 60 L -60 0 Z" fill="none" stroke="#c9a96e" strokeWidth="1" opacity="0.6" />
            <path d="M 0 -45 L 45 0 L 0 45 L -45 0 Z" fill="none" stroke="#c9a96e" strokeWidth="0.5" opacity="0.4" />

            <path d="M -22 -22 A 32 32 0 0 1 22 -22 A 42 42 0 0 0 -22 -22" fill="#c9a96e" opacity="0.85" />
            <path d="M -22 22 A 32 32 0 0 0 22 22 A 42 42 0 0 1 -22 22" fill="#c9a96e" opacity="0.85" />

            <path d="M -16 0 Q 0 -16 16 0 Q 0 16 -16 0 Z" fill="none" stroke="#c9a96e" strokeWidth="1.5" opacity="0.9" />
            <circle cx="0" cy="0" r="4.5" fill="#c9a96e" opacity="1" />
            <circle cx="0" cy="0" r="7" fill="#c9a96e" opacity="0.4" />
            <circle cx="0" cy="0" r="9" fill="none" stroke="#c9a96e" strokeWidth="0.5" opacity="0.7" />
            
            <g stroke="#c9a96e" strokeWidth="0.75" opacity="0.5">
              <line x1="0" y1="-28" x2="0" y2="-40" />
              <line x1="0" y1="28" x2="0" y2="40" />
              <line x1="-28" y1="0" x2="-40" y2="0" />
              <line x1="28" y1="0" x2="40" y2="0" />
              <line x1="-20" y1="-20" x2="-28" y2="-28" />
              <line x1="20" y1="20" x2="28" y2="28" />
              <line x1="-20" y1="20" x2="-28" y2="28" />
              <line x1="20" y1="-20" x2="28" y2="-28" />
            </g>
          </g>
        </g>
      </defs>
    </svg>
  )
}

function CardBack() {
  return (
    <svg viewBox="0 0 200 300" className="absolute inset-0 h-full w-full rounded-2xl drop-shadow-[0_10px_20px_rgba(4,3,12,0.6)]" xmlns="http://www.w3.org/2000/svg">
      <use href="#mystic-card-back" />
    </svg>
  )
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
        // Center of the arc is 0.5
        const x = progress - 0.5
        // Rotation goes from -32.5deg to +32.5deg
        const rotate = x * 65
        // Y drops at the edges by up to ~50px to ~70px max depending on radius
        const translateY = (x * x) * 200

        return {
          index,
          progress,
          rotate,
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
      <CardBackDefs />
      <div className="text-center">
        <p className="mystica-label">Escolha guiada</p>
        <h2 className="font-display mt-4 text-4xl text-[var(--foreground)]">
          Toque nas cartas que chamarem você.
        </h2>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {selected.length} de {required} cartas escolhidas
        </p>
      </div>

      <div className="relative mx-auto mt-6 h-[260px] w-full max-w-[1200px] overflow-visible sm:h-[320px] md:mt-10 md:h-[400px]">
        {cards.map((card, visualIndex) => {
          const isSelected = selected.includes(card.index)
          return (
            <button
              key={card.index}
              type="button"
              onClick={() => toggleCard(card.index)}
              className="group absolute top-[15%] outline-none hover:z-[100] focus:z-[100]"
              style={{
                left: `calc(4% + ${card.progress * 92}%)`,
                transform: `translateX(-50%) translateY(${card.translateY}px) rotate(${card.rotate}deg)`,
                zIndex: isSelected ? 200 + visualIndex : visualIndex,
              }}
            >
              <div className="h-[104px] w-[64px] sm:h-[136px] sm:w-[84px] md:h-[220px] md:w-[136px]">
                <div 
                  className={`relative h-full w-full rounded-md transition-all duration-300 ease-out will-change-transform md:rounded-xl
                    ${isSelected ? '-translate-y-8 scale-125 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[#0d0a14] shadow-[0_0_20px_rgba(201,169,110,0.6)] z-50 md:-translate-y-12' : 'shadow-[0_4px_12px_rgba(4,3,12,0.4)] group-hover:-translate-y-8 group-hover:scale-125 group-hover:shadow-[0_20px_40px_rgba(4,3,12,0.7)] md:group-hover:-translate-y-12'}
                  `}
                >
                  <CardBack />
                  <span className="sr-only">Carta {card.index + 1}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          disabled={selected.length !== required}
          onClick={() => onComplete(selected)}
          className="rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-medium text-[#1b1408] disabled:cursor-not-allowed disabled:opacity-35 transition-all hover:bg-white hover:scale-105 hover:shadow-[0_0_20px_rgba(201,169,110,0.5)] active:scale-95"
        >
          Selar tiragem
        </button>
      </div>
    </div>
  )
}
