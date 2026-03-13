import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchRecentReadings, formatHistoryContext } from '@/lib/context-injection'
import { createEmbedding } from '@/lib/gemini'
import { hybridSearch } from '@/lib/pinecone'
import type { ReadingStyle } from '@/lib/reading-style'
import { buildReadingPrompt } from '@/lib/prompts'
import { getCard, getPositionLabel, type SpreadType } from '@/lib/tarot'

export interface OrchestrationInput {
  supabase: SupabaseClient
  userId: string
  cardIds: number[]
  spreadType: SpreadType
  readingStyle: ReadingStyle
  question: string
}

export async function buildReadingContext(
  input: OrchestrationInput
): Promise<string> {
  const { supabase, userId, cardIds, spreadType, readingStyle, question } = input

  const cards = cardIds.map((cardId) => getCard(cardId))
  const cardLines = cards.map((card, index) => (
    `${card.name} (${getPositionLabel(spreadType, index)})`
  ))
  const semanticText = `${question} ${cards.map((card) => card.name).join(' ')}`

  const [embedding, history] = await Promise.all([
    createEmbedding(semanticText),
    fetchRecentReadings(supabase, userId),
  ])

  const [exactChunks, semanticChunks] = await Promise.all([
    hybridSearch({ cardIds, semanticText, topK: 6 }, embedding),
    hybridSearch({ cardIds: [], semanticText, topK: 4 }, embedding),
  ])

  const jungChunks =
    readingStyle === 'analitica'
      ? await hybridSearch(
          {
            cardIds: [],
            semanticText,
            topK: 3,
            supplementarySlug: 'psicologia-junguiana',
          },
          embedding
        )
      : []

  const uniqueChunks = [...jungChunks, ...exactChunks, ...semanticChunks].filter(
    (chunk, index, all) => all.indexOf(chunk) === index
  )

  return buildReadingPrompt({
    spreadType,
    readingStyle,
    cardLines,
    question,
    ragContext: uniqueChunks.join('\n\n---\n\n'),
    historyContext: formatHistoryContext(history),
  })
}
