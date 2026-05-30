import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
        generateContentStream: () => undefined,
      }
    }
  },
}))

import { generateProbeQuestions } from '@/lib/gemini'

const ctx = {
  spreadType: 'tres-cartas' as const,
  readingStyle: 'sincera' as const,
  cardLines: ['O Mago (passado)', 'A Lua (presente)', 'O Sol (futuro)'],
  question: 'Ele volta?',
  ragContext: 'O Mago: poder. A Lua: ilusão. O Sol: clareza.',
}

function jsonResponse(questions: string[]) {
  return { response: { text: () => JSON.stringify({ questions }) } }
}

function transient503() {
  return Object.assign(new Error('[503 Service Unavailable] high demand'), {
    status: 503,
  })
}

describe('generateProbeQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('parses questions and clamps to a maximum of 3', async () => {
    mockGenerateContent.mockResolvedValue(jsonResponse(['a', 'b', 'c', 'd']))
    const qs = await generateProbeQuestions(ctx)
    expect(qs).toEqual(['a', 'b', 'c'])
  })

  it('drops empty/non-string questions', async () => {
    mockGenerateContent.mockResolvedValue(
      jsonResponse(['  ', 'real question'])
    )
    const qs = await generateProbeQuestions(ctx)
    expect(qs).toEqual(['real question'])
  })
})

describe('503 resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries after a transient 503 and succeeds', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(transient503())
      .mockResolvedValueOnce(jsonResponse(['recovered']))

    const qs = await generateProbeQuestions(ctx)

    expect(qs).toEqual(['recovered'])
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  }, 10000)

  it('does not retry a non-transient error (e.g. 400)', async () => {
    mockGenerateContent.mockRejectedValue(
      Object.assign(new Error('400 invalid request'), { status: 400 })
    )

    await expect(generateProbeQuestions(ctx)).rejects.toThrow()
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })
})
