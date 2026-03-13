import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient,
}))

import { updateSession } from '@/lib/supabase/middleware'

function createRequest(pathname: string) {
  return new NextRequest(`http://localhost:3000${pathname}`)
}

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('does not refresh session on /login', async () => {
    const getSession = vi.fn()

    createServerClient.mockReturnValue({
      auth: {
        getSession,
      },
    })

    const response = await updateSession(createRequest('/login'))

    expect(getSession).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it('does not refresh session on auth callback routes', async () => {
    const getSession = vi.fn()

    createServerClient.mockReturnValue({
      auth: {
        getSession,
      },
    })

    const response = await updateSession(createRequest('/auth/callback'))

    expect(getSession).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it('redirects private routes to /login when there is no session', async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
    })

    createServerClient.mockReturnValue({
      auth: {
        getSession,
      },
    })

    const response = await updateSession(createRequest('/history'))

    expect(getSession).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
  })
})
