import { describe, expect, it } from 'vitest'

import { buildReadingPrompt, getSystemPromptForStyle } from '@/lib/prompts'

describe('prompts', () => {
  it('builds a sincera system prompt that preserves bronca with contexto and solucao', () => {
    const prompt = getSystemPromptForStyle('sincera')

    expect(prompt).toContain('comportamento')
    expect(prompt).toContain('contexto')
    expect(prompt).toContain('solução')
    expect(prompt).toContain('tola')
  })

  it('builds an analitica system prompt with Jungian framing that stays affirmative', () => {
    const prompt = getSystemPromptForStyle('analitica')

    expect(prompt).toContain('arquétipos')
    expect(prompt).toContain('sombra')
    expect(prompt).toContain('individuação')
    expect(prompt).toContain('psicologia junguiana')
    // New contract: Jungian lens is a depth tool, never an excuse to hedge.
    expect(prompt).not.toContain('modo subjuntivo')
    expect(prompt).toContain('crava o que vai acontecer')
  })

  it('base prompt mandates affirmative future-telling and forbids hedging', () => {
    const prompt = getSystemPromptForStyle('sincera')

    expect(prompt).toContain('LÊ O FUTURO')
    expect(prompt).toContain('PROIBIDO hesitar')
    expect(prompt).toContain('CVV')
  })

  it('builds an acolhedora system prompt with validation before guidance', () => {
    const prompt = getSystemPromptForStyle('acolhedora')

    expect(prompt).toContain('Valide primeiro')
    expect(prompt).toContain('É compreensível que')
    expect(prompt).toContain('Sinta-se abraçada por esta energia')
    expect(prompt).toContain('Nunca atribua culpa')
  })

  it('includes the selected reading style in the reading prompt payload', () => {
    const prompt = buildReadingPrompt({
      spreadType: 'tres-cartas',
      readingStyle: 'acolhedora',
      cardLines: ['O Mago (passado)', 'A Lua (presente)', 'O Sol (futuro)'],
      question: 'O que preciso enxergar?',
      ragContext: 'contexto tecnico',
      historyContext: '',
    })

    expect(prompt).toContain('Estilo da leitura: acolhedora')
  })

  it('injects the probe Q&A section only when probeContext is provided', () => {
    const base = {
      spreadType: 'tres-cartas' as const,
      readingStyle: 'sincera' as const,
      cardLines: ['O Sol (futuro)'],
      question: 'Ele volta?',
      ragContext: 'rag',
      historyContext: '',
    }

    const without = buildReadingPrompt(base)
    expect(without).not.toContain('O QUE A CONSULENTE RESPONDEU')

    const withProbe = buildReadingPrompt({
      ...base,
      probeContext: 'P: Faz quanto tempo?\nR: Dois meses',
    })
    expect(withProbe).toContain('O QUE A CONSULENTE RESPONDEU')
    expect(withProbe).toContain('Dois meses')
  })
})
