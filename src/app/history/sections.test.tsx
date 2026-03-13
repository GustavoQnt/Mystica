import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, decryptForUser, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  decryptForUser: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient,
}))

vi.mock('@/lib/encryption', () => ({
  decryptForUser,
}))

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    redirect,
  }
})

import { HistoryListSection } from './sections'

describe('HistoryListSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the decrypted question in the history title', async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'reading-1',
              question: '{"v":1,"ciphertext":"abc"}',
              spread_type: 'tres-cartas',
              card_ids: [1, 2, 3],
              metadata: null,
              created_at: '2026-03-13T00:00:00.000Z',
            },
          ],
        }),
      })),
    })

    decryptForUser.mockResolvedValue('pergunta decriptada')

    render(await HistoryListSection())

    expect(decryptForUser).toHaveBeenCalledWith('user-1', '{"v":1,"ciphertext":"abc"}')
    expect(screen.getByRole('heading', { name: 'pergunta decriptada' })).toBeInTheDocument()
  })
})
