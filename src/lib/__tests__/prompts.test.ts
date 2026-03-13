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

  it('builds an analitica system prompt with Jungian framing', () => {
    const prompt = getSystemPromptForStyle('analitica')

    expect(prompt).toContain('arquétipos')
    expect(prompt).toContain('sombra')
    expect(prompt).toContain('individuação')
    expect(prompt).toContain('psicologia junguiana')
    expect(prompt).toContain('modo subjuntivo')
    expect(prompt).toContain('não como uma bola de cristal')
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
})
