import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import LoginPage from './page'

const signInWithOAuth = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth,
    },
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset()
  })

  it('requests a single OAuth redirect and blocks repeated clicks while loading', async () => {
    signInWithOAuth.mockImplementation(
      () =>
        new Promise(() => {
          // Keep the request pending so the button remains in loading state.
        })
    )

    render(<LoginPage />)

    const button = screen.getByRole('button', { name: /entrar com google/i })

    fireEvent.click(button)

    await waitFor(() => {
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
          skipBrowserRedirect: true,
        },
      })
    })

    fireEvent.click(button)

    expect(signInWithOAuth).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /conectando/i })).toBeDisabled()
  })
})
