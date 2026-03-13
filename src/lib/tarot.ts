import cardsData from '@/data/cards.json'

export type SpreadType = 'tres-cartas' | 'carta-do-dia'
export type ArcanaType = 'major' | 'minor'
export type Suit = 'copas' | 'espadas' | 'ouros' | 'paus' | null

export interface Card {
  id: number
  name: string
  arcana_type: ArcanaType
  suit: Suit
  number: number
}

export const SPREAD_SIZES: Record<SpreadType, number> = {
  'tres-cartas': 3,
  'carta-do-dia': 1,
}

export const POSITION_LABELS: Record<SpreadType, string[]> = {
  'tres-cartas': ['passado', 'presente', 'futuro'],
  'carta-do-dia': ['presente'],
}

const CARDS: Card[] = cardsData as Card[]

/** Returns a shuffled copy of card IDs (Fisher-Yates) */
function shuffleDeck(): number[] {
  const deck = CARDS.map(c => c.id)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/**
 * Resolves fan_indices (positions in a shuffled deck) to card IDs.
 * The deck is shuffled server-side per request — fan_indices are positional
 * picks the user made from the visual fan. We shuffle, then pick by index.
 */
export function resolveCards(fanIndices: number[], spreadType: SpreadType): number[] {
  const expected = SPREAD_SIZES[spreadType]
  if (fanIndices.length !== expected) {
    throw new Error(
      `${spreadType} requires ${expected} card(s), got ${fanIndices.length}`
    )
  }

  const shuffled = shuffleDeck()

  return fanIndices.map(idx => {
    const clampedIdx = ((idx % shuffled.length) + shuffled.length) % shuffled.length
    return shuffled[clampedIdx]
  })
}

export function getCard(id: number): Card {
  const card = CARDS.find(c => c.id === id)
  if (!card) throw new Error(`Card id ${id} not found`)
  return card
}

export function getPositionLabel(spreadType: SpreadType, positionIndex: number): string {
  return POSITION_LABELS[spreadType][positionIndex] ?? `posição ${positionIndex + 1}`
}
