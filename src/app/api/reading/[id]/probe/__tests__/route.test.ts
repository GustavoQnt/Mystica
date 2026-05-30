import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetUser,
  mockFrom,
  mockCheckRateLimit,
  mockRetrieve,
  mockGenerate,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockRetrieve: vi.fn(),
  mockGenerate: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: mockFrom,
  }),
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mockCheckRateLimit }))
vi.mock('@/lib/rag', () => ({ retrieveReadingKnowledge: mockRetrieve }))
vi.mock('@/lib/gemini', () => ({ generateProbeQuestions: mockGenerate }))

import { POST } from '../route'

const ctx = { params: Promise.resolve({ id: 'r1' }) }

function readingRow(data: unknown) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  })
}

describe('POST /api/reading/[id]/probe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 3, remaining: 2, reset: 0 })
    mockRetrieve.mockResolvedValue({ cardLines: ['O Sol'], ragContext: 'rag', historyContext: '' })
    mockGenerate.mockResolvedValue(['Pergunta ancorada 1?'])
    readingRow({
      id: 'r1',
      status: 'drawn',
      spread_type: 'tres-cartas',
      card_ids: [1, 2, 3],
      question: 'Ele volta?',
      reading_style: 'sincera',
    })
  })

  it('401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(new Request('http://x'), ctx)
    expect(res.status).toBe(401)
  })

  it('429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 3, remaining: 0, reset: Date.now() + 30000 })
    const res = await POST(new Request('http://x'), ctx)
    expect(res.status).toBe(429)
  })

  it('409 when reading is not drawn', async () => {
    readingRow({ id: 'r1', status: 'completed', spread_type: 'tres-cartas', card_ids: [1], question: 'q', reading_style: 'sincera' })
    const res = await POST(new Request('http://x'), ctx)
    expect(res.status).toBe(409)
  })

  it('returns empty questions when there are no cards', async () => {
    readingRow({ id: 'r1', status: 'drawn', spread_type: 'carta-do-dia', card_ids: [], question: 'q', reading_style: 'sincera' })
    const res = await POST(new Request('http://x'), ctx)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.questions).toEqual([])
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('returns generated questions and the drawn cards on success', async () => {
    const res = await POST(new Request('http://x'), ctx)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.questions).toEqual(['Pergunta ancorada 1?'])
    expect(body.card_ids).toEqual([1, 2, 3])
    expect(mockGenerate).toHaveBeenCalled()
  })

  it('degrades gracefully to no questions when generation throws', async () => {
    mockGenerate.mockRejectedValue(new Error('gemini down'))
    const res = await POST(new Request('http://x'), ctx)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.questions).toEqual([])
  })
})
