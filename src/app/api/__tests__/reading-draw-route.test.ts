import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createClient,
  getProfileForDrawCheck,
  hasReachedFreeLimit,
  resolveCards,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  getProfileForDrawCheck: vi.fn(),
  hasReachedFreeLimit: vi.fn(),
  resolveCards: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient,
}))

vi.mock('@/lib/reading-limits', () => ({
  getProfileForDrawCheck,
  hasReachedFreeLimit,
}))

vi.mock('@/lib/tarot', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tarot')>('@/lib/tarot')
  return {
    ...actual,
    resolveCards,
  }
})

import { POST } from '@/app/api/reading/draw/route'

function createSupabaseMock() {
  const inserts: Record<string, unknown>[] = []

  return {
    inserts,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn(() => ({
        insert: vi.fn((payload: Record<string, unknown>) => {
          inserts.push(payload)
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'reading-1' },
              error: null,
            }),
          }
        }),
      })),
    },
  }
}

describe('reading draw route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getProfileForDrawCheck.mockResolvedValue({ plan: 'free', readings_this_month: 0 })
    hasReachedFreeLimit.mockReturnValue(false)
    resolveCards.mockReturnValue([1, 2, 3])
  })

  it('rejects draw creation when reading_style is missing', async () => {
    const { client } = createSupabaseMock()
    createClient.mockResolvedValue(client)

    const response = await POST(new Request('http://localhost/api/reading/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spread_type: 'tres-cartas',
        fan_indices: [0, 10, 20],
        question: 'O que preciso enxergar agora?',
      }),
    }))

    expect(response.status).toBe(400)
  })

  it('persists the selected reading style when draw creation succeeds', async () => {
    const { client, inserts } = createSupabaseMock()
    createClient.mockResolvedValue(client)

    const response = await POST(new Request('http://localhost/api/reading/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spread_type: 'tres-cartas',
        reading_style: 'acolhedora',
        fan_indices: [0, 10, 20],
        question: 'O que preciso enxergar agora?',
      }),
    }))

    expect(response.status).toBe(201)
    expect(inserts).toContainEqual(
      expect.objectContaining({
        reading_style: 'acolhedora',
      })
    )
  })
})
