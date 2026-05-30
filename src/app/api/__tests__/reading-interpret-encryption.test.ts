import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  buildReadingContext,
  checkRateLimit,
  createClient,
  decryptForUser,
  encryptForUser,
  extractMetadata,
  incrementCompletedReadings,
  streamInterpretation,
} = vi.hoisted(() => ({
  buildReadingContext: vi.fn(),
  checkRateLimit: vi.fn(),
  createClient: vi.fn(),
  decryptForUser: vi.fn(),
  encryptForUser: vi.fn(),
  extractMetadata: vi.fn(),
  incrementCompletedReadings: vi.fn(),
  streamInterpretation: vi.fn(),
}))

vi.mock('@/lib/encryption', () => ({
  decryptForUser,
  encryptForUser,
}))

vi.mock('@/lib/gemini', () => ({
  extractMetadata,
  streamInterpretation,
}))

vi.mock('@/lib/rag', () => ({
  buildReadingContext,
}))

vi.mock('@/lib/reading-limits', () => ({
  incrementCompletedReadings,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient,
}))

import { POST } from '@/app/api/reading/[id]/interpret/route'

function createSupabaseMock(reading: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = []

  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: reading }),
  }

  const updateQuery = {
    eq: vi.fn((id: string, value: string) => {
      updates.push({ id, value })
      return Promise.resolve({ error: null })
    }),
  }

  return {
    updates,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn(() => ({
        ...query,
        update: vi.fn((payload: Record<string, unknown>) => {
          updates.push(payload)
          return updateQuery
        }),
      })),
    },
  }
}

async function readResponseBody(response: Response) {
  return response.text()
}

describe('reading interpretation encryption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 1000,
    })
    buildReadingContext.mockResolvedValue('prompt')
    extractMetadata.mockResolvedValue({ next_step_advice: null })
    incrementCompletedReadings.mockResolvedValue(undefined)
  })

  it('encrypts question and interpretation before persisting a completed reading', async () => {
    const { client, updates } = createSupabaseMock({
      id: 'reading-1',
      status: 'drawn',
      spread_type: 'tres-cartas',
      reading_style: 'acolhedora',
      card_ids: [1, 2, 3],
      question: 'pergunta em claro',
      interpretation: null,
      metadata: null,
    })

    createClient.mockResolvedValue(client)
    encryptForUser.mockResolvedValueOnce('question-cifrada')
    encryptForUser.mockResolvedValueOnce('interpretation-cifrada')
    streamInterpretation.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => 'parte 1 ' }
        yield { text: () => 'parte 2' }
      })(),
    })

    const response = await POST(new Request('http://localhost/api/reading/reading-1/interpret', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: 'reading-1' }),
    })

    await readResponseBody(response)

    expect(buildReadingContext).toHaveBeenCalledWith(
      expect.objectContaining({
        readingStyle: 'acolhedora',
      }),
      undefined
    )
    expect(streamInterpretation).toHaveBeenCalledWith('prompt', expect.any(String))
    expect(encryptForUser).toHaveBeenNthCalledWith(1, 'user-1', 'pergunta em claro')
    expect(encryptForUser).toHaveBeenNthCalledWith(2, 'user-1', 'parte 1 parte 2')
    expect(updates).toContainEqual(
      expect.objectContaining({
        status: 'completed',
        question: 'question-cifrada',
        interpretation: 'interpretation-cifrada',
      })
    )
  })

  it('decrypts the stored interpretation when the reading is already completed', async () => {
    const { client } = createSupabaseMock({
      id: 'reading-1',
      status: 'completed',
      spread_type: 'tres-cartas',
      reading_style: null,
      card_ids: [1, 2, 3],
      question: '{"v":1}',
      interpretation: '{"v":1,"ciphertext":"abc"}',
      metadata: null,
    })

    createClient.mockResolvedValue(client)
    decryptForUser.mockResolvedValueOnce('interpretacao aberta')

    const response = await POST(new Request('http://localhost/api/reading/reading-1/interpret', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: 'reading-1' }),
    })

    expect(await response.text()).toBe('interpretacao aberta')
    expect(decryptForUser).toHaveBeenCalledWith('user-1', '{"v":1,"ciphertext":"abc"}')
  })
})
