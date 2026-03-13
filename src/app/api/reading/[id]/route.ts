import { NextResponse } from 'next/server'

import { decryptForUser } from '@/lib/encryption'
import { resolveReadingStyle } from '@/lib/reading-style'
import { createClient } from '@/lib/supabase/server'

export async function GET(
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

  const { data: reading } = await supabase
    .from('readings')
    .select('id, status, spread_type, question, card_ids, interpretation, metadata, created_at, updated_at, reading_style')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!reading) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (reading.status !== 'completed') {
    const safeReading = Object.fromEntries(
      Object.entries(reading).filter(([key]) => key !== 'card_ids')
    )
    return NextResponse.json({
      reading: {
        ...safeReading,
        reading_style: resolveReadingStyle(reading.reading_style),
      },
    })
  }

  const decryptedReading = {
    ...reading,
    question: await decryptForUser(user.id, reading.question),
    interpretation: await decryptForUser(user.id, reading.interpretation),
    reading_style: resolveReadingStyle(reading.reading_style),
  }

  return NextResponse.json({ reading: decryptedReading })
}
