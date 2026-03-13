import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  const { data: readings, error } = await supabase
    .from('readings')
    .select('id, spread_type, question, card_ids, metadata, created_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
  }

  return NextResponse.json({ readings: readings ?? [] })
}
