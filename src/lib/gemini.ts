import {
  GoogleGenerativeAI,
  type GenerateContentStreamResult,
} from '@google/generative-ai'

import {
  METADATA_EXTRACTION_PROMPT,
  METADATA_RESPONSE_SCHEMA,
  PROBE_RESPONSE_SCHEMA,
  buildProbePrompt,
  getProbeSystemPrompt,
  type ProbePromptContext,
} from '@/lib/prompts'

let genAI: GoogleGenerativeAI | null = null

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite'
// Fallback model used when the primary is overloaded (503). Different capacity
// pool, so a primary spike usually doesn't hit it.
const FALLBACK_TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL_FALLBACK || 'gemini-2.5-flash'
const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  }

  return genAI
}

// Transient = worth retrying. Gemini returns 503 (overloaded), 429 (rate),
// and occasional 500/504 under load. Everything else (400/401/404) is a real
// error and must surface immediately.
function isTransientError(error: unknown): boolean {
  const status = (error as { status?: number })?.status
  if (status === 503 || status === 429 || status === 500 || status === 504) {
    return true
  }
  const message = error instanceof Error ? error.message : String(error)
  return /\b(503|500|504|429)\b|overloaded|high demand|service unavailable|unavailable/i.test(
    message
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Run a Gemini call with resilience to transient overload (503/429).
 * Retries with exponential backoff + jitter, escalating to the fallback model
 * after the primary keeps failing. `fn` receives the model name to use.
 */
async function withResilience<T>(
  fn: (modelName: string) => Promise<T>,
  { retries = 4 }: { retries?: number } = {}
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    // First two attempts on primary; escalate to fallback afterwards.
    const modelName = attempt < 2 ? TEXT_MODEL : FALLBACK_TEXT_MODEL
    try {
      return await fn(modelName)
    } catch (error) {
      lastError = error
      if (!isTransientError(error) || attempt === retries) {
        throw error
      }
      const backoff = 500 * 2 ** attempt + Math.floor(Math.random() * 400)
      await delay(backoff)
    }
  }
  throw lastError
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
  // Retry only covers the initial request handshake (where 503s land). Once the
  // stream starts yielding, errors propagate to the caller as before.
  return withResilience((modelName) => {
    const model = getClient().getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    })
    return model.generateContentStream(userPrompt)
  })
}

/**
 * "Mystica pergunta": given the drawn cards + question, generate 1-3 sharp,
 * card-anchored clarifying questions in Mystica's voice. Structured output.
 */
export async function generateProbeQuestions(
  ctx: ProbePromptContext
): Promise<string[]> {
  const result = await withResilience((modelName) => {
    const model = getClient().getGenerativeModel({
      model: modelName,
      systemInstruction: getProbeSystemPrompt(ctx.readingStyle),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: PROBE_RESPONSE_SCHEMA as never,
      },
    })
    return model.generateContent(buildProbePrompt(ctx))
  })

  const parsed = JSON.parse(result.response.text()) as { questions?: unknown }
  const questions = Array.isArray(parsed.questions) ? parsed.questions : []
  return questions
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    .slice(0, 3)
}

export async function extractMetadata(
  interpretation: string
): Promise<ReadingMetadata> {
  const result = await withResilience((modelName) => {
    const model = getClient().getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: METADATA_RESPONSE_SCHEMA as never,
      },
    })
    return model.generateContent(METADATA_EXTRACTION_PROMPT(interpretation))
  })

  return JSON.parse(result.response.text()) as ReadingMetadata
}
