import { NextResponse } from 'next/server'

import {
  getProfileForDrawCheck,
  hasReachedFreeLimit,
} from '@/lib/reading-limits'
import { createClient } from '@/lib/supabase/server'
import { resolveCards, SPREAD_SIZES, type SpreadType } from '@/lib/tarot'

interface DrawRequestBody {
  spread_type: SpreadType
  fan_indices: number[]
  question: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: DrawRequestBody

  try {
    body = (await request.json()) as DrawRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { spread_type, fan_indices, question } = body

  if (!spread_type || !(spread_type in SPREAD_SIZES)) {
    return NextResponse.json({ error: 'Invalid spread_type' }, { status: 400 })
  }

  if (typeof question !== 'string' || question.trim().length < 3) {
    return NextResponse.json({ error: 'Question must have at least 3 characters' }, { status: 400 })
  }

  let cardIds: number[]

  try {
    cardIds = resolveCards(Array.isArray(fan_indices) ? fan_indices : [], spread_type)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid fan_indices' },
      { status: 400 }
    )
  }

  const profile = await getProfileForDrawCheck(supabase, user.id)

  if (hasReachedFreeLimit(profile)) {
    return NextResponse.json(
      { error: 'Voce atingiu o limite de 5 leituras este mes' },
      { status: 403 }
    )
  }

  const { data: reading, error } = await supabase
    .from('readings')
    .insert({
      user_id: user.id,
      status: 'drawn',
      spread_type,
      question: question.trim(),
      card_ids: cardIds,
    })
    .select('id')
    .single()

  if (error || !reading) {
    return NextResponse.json({ error: 'Failed to save reading' }, { status: 500 })
  }

  return NextResponse.json({ reading_id: reading.id }, { status: 201 })
}
