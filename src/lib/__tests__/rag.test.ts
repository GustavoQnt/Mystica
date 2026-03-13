import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createEmbedding, fetchRecentReadings, hybridSearch, buildReadingPrompt } = vi.hoisted(() => ({
  createEmbedding: vi.fn(),
  fetchRecentReadings: vi.fn(),
  hybridSearch: vi.fn(),
  buildReadingPrompt: vi.fn(),
}))

vi.mock('@/lib/gemini', () => ({
  createEmbedding,
}))

vi.mock('@/lib/context-injection', () => ({
  fetchRecentReadings,
  formatHistoryContext: vi.fn(() => 'historico'),
}))

vi.mock('@/lib/pinecone', () => ({
  hybridSearch,
}))

vi.mock('@/lib/prompts', () => ({
  buildReadingPrompt,
}))

import { buildReadingContext } from '@/lib/rag'

describe('buildReadingContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEmbedding.mockResolvedValue([0.1, 0.2, 0.3])
    fetchRecentReadings.mockResolvedValue([])
    buildReadingPrompt.mockReturnValue('prompt final')
  })

  it('adds a Jung-focused supplementary lookup for analitica readings', async () => {
    hybridSearch
      .mockResolvedValueOnce(['carta 1'])
      .mockResolvedValueOnce(['semantico 1'])
      .mockResolvedValueOnce(['jung 1'])

    const result = await buildReadingContext({
      supabase: {} as never,
      userId: 'user-1',
      cardIds: [1, 2, 3],
      spreadType: 'tres-cartas',
      readingStyle: 'analitica',
      question: 'O que preciso enxergar?',
    })

    expect(result).toBe('prompt final')
    expect(hybridSearch).toHaveBeenCalledTimes(3)
    expect(hybridSearch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        cardIds: [],
        topK: 3,
        supplementarySlug: 'psicologia-junguiana',
      }),
      [0.1, 0.2, 0.3]
    )
    expect(buildReadingPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        ragContext: 'jung 1\n\n---\n\ncarta 1\n\n---\n\nsemantico 1',
      })
    )
  })

  it('does not add Jung-only lookup for non-analitica readings', async () => {
    hybridSearch
      .mockResolvedValueOnce(['carta 1'])
      .mockResolvedValueOnce(['semantico 1'])

    await buildReadingContext({
      supabase: {} as never,
      userId: 'user-1',
      cardIds: [1, 2, 3],
      spreadType: 'tres-cartas',
      readingStyle: 'sincera',
      question: 'O que preciso enxergar?',
    })

    expect(hybridSearch).toHaveBeenCalledTimes(2)
  })
})
