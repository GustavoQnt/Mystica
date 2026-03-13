import { describe, it, expect } from 'vitest'
import { resolveCards, getCard, SPREAD_SIZES } from '../tarot'

describe('resolveCards', () => {
  it('maps fan_indices to card_ids deterministically', () => {
    const result = resolveCards([0, 1, 2], 'tres-cartas')
    expect(result).toHaveLength(3)
    expect(result.every(id => id >= 0 && id <= 77)).toBe(true)
  })

  it('returns different cards for different indices', () => {
    const r1 = resolveCards([0, 1, 2], 'tres-cartas')
    const r2 = resolveCards([10, 20, 30], 'tres-cartas')
    expect(r1).not.toEqual(r2)
  })

  it('throws if fan_indices length does not match spread size', () => {
    expect(() => resolveCards([0, 1], 'tres-cartas')).toThrow()
    expect(() => resolveCards([0, 1], 'carta-do-dia')).toThrow()
  })

  it('carta-do-dia requires exactly 1 index', () => {
    const result = resolveCards([5], 'carta-do-dia')
    expect(result).toHaveLength(1)
  })
})

describe('getCard', () => {
  it('returns card data by id', () => {
    const card = getCard(0)
    expect(card).toHaveProperty('id', 0)
    expect(card).toHaveProperty('name')
    expect(card).toHaveProperty('arcana_type')
  })

  it('throws for unknown card id', () => {
    expect(() => getCard(999)).toThrow()
  })
})

describe('SPREAD_SIZES', () => {
  it('tres-cartas requires 3 cards', () => {
    expect(SPREAD_SIZES['tres-cartas']).toBe(3)
  })
  it('carta-do-dia requires 1 card', () => {
    expect(SPREAD_SIZES['carta-do-dia']).toBe(1)
  })
})
