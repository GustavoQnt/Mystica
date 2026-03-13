import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  const { data: reading } = await supabase
    .from('readings')
    .select('id, status, spread_type, question, card_ids, interpretation, metadata, created_at, updated_at')
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
    return NextResponse.json({ reading: safeReading })
  }

  return NextResponse.json({ reading })
}
