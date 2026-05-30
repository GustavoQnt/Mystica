import { describe, expect, it } from 'vitest'

import { formatProbeContext, parseProbeQA } from '@/lib/probe'

describe('parseProbeQA', () => {
  it('keeps well-formed pairs and clamps to 3', () => {
    const raw = [
      { question: 'q1', answer: 'a1' },
      { question: 'q2', answer: 'a2' },
      { question: 'q3', answer: 'a3' },
      { question: 'q4', answer: 'a4' },
    ]
    expect(parseProbeQA(raw)).toHaveLength(3)
  })

  it('drops malformed entries', () => {
    const raw = [
      { question: 'ok', answer: 'yes' },
      { question: 'no answer' },
      { answer: 'no question' },
      null,
      'string',
    ]
    expect(parseProbeQA(raw)).toEqual([{ question: 'ok', answer: 'yes' }])
  })

  it('returns [] for non-array input', () => {
    expect(parseProbeQA(undefined)).toEqual([])
    expect(parseProbeQA('nope')).toEqual([])
  })
})

describe('formatProbeContext', () => {
  it('renders only answered pairs', () => {
    const out = formatProbeContext([
      { question: 'Faz quanto tempo?', answer: 'Dois meses' },
      { question: 'Vocês se falam?', answer: '   ' },
    ])
    expect(out).toBe('P: Faz quanto tempo?\nR: Dois meses')
  })

  it('returns undefined when nothing was answered', () => {
    expect(
      formatProbeContext([{ question: 'q', answer: '' }])
    ).toBeUndefined()
    expect(formatProbeContext([])).toBeUndefined()
  })
})
