import { NextResponse } from 'next/server'

import { decryptForUser } from '@/lib/encryption'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const decryptedReadings = await Promise.all(
    (readings ?? []).map(async (reading) => ({
      ...reading,
      question: await decryptForUser(user.id, reading.question),
    }))
  )

  return NextResponse.json({ readings: decryptedReadings })
}
