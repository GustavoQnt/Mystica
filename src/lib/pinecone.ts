import { Pinecone } from '@pinecone-database/pinecone'

let pinecone: Pinecone | null = null

function getClient() {
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  }

  return pinecone
}

export function getIndex() {
  return getClient().index(process.env.PINECONE_INDEX_NAME!)
}

export interface HybridQueryParams {
  cardIds: number[]
  semanticText: string
  topK: number
  supplementarySlug?: string
}

export interface HybridQuery {
  filter?: Record<string, unknown>
  topK: number
  semanticText: string
}

export function buildHybridQuery(params: HybridQueryParams): HybridQuery {
  const { cardIds, semanticText, topK, supplementarySlug } = params
  const filters: Record<string, unknown>[] = []

  if (cardIds.length > 0) {
    filters.push({ card_id: { $in: cardIds } })
  }

  if (supplementarySlug) {
    filters.push({
      content_type: 'supplementary',
      slug: supplementarySlug,
    })
  }

  return {
    ...(filters.length === 1
      ? { filter: filters[0] }
      : filters.length > 1
        ? { filter: { $and: filters } }
        : {}),
    topK,
    semanticText,
  }
}

export async function hybridSearch(
  params: HybridQueryParams,
  embedding: number[]
): Promise<string[]> {
  const query = buildHybridQuery(params)
  const result = await getIndex().query({
    vector: embedding,
    topK: query.topK,
    filter: query.filter,
    includeMetadata: true,
  })

  return (result.matches ?? [])
    .map((match) => match.metadata?.text)
    .filter((text): text is string => typeof text === 'string' && text.length > 0)
}
