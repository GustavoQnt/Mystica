import { NextResponse } from 'next/server'

import { decryptForUser } from '@/lib/encryption'
import { parseProbeQA } from '@/lib/probe'
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
    .select('id, status, spread_type, question, card_ids, interpretation, metadata, created_at, updated_at, reading_style, extra_context')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!reading) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (reading.status !== 'completed') {
    const safeReading = Object.fromEntries(
      Object.entries(reading).filter(
        ([key]) => key !== 'card_ids' && key !== 'extra_context'
      )
    )
    return NextResponse.json({
      reading: {
        ...safeReading,
        reading_style: resolveReadingStyle(reading.reading_style),
      },
    })
  }

  let probeQa: { question: string; answer: string }[] = []
  if (reading.extra_context) {
    try {
      const saved = await decryptForUser(user.id, reading.extra_context)
      probeQa = parseProbeQA(JSON.parse(saved ?? '[]'))
    } catch {
      probeQa = []
    }
  }

  const safeReading = Object.fromEntries(
    Object.entries(reading).filter(([key]) => key !== 'extra_context')
  )
  const decryptedReading = {
    ...safeReading,
    question: await decryptForUser(user.id, reading.question),
    interpretation: await decryptForUser(user.id, reading.interpretation),
    reading_style: resolveReadingStyle(reading.reading_style),
    probe_qa: probeQa,
  }

  return NextResponse.json({ reading: decryptedReading })
}
