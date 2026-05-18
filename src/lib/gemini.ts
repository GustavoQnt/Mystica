import {
  GoogleGenerativeAI,
  type GenerateContentStreamResult,
} from '@google/generative-ai'

import {
  METADATA_EXTRACTION_PROMPT,
  METADATA_RESPONSE_SCHEMA,
} from '@/lib/prompts'

let genAI: GoogleGenerativeAI | null = null

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite'
const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  }

  return genAI
}

export interface ReadingMetadata {
  themes: string[]
  energy: string
  cards_summary: Array<{
    card_id: number
    keyword: string
    position_index: number
  }>
  journaling_note: string
  next_step_advice: {
    action: string
    why: string
    timing: string
  }
}

export async function createEmbedding(text: string): Promise<number[]> {
  const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL })
  const result = await model.embedContent({
    content: {
      role: 'user',
      parts: [{ text }],
    },
    outputDimensionality: 768,
  } as never)
  return result.embedding.values
}

export async function streamInterpretation(
  userPrompt: string,
  systemPrompt: string
): Promise<GenerateContentStreamResult> {
  const model = getClient().getGenerativeModel({
    model: TEXT_MODEL,
    systemInstruction: systemPrompt,
  })

  return model.generateContentStream(userPrompt)
}

export async function extractMetadata(
  interpretation: string
): Promise<ReadingMetadata> {
  const model = getClient().getGenerativeModel({
    model: TEXT_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: METADATA_RESPONSE_SCHEMA as never,
    },
  })

  const result = await model.generateContent(
    METADATA_EXTRACTION_PROMPT(interpretation)
  )

  return JSON.parse(result.response.text()) as ReadingMetadata
}
