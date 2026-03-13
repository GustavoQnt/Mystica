import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { Pinecone } from '@pinecone-database/pinecone'

const projectRoot = process.cwd()
const knowledgeDir = path.join(projectRoot, 'knowledge')
const cardsPath = path.join(projectRoot, 'src', 'data', 'cards.json')
const maxChunkChars = 2400
const minChunkChars = 160
const upsertBatchSize = 20
const isDryRun = process.argv.includes('--dry-run')
const embeddingBatchSize = 20
const embeddingModelName =
  process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'

/**
 * @typedef {{
 *   id: number
 *   name: string
 *   arcana_type: 'major' | 'minor'
 *   suit: 'copas' | 'espadas' | 'ouros' | 'paus' | null
 *   number: number
 * }} CanonicalCard
 */

/**
 * @typedef {{
 *   sourcePath: string
 *   cardId: number
 *   cardName: string
 *   section: string
 *   text: string
 *   arcanaType: CanonicalCard['arcana_type']
 *   suit: CanonicalCard['suit']
 *   chunkIndex: number
 * }} KnowledgeChunk
 */

function ensureEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function getAllMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return getAllMarkdownFiles(fullPath)
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : []
  }))

  return files.flat().sort((a, b) => a.localeCompare(b))
}

function parseFrontmatter(content, filePath) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    throw new Error(`Missing frontmatter in ${filePath}`)
  }

  const fields = match[1]
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  return Object.fromEntries(fields.map(line => {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line "${line}" in ${filePath}`)
    }

    const key = line.slice(0, separatorIndex).trim()
    const rawValue = line.slice(separatorIndex + 1).trim()
    const value = rawValue === 'null' ? null : rawValue
    return [key, value]
  }))
}

function splitSections(markdown) {
  const sections = []
  const body = markdown.replace(/^---[\s\S]*?---\r?\n?/, '').trim()
  const matches = [...body.matchAll(/^## (.+)$/gm)]

  if (matches.length === 0) {
    return []
  }

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const title = match[1].trim()
    const start = match.index ?? 0
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? body.length) : body.length
    const sectionMarkdown = body.slice(start, end).trim()
    sections.push({ title, markdown: sectionMarkdown })
  }

  return sections
}

function splitLargeSection(sectionMarkdown) {
  if (sectionMarkdown.length <= maxChunkChars) {
    return [sectionMarkdown]
  }

  const lines = sectionMarkdown.split(/\r?\n/)
  const heading = lines.shift() ?? ''
  const paragraphs = lines.join('\n').split(/\r?\n\r?\n/).map(part => part.trim()).filter(Boolean)

  const chunks = []
  let current = heading

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length <= maxChunkChars || current === heading) {
      current = candidate
      continue
    }

    chunks.push(current.trim())
    current = `${heading}\n\n${paragraph}`
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks.filter(chunk => chunk.length >= minChunkChars)
}

function buildChunks(filePath, content, canonicalCard) {
  const sections = splitSections(content)
  if (sections.length === 0) {
    throw new Error(`No level-2 sections found in ${filePath}`)
  }

  return sections.flatMap(section => {
    const fragments = splitLargeSection(section.markdown)
    if (fragments.length === 0) {
      return []
    }

    return fragments.map((text, chunkIndex) => ({
      sourcePath: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
      cardId: canonicalCard.id,
      cardName: canonicalCard.name,
      section: section.title,
      text,
      arcanaType: canonicalCard.arcana_type,
      suit: canonicalCard.suit,
      chunkIndex,
    }))
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRetryDelayMs(error) {
  const retryInfo = error?.errorDetails?.find(detail => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')
  const retryDelay = retryInfo?.retryDelay
  if (typeof retryDelay !== 'string') {
    return 30_000
  }

  const seconds = Number.parseFloat(retryDelay.replace('s', ''))
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : 30_000
}

async function createEmbeddings(model, texts) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await model.batchEmbedContents({
        requests: texts.map(text => ({
          content: {
            role: 'user',
            parts: [{ text }],
          },
          outputDimensionality: 768,
        })),
      })

      return result.embeddings.map(item => item.values)
    } catch (error) {
      if (error?.status === 429 && attempt < 2) {
        await sleep(getRetryDelayMs(error))
        continue
      }

      throw error
    }
  }

  throw new Error('Failed to create embeddings after retries')
}

async function upsertBatch(index, records) {
  if (records.length === 0) return
  await index.upsert({ records })
}

async function main() {
  const cards = /** @type {CanonicalCard[]} */ (JSON.parse(await readFile(cardsPath, 'utf8')))
  const cardsById = new Map(cards.map(card => [card.id, card]))

  const files = await getAllMarkdownFiles(knowledgeDir)
  if (files.length !== cards.length) {
    throw new Error(`Expected ${cards.length} knowledge files, found ${files.length}`)
  }

  const seenCardIds = new Set()
  const allChunks = []

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8')
    const frontmatter = parseFrontmatter(content, filePath)
    const cardId = Number(frontmatter.card_id)

    if (!Number.isInteger(cardId)) {
      throw new Error(`Invalid card_id in ${filePath}`)
    }

    const canonicalCard = cardsById.get(cardId)
    if (!canonicalCard) {
      throw new Error(`Unknown card_id ${cardId} in ${filePath}`)
    }

    if (seenCardIds.has(cardId)) {
      throw new Error(`Duplicate card_id ${cardId} in knowledge files`)
    }

    seenCardIds.add(cardId)

    const frontmatterName = String(frontmatter.card_name ?? '').trim()
    if (frontmatterName !== canonicalCard.name) {
      throw new Error(
        `card_name mismatch in ${filePath}: "${frontmatterName}" != "${canonicalCard.name}"`
      )
    }

    const frontmatterArcana = String(frontmatter.arcana_type ?? '').trim()
    if (frontmatterArcana !== canonicalCard.arcana_type) {
      throw new Error(
        `arcana_type mismatch in ${filePath}: "${frontmatterArcana}" != "${canonicalCard.arcana_type}"`
      )
    }

    const frontmatterSuit = frontmatter.suit === null ? null : String(frontmatter.suit ?? '').trim()
    if (frontmatterSuit !== canonicalCard.suit) {
      throw new Error(
        `suit mismatch in ${filePath}: "${frontmatterSuit}" != "${canonicalCard.suit}"`
      )
    }

    allChunks.push(...buildChunks(filePath, content, canonicalCard))
  }

  if (seenCardIds.size !== cards.length) {
    throw new Error(`Expected ${cards.length} unique card_ids, found ${seenCardIds.size}`)
  }

  console.log(`Found ${files.length} knowledge files`)
  console.log(`Generated ${allChunks.length} chunks`)

  if (isDryRun) {
    console.log('Dry run complete. No embeddings created and nothing was sent to Pinecone.')
    return
  }

  const pineconeApiKey = ensureEnv('PINECONE_API_KEY')
  const pineconeIndexName = ensureEnv('PINECONE_INDEX_NAME')
  const geminiApiKey = ensureEnv('GEMINI_API_KEY')
  const pinecone = new Pinecone({ apiKey: pineconeApiKey })
  const index = pinecone.index(pineconeIndexName)
  const genAI = new GoogleGenerativeAI(geminiApiKey)
  const embeddingModel = genAI.getGenerativeModel({ model: embeddingModelName })

  let upserted = 0
  /** @type {Array<{ id: string, values: number[], metadata: Record<string, string | number> }>} */
  let batch = []

  for (let offset = 0; offset < allChunks.length; offset += embeddingBatchSize) {
    const chunkBatch = allChunks.slice(offset, offset + embeddingBatchSize)
    const embeddings = await createEmbeddings(
      embeddingModel,
      chunkBatch.map(chunk => chunk.text)
    )

    for (let indexInBatch = 0; indexInBatch < chunkBatch.length; indexInBatch += 1) {
      const chunk = chunkBatch[indexInBatch]
      const embedding = embeddings[indexInBatch]
      const record = {
        id: `card-${chunk.cardId}-${slugify(chunk.section)}-${chunk.chunkIndex}`,
        values: embedding,
        metadata: {
          card_id: chunk.cardId,
          card_name: chunk.cardName,
          section: chunk.section,
          arcana_type: chunk.arcanaType,
          suit: chunk.suit ?? '',
          source_path: chunk.sourcePath,
          text: chunk.text,
        },
      }

      batch.push(record)

      if (batch.length >= upsertBatchSize) {
        await upsertBatch(index, batch)
        upserted += batch.length
        batch = []
      }
    }
  }

  if (batch.length > 0) {
    await upsertBatch(index, batch)
    upserted += batch.length
  }

  console.log(`Upserted ${upserted} vectors to Pinecone.`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
