import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, decryptForUser } = vi.hoisted(() => ({
  createClient: vi.fn(),
  decryptForUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient,
}))

vi.mock('@/lib/encryption', () => ({
  decryptForUser,
}))

import { GET as getHistory } from '@/app/api/history/route'
import { GET as getReading } from '@/app/api/reading/[id]/route'

function createSupabaseMock(options: {
  reading?: Record<string, unknown> | null
  readings?: Record<string, unknown>[]
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
    from: vi.fn((table: string) => {
      if (table !== 'readings') {
        throw new Error(`Unexpected table ${table}`)
      }

      if (options.reading) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: options.reading }),
        }
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: options.readings ?? [], error: null }),
      }
    }),
  }
}

describe('reading decryption routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('decrypts completed reading fields before returning detail response', async () => {
    createClient.mockResolvedValue(
      createSupabaseMock({
        reading: {
          id: 'reading-1',
          status: 'completed',
          spread_type: 'tres-cartas',
          question: '{"v":1}',
          card_ids: [1, 2, 3],
          interpretation: '{"v":1,"ciphertext":"abc"}',
          metadata: { summary: 'kept open' },
          reading_style: null,
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
        },
      })
    )

    decryptForUser.mockResolvedValueOnce('pergunta aberta')
    decryptForUser.mockResolvedValueOnce('interpretacao aberta')

    const response = await getReading(new Request('http://localhost/api/reading/reading-1'), {
      params: Promise.resolve({ id: 'reading-1' }),
    })

    const body = (await response.json()) as {
      reading: {
        question: string
        interpretation: string
        metadata: { summary: string }
        reading_style: string
      }
    }

    expect(decryptForUser).toHaveBeenNthCalledWith(1, 'user-1', '{"v":1}')
    expect(decryptForUser).toHaveBeenNthCalledWith(
      2,
      'user-1',
      '{"v":1,"ciphertext":"abc"}'
    )
    expect(body.reading.question).toBe('pergunta aberta')
    expect(body.reading.interpretation).toBe('interpretacao aberta')
    expect(body.reading.metadata.summary).toBe('kept open')
    expect(body.reading.reading_style).toBe('sincera')
  })

  it('decrypts completed reading fields before returning history response', async () => {
    createClient.mockResolvedValue(
      createSupabaseMock({
        readings: [
          {
            id: 'reading-1',
            spread_type: 'tres-cartas',
            question: '{"v":1}',
            card_ids: [1, 2, 3],
            metadata: { summary: 'kept open' },
            reading_style: null,
            created_at: '2026-03-13T00:00:00.000Z',
          },
        ],
      })
    )

    decryptForUser.mockResolvedValueOnce('pergunta do historico')

    const response = await getHistory()
    const body = (await response.json()) as {
      readings: Array<{
        question: string
        metadata: { summary: string }
        reading_style: string
      }>
    }

    expect(decryptForUser).toHaveBeenCalledWith('user-1', '{"v":1}')
    expect(body.readings[0]?.question).toBe('pergunta do historico')
    expect(body.readings[0]?.metadata.summary).toBe('kept open')
    expect(body.readings[0]?.reading_style).toBe('sincera')
  })
})
