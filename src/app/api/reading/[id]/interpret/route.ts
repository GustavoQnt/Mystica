import { extractMetadata, streamInterpretation } from '@/lib/gemini'
import { decryptForUser, encryptForUser } from '@/lib/encryption'
import { incrementCompletedReadings } from '@/lib/reading-limits'
import { buildReadingContext } from '@/lib/rag'
import { createClient } from '@/lib/supabase/server'
import type { SpreadType } from '@/lib/tarot'
import { checkRateLimit } from '@/lib/rate-limit'

function encodeSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 1. Rate Limit Check (Technical Shield)
  // Prevent the user from spamming the generation endpoint too fast.
  const rateLimitResult = await checkRateLimit(user.id)
  
  if (!rateLimitResult.success) {
    return new Response('Too Many Requests. Please slow down and try again in a few seconds.', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
      },
    })
  }

  const { data: reading } = await supabase
    .from('readings')
    .select('id, status, spread_type, card_ids, question, interpretation, metadata')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!reading) {
    return new Response('Not found', { status: 404 })
  }

  if (reading.status === 'completed' && reading.interpretation) {
    const interpretation = await decryptForUser(user.id, reading.interpretation)

    return new Response(interpretation, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  if (reading.status !== 'drawn' && reading.status !== 'failed') {
    return new Response('Reading is not in a drawable state', { status: 409 })
  }

  if (reading.status === 'failed') {
    await supabase
      .from('readings')
      .update({
        status: 'drawn',
        interpretation: null,
        metadata: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
  }

  let prompt: string

  try {
    prompt = await buildReadingContext({
      supabase,
      userId: user.id,
      cardIds: reading.card_ids,
      spreadType: reading.spread_type as SpreadType,
      question: reading.question ?? '',
    })
  } catch {
    await supabase
      .from('readings')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', id)

    return new Response('RAG pipeline failed', { status: 500 })
  }

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            encodeSseEvent('cards', {
              reading_id: reading.id,
              spread_type: reading.spread_type,
              card_ids: reading.card_ids,
            })
          )
        )

        const result = await streamInterpretation(prompt)

        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (!text) {
            continue
          }

          fullText += text
          controller.enqueue(encoder.encode(encodeSseEvent('text', { chunk: text })))
        }

        await supabase
          .from('readings')
          .update({
            status: 'completed',
            question: await encryptForUser(user.id, reading.question ?? ''),
            interpretation: await encryptForUser(user.id, fullText),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        await incrementCompletedReadings(supabase, user.id)

        controller.enqueue(encoder.encode(encodeSseEvent('done', { complete: true })))
        controller.close()

        extractMetadata(fullText)
          .then((metadata) =>
            supabase
              .from('readings')
              .update({ metadata, updated_at: new Date().toISOString() })
              .eq('id', id)
          )
          .catch(() => undefined)
      } catch (error) {
        await supabase
          .from('readings')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', id)

        controller.enqueue(
          encoder.encode(
            encodeSseEvent('error', {
              message: error instanceof Error ? error.message : 'Interpretation failed',
            })
          )
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
