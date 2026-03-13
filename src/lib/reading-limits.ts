import type { SupabaseClient } from '@supabase/supabase-js'

const FREE_MONTHLY_LIMIT = 5

interface ProfileRow {
  plan: 'free' | 'paid'
  readings_this_month: number
  month_cycle: string
}

export function getCurrentMonthCycle(date = new Date()) {
  return date.toISOString().slice(0, 7)
}

export async function getProfileForDrawCheck(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileRow | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, readings_this_month, month_cycle')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return null
  }

  const currentCycle = getCurrentMonthCycle()

  if (profile.month_cycle !== currentCycle) {
    const resetProfile: ProfileRow = {
      plan: profile.plan,
      readings_this_month: 0,
      month_cycle: currentCycle,
    }

    await supabase
      .from('profiles')
      .update({
        readings_this_month: 0,
        month_cycle: currentCycle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    return resetProfile
  }

  return profile as ProfileRow
}

export function hasReachedFreeLimit(profile: ProfileRow | null) {
  return profile?.plan === 'free' && profile.readings_this_month >= FREE_MONTHLY_LIMIT
}

export async function incrementCompletedReadings(
  supabase: SupabaseClient,
  userId: string
) {
  const profile = await getProfileForDrawCheck(supabase, userId)

  if (!profile) {
    return
  }

  await supabase
    .from('profiles')
    .update({
      readings_this_month: profile.readings_this_month + 1,
      month_cycle: getCurrentMonthCycle(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}
