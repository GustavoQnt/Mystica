import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReadingPage from './page'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
  }),
}))

vi.mock('@/components/AppHeader', () => ({
  AppHeader: () => <div>header</div>,
}))

vi.mock('@/components/CardFan', () => ({
  CardFan: () => <div>card fan</div>,
}))

describe('ReadingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the continue button disabled until a reading style is selected', () => {
    render(<ReadingPage />)

    fireEvent.change(screen.getByPlaceholderText('O que em mim precisa ser visto agora?'), {
      target: { value: 'Quero entender meu momento atual' },
    })

    expect(
      screen.getByRole('button', { name: 'Continuar para escolher as cartas' })
    ).toBeDisabled()
  })
})
