import { NextResponse } from 'next/server'

import { generateProbeQuestions } from '@/lib/gemini'
import { retrieveReadingKnowledge } from '@/lib/rag'
import { checkRateLimit } from '@/lib/rate-limit'
import { resolveReadingStyle } from '@/lib/reading-style'
import { createClient } from '@/lib/supabase/server'
import type { SpreadType } from '@/lib/tarot'

// "Mystica pergunta": after the cards are drawn, generate 1-3 sharp,
// card-anchored clarifying questions in Mystica's voice. The answers (sent later
// to /interpret) give the reading real specificity instead of confabulation.
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(user.id)
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429, headers: { 'Retry-After': Math.ceil((rateLimit.reset - Date.now()) / 1000).toString() } }
    )
  }

  const { data: reading } = await supabase
    .from('readings')
    .select('id, status, spread_type, card_ids, question, reading_style')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!reading) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (reading.status !== 'drawn') {
    return NextResponse.json(
      { error: 'Reading is not in a drawable state' },
      { status: 409 }
    )
  }

  // No cards to anchor questions to (e.g. card-do-dia / dream): skip gracefully.
  if (!reading.card_ids || reading.card_ids.length === 0) {
    return NextResponse.json({ questions: [] })
  }

  const readingStyle = resolveReadingStyle(reading.reading_style)

  try {
    const { cardLines, ragContext } = await retrieveReadingKnowledge({
      supabase,
      userId: user.id,
      cardIds: reading.card_ids,
      spreadType: reading.spread_type as SpreadType,
      readingStyle,
      question: reading.question ?? '',
    })

    const questions = await generateProbeQuestions({
      spreadType: reading.spread_type as SpreadType,
      readingStyle,
      cardLines,
      question: reading.question ?? '',
      ragContext,
    })

    return NextResponse.json({ questions })
  } catch (error) {
    // Probe is an enhancement, never a blocker: on failure, return no questions
    // and let the reading proceed normally.
    console.error('Probe generation failed:', error)
    return NextResponse.json({ questions: [] })
  }
}
