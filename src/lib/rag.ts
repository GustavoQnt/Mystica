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

export interface ReadingKnowledge {
  cardLines: string[]
  ragContext: string
  historyContext: string
}

/**
 * Retrieve everything needed to read a spread: formatted card lines, the RAG
 * knowledge (Pinecone hybrid search), and the user's recent-history context.
 * Shared by the full interpretation and the "Mystica pergunta" probe.
 */
export async function retrieveReadingKnowledge(
  input: OrchestrationInput
): Promise<ReadingKnowledge> {
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

  return {
    cardLines,
    ragContext: uniqueChunks.join('\n\n---\n\n'),
    historyContext: formatHistoryContext(history),
  }
}

export async function buildReadingContext(
  input: OrchestrationInput,
  probeContext?: string
): Promise<string> {
  const { spreadType, readingStyle, question } = input
  const { cardLines, ragContext, historyContext } =
    await retrieveReadingKnowledge(input)

  return buildReadingPrompt({
    spreadType,
    readingStyle,
    cardLines,
    question,
    ragContext,
    historyContext,
    probeContext,
  })
}
