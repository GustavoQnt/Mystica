import type { SupabaseClient } from '@supabase/supabase-js'

import { getCard } from '@/lib/tarot'

export interface RecentReading {
  card_ids: number[]
  journaling_note: string | null
  created_at: string
}

export function formatHistoryContext(readings: RecentReading[]): string {
  if (readings.length === 0) {
    return ''
  }

  return readings.slice(0, 3).map((reading) => {
    const cards = reading.card_ids.map((cardId) => {
      try {
        return getCard(cardId).name
      } catch {
        return String(cardId)
      }
    })

    const date = new Date(reading.created_at).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
    })

    const note = reading.journaling_note ? ` - ${reading.journaling_note}` : ''

    return `${date}: ${cards.join(', ')}${note}`
  }).join('\n')
}

export async function fetchRecentReadings(
  supabase: SupabaseClient,
  userId: string
): Promise<RecentReading[]> {
  const { data, error } = await supabase
    .from('readings')
    .select('card_ids, metadata, created_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(3)

  if (error || !data) {
    return []
  }

  return data.map((reading) => ({
    card_ids: Array.isArray(reading.card_ids) ? reading.card_ids : [],
    journaling_note:
      reading.metadata &&
      typeof reading.metadata === 'object' &&
      'journaling_note' in reading.metadata &&
      typeof reading.metadata.journaling_note === 'string'
        ? reading.metadata.journaling_note
        : null,
    created_at: reading.created_at,
  }))
}
