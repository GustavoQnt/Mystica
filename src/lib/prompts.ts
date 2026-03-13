import type { SpreadType } from '@/lib/tarot'

export interface PromptContext {
  spreadType: SpreadType
  cardLines: string[]
  question: string
  ragContext: string
  historyContext: string
}

export const SYSTEM_PROMPT = `Você é Mystica, uma taróloga experiente com décadas de prática no esoterismo brasileiro.

REGRAS:
- Use o conhecimento fornecido como base, mas adicione sua intuição
- Conecte as cartas entre si, mostrando a narrativa da tiragem como um todo
- Use vocabulário do esoterismo brasileiro quando apropriado: axé, caminhos abertos, limpeza energética, amarração emocional, proteção espiritual
- Seja empática mas honesta; não suavize mensagens difíceis
- Adapte a linguagem ao contexto da pergunta
- Se houver memória de leituras anteriores, mencione padrões com delicadeza
- Termine com um conselho prático e acionável`

export function buildReadingPrompt(ctx: PromptContext): string {
  const spreadLabel: Record<SpreadType, string> = {
    'tres-cartas': 'Três Cartas (passado / presente / futuro)',
    'carta-do-dia': 'Carta do Dia',
  }

  const historySection = ctx.historyContext
    ? `[MEMÓRIA DA USUÁRIA]
${ctx.historyContext}

`
    : ''

  return `[CONTEXTO - CONHECIMENTO DO TAROT]
${ctx.ragContext}

${historySection}[TIRAGEM]
Tipo: ${spreadLabel[ctx.spreadType]}
Cartas: ${ctx.cardLines.join(' | ')}
Pergunta: "${ctx.question}"

Faça a leitura completa, conectando as cartas em uma narrativa coesa.`
}

export const METADATA_EXTRACTION_PROMPT = (interpretation: string) => `Dado o seguinte texto de leitura de tarot, extraia os metadados estruturados.

TEXTO:
${interpretation}

Extraia no formato JSON especificado. Seja conciso nos campos de texto.`

export const METADATA_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    themes: {
      type: 'array',
      items: { type: 'string' },
    },
    energy: {
      type: 'string',
    },
    cards_summary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          card_id: { type: 'number' },
          keyword: { type: 'string' },
          position_index: { type: 'number' },
        },
        required: ['card_id', 'keyword', 'position_index'],
      },
    },
    journaling_note: {
      type: 'string',
    },
    next_step_advice: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        why: { type: 'string' },
        timing: { type: 'string' },
      },
      required: ['action', 'why', 'timing'],
    },
  },
  required: ['themes', 'energy', 'cards_summary', 'journaling_note', 'next_step_advice'],
}
