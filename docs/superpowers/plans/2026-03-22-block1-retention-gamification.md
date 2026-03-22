# Block 1: Retention & Gamification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement card of the day with streak tracking, card collection, achievements system, and monthly retrospective.

**Architecture:** Lazy-generated daily content (card + ritual + moon data) cached in a `daily_content` table. Per-user streak, collection, and achievement tracking via dedicated tables. Monthly retrospective generated on-demand via Gemini and cached. All user-facing data protected by RLS. Streak updates wrapped in a PostgreSQL function to prevent race conditions.

**Tech Stack:** Next.js 16 (App Router), Supabase PostgreSQL (RLS), Google Gemini (interpretation), Upstash Redis (rate limiting), AES-256-GCM encryption, Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-22-mystica-roadmap-features-design.md` — Block 1

---

## File Structure

### New files
- `supabase/migrations/003_daily_content_and_streaks.sql` — migration for all Block 1 tables
- `src/lib/daily-content.ts` — lazy generation + cache logic for daily content
- `src/lib/moon.ts` — moon phase calculation + esoteric correspondences
- `src/lib/streaks.ts` — streak update logic
- `src/lib/achievements.ts` — achievement checking + granting
- `src/lib/collection.ts` — card collection unlock logic
- `src/app/api/daily/route.ts` — GET daily content endpoint
- `src/app/api/daily/reveal/route.ts` — POST reveal daily card endpoint
- `src/app/api/collection/route.ts` — GET user card collection
- `src/app/api/achievements/route.ts` — GET user achievements
- `src/app/api/retrospective/route.ts` — GET monthly retrospective
- `src/components/DailyCardSection.tsx` — card of the day UI on home
- `src/components/StreakCounter.tsx` — streak display component
- `src/components/CardCollection.tsx` — collection grid page component
- `src/components/CardMiniSheet.tsx` — card detail overlay
- `src/components/AchievementBadge.tsx` — achievement display
- `src/app/colecao/page.tsx` — collection page
- `src/app/retrospectiva/page.tsx` — retrospective page
- `src/lib/__tests__/moon.test.ts`
- `src/lib/__tests__/streaks.test.ts`
- `src/lib/__tests__/achievements.test.ts`
- `src/lib/__tests__/collection.test.ts`
- `src/lib/__tests__/daily-content.test.ts`
- `src/app/api/__tests__/daily-route.test.ts`
- `src/app/api/__tests__/daily-reveal-route.test.ts`
- `src/app/api/__tests__/retrospective-route.test.ts`

### Modified files
- `src/app/page.tsx` — add DailyCardSection to home
- `src/app/sections.tsx` — add daily content fetching
- `src/app/api/reading/[id]/interpret/route.ts` — hook card collection unlock after interpretation

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/003_daily_content_and_streaks.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================
-- Block 1: Retention & Gamification tables
-- ============================================

-- Daily content (global, lazy-cached per day)
create table if not exists daily_content (
  id uuid primary key default gen_random_uuid(),
  date date unique not null,
  card_id integer not null,
  interpretation text not null,
  ritual text not null,
  moon_phase text not null,
  moon_element text not null,
  moon_color text not null,
  moon_energy text not null,
  created_at timestamptz default now()
);

alter table daily_content enable row level security;

create policy "Authenticated users can read daily content"
  on daily_content for select
  to authenticated
  using (true);

-- SECURITY DEFINER function to insert daily content (bypasses RLS)
create or replace function insert_daily_content(
  p_date date,
  p_card_id integer,
  p_interpretation text,
  p_ritual text,
  p_moon_phase text,
  p_moon_element text,
  p_moon_color text,
  p_moon_energy text
)
returns daily_content as $$
declare
  v_result daily_content;
begin
  insert into daily_content (date, card_id, interpretation, ritual, moon_phase, moon_element, moon_color, moon_energy)
  values (p_date, p_card_id, p_interpretation, p_ritual, p_moon_phase, p_moon_element, p_moon_color, p_moon_energy)
  on conflict (date) do nothing
  returning * into v_result;

  -- If conflict (another request already inserted), fetch existing
  if v_result is null then
    select * into v_result from daily_content where daily_content.date = p_date;
  end if;

  return v_result;
end;
$$ language plpgsql security definer;

-- User daily reveal tracking
create table if not exists user_daily_reveal (
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  revealed_at timestamptz default now(),
  primary key (user_id, date)
);

alter table user_daily_reveal enable row level security;

create policy "Users can view own reveals"
  on user_daily_reveal for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own reveals"
  on user_daily_reveal for insert
  to authenticated
  with check (auth.uid() = user_id);

-- User streaks
create table if not exists user_streaks (
  user_id uuid primary key references auth.users on delete cascade not null,
  current_streak integer default 0 not null,
  longest_streak integer default 0 not null,
  last_reveal_date date
);

alter table user_streaks enable row level security;

create policy "Users can view own streaks"
  on user_streaks for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can upsert own streaks"
  on user_streaks for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own streaks"
  on user_streaks for update
  to authenticated
  using (auth.uid() = user_id);

-- User card collection
create table if not exists user_card_collection (
  user_id uuid references auth.users on delete cascade not null,
  card_id integer not null,
  unlocked_at timestamptz default now(),
  source text not null check (source in ('daily', 'reading')),
  primary key (user_id, card_id)
);

alter table user_card_collection enable row level security;

create policy "Users can view own collection"
  on user_card_collection for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own collection"
  on user_card_collection for insert
  to authenticated
  with check (auth.uid() = user_id);

create index idx_user_card_collection_user on user_card_collection (user_id);

-- User achievements
create table if not exists user_achievements (
  user_id uuid references auth.users on delete cascade not null,
  achievement_id text not null,
  unlocked_at timestamptz default now(),
  primary key (user_id, achievement_id)
);

alter table user_achievements enable row level security;

create policy "Users can view own achievements"
  on user_achievements for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own achievements"
  on user_achievements for insert
  to authenticated
  with check (auth.uid() = user_id);

-- User retrospectives (monthly, cached)
create table if not exists user_retrospectives (
  user_id uuid references auth.users on delete cascade not null,
  month text not null,
  content text not null,
  created_at timestamptz default now(),
  primary key (user_id, month)
);

alter table user_retrospectives enable row level security;

create policy "Users can view own retrospectives"
  on user_retrospectives for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own retrospectives"
  on user_retrospectives for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own retrospectives"
  on user_retrospectives for update
  to authenticated
  using (auth.uid() = user_id);

-- Streak update function (prevents race conditions)
create or replace function update_streak(p_user_id uuid, p_date date)
returns table(current_streak integer, longest_streak integer) as $$
declare
  v_last_date date;
  v_current integer;
  v_longest integer;
begin
  -- Lock the row (or create if not exists)
  insert into user_streaks (user_id, current_streak, longest_streak, last_reveal_date)
  values (p_user_id, 0, 0, null)
  on conflict (user_id) do nothing;

  select us.last_reveal_date, us.current_streak, us.longest_streak
  into v_last_date, v_current, v_longest
  from user_streaks us
  where us.user_id = p_user_id
  for update;

  -- Already revealed today
  if v_last_date = p_date then
    return query select v_current, v_longest;
    return;
  end if;

  -- Consecutive day
  if v_last_date = p_date - interval '1 day' then
    v_current := v_current + 1;
  else
    v_current := 1;
  end if;

  if v_current > v_longest then
    v_longest := v_current;
  end if;

  update user_streaks
  set current_streak = v_current,
      longest_streak = v_longest,
      last_reveal_date = p_date
  where user_streaks.user_id = p_user_id;

  return query select v_current, v_longest;
end;
$$ language plpgsql;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` (or the project's migration approach)
Expected: All tables, policies, indexes, and function created successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_daily_content_and_streaks.sql
git commit -m "feat: add Block 1 database migration (daily content, streaks, collection, achievements, retrospectives)"
```

---

## Task 2: Moon Phase Calculation

**Files:**
- Create: `src/lib/moon.ts`
- Create: `src/lib/__tests__/moon.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/moon.test.ts
import { describe, it, expect } from 'vitest'
import { getMoonPhase, getMoonData } from '../moon'

describe('getMoonPhase', () => {
  it('returns "Lua Nova" for a known new moon date', () => {
    // Jan 29, 2025 was a known new moon
    const phase = getMoonPhase(new Date('2025-01-29'))
    expect(phase).toBe('Lua Nova')
  })

  it('returns "Lua Cheia" for a known full moon date', () => {
    // Jan 13, 2025 was a known full moon
    const phase = getMoonPhase(new Date('2025-01-13'))
    expect(phase).toBe('Lua Cheia')
  })

  it('returns one of the 8 valid phases', () => {
    const validPhases = [
      'Lua Nova', 'Lua Crescente', 'Quarto Crescente', 'Gibosa Crescente',
      'Lua Cheia', 'Gibosa Minguante', 'Quarto Minguante', 'Lua Minguante'
    ]
    const phase = getMoonPhase(new Date('2026-03-22'))
    expect(validPhases).toContain(phase)
  })
})

describe('getMoonData', () => {
  it('returns phase, element, color, and energy', () => {
    const data = getMoonData(new Date('2026-03-22'))
    expect(data).toHaveProperty('phase')
    expect(data).toHaveProperty('element')
    expect(data).toHaveProperty('color')
    expect(data).toHaveProperty('energy')
    expect(typeof data.phase).toBe('string')
    expect(typeof data.element).toBe('string')
    expect(typeof data.color).toBe('string')
    expect(typeof data.energy).toBe('string')
  })

  it('element is one of the 4 classical elements', () => {
    const data = getMoonData(new Date('2026-03-22'))
    expect(['Fogo', 'Terra', 'Ar', 'Água']).toContain(data.element)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/moon.test.ts`
Expected: FAIL — module `../moon` not found

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/moon.ts

export interface MoonData {
  phase: string
  element: string
  color: string
  energy: string
}

const PHASES = [
  'Lua Nova', 'Lua Crescente', 'Quarto Crescente', 'Gibosa Crescente',
  'Lua Cheia', 'Gibosa Minguante', 'Quarto Minguante', 'Lua Minguante'
] as const

// Esoteric correspondences: phase → element, color, energy
const PHASE_CORRESPONDENCES: Record<string, { element: string; color: string; energy: string }> = {
  'Lua Nova':            { element: 'Terra', color: 'Preto',    energy: 'Introspecção e novos começos' },
  'Lua Crescente':       { element: 'Água',  color: 'Prata',    energy: 'Intenção e planejamento' },
  'Quarto Crescente':    { element: 'Fogo',  color: 'Vermelho', energy: 'Ação e determinação' },
  'Gibosa Crescente':    { element: 'Ar',    color: 'Amarelo',  energy: 'Refinamento e ajuste' },
  'Lua Cheia':           { element: 'Fogo',  color: 'Dourado',  energy: 'Culminação e celebração' },
  'Gibosa Minguante':    { element: 'Ar',    color: 'Azul',     energy: 'Gratidão e compartilhamento' },
  'Quarto Minguante':    { element: 'Água',  color: 'Roxo',     energy: 'Liberação e desapego' },
  'Lua Minguante':       { element: 'Terra', color: 'Branco',   energy: 'Descanso e entrega' },
}

/**
 * Calculate moon phase using synodic cycle.
 * Reference new moon: Jan 6, 2000 18:14 UTC (Julian day 2451550.26)
 */
export function getMoonPhase(date: Date): string {
  const SYNODIC_PERIOD = 29.53058770576
  const REFERENCE_NEW_MOON = new Date('2000-01-06T18:14:00Z')

  const diffMs = date.getTime() - REFERENCE_NEW_MOON.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  const cyclePosition = ((diffDays % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD
  const phaseIndex = Math.floor((cyclePosition / SYNODIC_PERIOD) * 8) % 8

  return PHASES[phaseIndex]
}

/**
 * Get full moon data for a date: phase, element, color, energy.
 * Element is a blend of moon phase and day-of-week correspondences.
 */
export function getMoonData(date: Date): MoonData {
  const phase = getMoonPhase(date)
  const correspondence = PHASE_CORRESPONDENCES[phase]

  return {
    phase,
    element: correspondence.element,
    color: correspondence.color,
    energy: correspondence.energy,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/moon.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/moon.ts src/lib/__tests__/moon.test.ts
git commit -m "feat: add moon phase calculation with esoteric correspondences"
```

---

## Task 3: Streak Logic

**Files:**
- Create: `src/lib/streaks.ts`
- Create: `src/lib/__tests__/streaks.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/streaks.test.ts
import { describe, it, expect, vi } from 'vitest'
import { updateStreak, getStreak } from '../streaks'

// Mock Supabase client
function createMockSupabase(rpcResult: { current_streak: number; longest_streak: number } | null = null, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: rpcResult ? [rpcResult] : null,
      error,
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: rpcResult ? { current_streak: rpcResult.current_streak, longest_streak: rpcResult.longest_streak, last_reveal_date: '2026-03-21' } : null,
            error,
          }),
        }),
      }),
    }),
  } as any
}

describe('updateStreak', () => {
  it('calls the update_streak RPC function', async () => {
    const supabase = createMockSupabase({ current_streak: 1, longest_streak: 1 })
    const result = await updateStreak(supabase, 'user-123', new Date('2026-03-22'))
    expect(supabase.rpc).toHaveBeenCalledWith('update_streak', {
      p_user_id: 'user-123',
      p_date: '2026-03-22',
    })
    expect(result).toEqual({ current_streak: 1, longest_streak: 1 })
  })

  it('throws on RPC error', async () => {
    const supabase = createMockSupabase(null, { message: 'DB error' })
    await expect(updateStreak(supabase, 'user-123', new Date('2026-03-22'))).rejects.toThrow('DB error')
  })
})

describe('getStreak', () => {
  it('returns streak data for user', async () => {
    const supabase = createMockSupabase({ current_streak: 5, longest_streak: 10 })
    const result = await getStreak(supabase, 'user-123')
    expect(result).toHaveProperty('current_streak')
    expect(result).toHaveProperty('longest_streak')
  })

  it('returns zero streak if no row exists', async () => {
    const mock = createMockSupabase(null)
    const result = await getStreak(mock, 'user-123')
    expect(result).toEqual({ current_streak: 0, longest_streak: 0, last_reveal_date: null })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/streaks.test.ts`
Expected: FAIL — module `../streaks` not found

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/streaks.ts
import { SupabaseClient } from '@supabase/supabase-js'

export interface StreakData {
  current_streak: number
  longest_streak: number
  last_reveal_date: string | null
}

/**
 * Update streak via the database function (race-condition safe).
 * Returns updated streak values.
 */
export async function updateStreak(
  supabase: SupabaseClient,
  userId: string,
  date: Date
): Promise<{ current_streak: number; longest_streak: number }> {
  const dateStr = date.toISOString().split('T')[0]

  const { data, error } = await supabase.rpc('update_streak', {
    p_user_id: userId,
    p_date: dateStr,
  })

  if (error) throw new Error(error.message)

  const row = Array.isArray(data) ? data[0] : data
  return {
    current_streak: row.current_streak,
    longest_streak: row.longest_streak,
  }
}

/**
 * Get current streak for a user. Returns zeros if no streak exists.
 */
export async function getStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<StreakData> {
  const { data, error } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak, last_reveal_date')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return { current_streak: 0, longest_streak: 0, last_reveal_date: null }
  }

  return data as StreakData
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/streaks.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/streaks.ts src/lib/__tests__/streaks.test.ts
git commit -m "feat: add streak update and retrieval logic"
```

---

## Task 4: Card Collection Logic

**Files:**
- Create: `src/lib/collection.ts`
- Create: `src/lib/__tests__/collection.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/collection.test.ts
import { describe, it, expect, vi } from 'vitest'
import { unlockCards, getCollection } from '../collection'

function createMockSupabase(existingCards: number[] = []) {
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: existingCards.map(id => ({ card_id: id, unlocked_at: '2026-03-22', source: 'reading' })),
          error: null,
        }),
      }),
      upsert: upsertMock,
    }),
    _upsertMock: upsertMock,
  } as any
}

describe('unlockCards', () => {
  it('upserts cards with source and user_id', async () => {
    const supabase = createMockSupabase()
    await unlockCards(supabase, 'user-123', [0, 5, 10], 'reading')
    expect(supabase.from).toHaveBeenCalledWith('user_card_collection')
    expect(supabase._upsertMock).toHaveBeenCalledWith(
      [
        { user_id: 'user-123', card_id: 0, source: 'reading' },
        { user_id: 'user-123', card_id: 5, source: 'reading' },
        { user_id: 'user-123', card_id: 10, source: 'reading' },
      ],
      { onConflict: 'user_id,card_id', ignoreDuplicates: true }
    )
  })

  it('skips empty card list', async () => {
    const supabase = createMockSupabase()
    await unlockCards(supabase, 'user-123', [], 'reading')
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('getCollection', () => {
  it('returns user card collection', async () => {
    const supabase = createMockSupabase([0, 5, 10])
    const result = await getCollection(supabase, 'user-123')
    expect(result).toHaveLength(3)
    expect(result[0]).toHaveProperty('card_id')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/collection.test.ts`
Expected: FAIL — module `../collection` not found

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/collection.ts
import { SupabaseClient } from '@supabase/supabase-js'

export interface CollectionEntry {
  card_id: number
  unlocked_at: string
  source: 'daily' | 'reading'
}

/**
 * Unlock cards in user's collection. Ignores duplicates.
 */
export async function unlockCards(
  supabase: SupabaseClient,
  userId: string,
  cardIds: number[],
  source: 'daily' | 'reading'
): Promise<void> {
  if (cardIds.length === 0) return

  const rows = cardIds.map(cardId => ({
    user_id: userId,
    card_id: cardId,
    source,
  }))

  const { error } = await supabase
    .from('user_card_collection')
    .upsert(rows, { onConflict: 'user_id,card_id', ignoreDuplicates: true })

  if (error) throw new Error(error.message)
}

/**
 * Get all cards in user's collection.
 */
export async function getCollection(
  supabase: SupabaseClient,
  userId: string
): Promise<CollectionEntry[]> {
  const { data, error } = await supabase
    .from('user_card_collection')
    .select('card_id, unlocked_at, source')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return (data ?? []) as CollectionEntry[]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/collection.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/collection.ts src/lib/__tests__/collection.test.ts
git commit -m "feat: add card collection unlock and retrieval logic"
```

---

## Task 5: Achievements System

**Files:**
- Create: `src/lib/achievements.ts`
- Create: `src/lib/__tests__/achievements.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/achievements.test.ts
import { describe, it, expect, vi } from 'vitest'
import { checkAndGrantAchievements, ACHIEVEMENT_DEFINITIONS, type AchievementTrigger } from '../achievements'

function createMockSupabase(opts: {
  existingAchievements?: string[]
  collectionCount?: number
  majorCount?: number
  suitsCount?: number
  readingsCount?: number
  dailyRevealsCount?: number
} = {}) {
  const {
    existingAchievements = [],
    collectionCount = 0,
    majorCount = 0,
    suitsCount = 0,
    readingsCount = 0,
    dailyRevealsCount = 0,
  } = opts

  return {
    from: vi.fn((table: string) => {
      if (table === 'user_achievements') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: existingAchievements.map(id => ({ achievement_id: id })),
              error: null,
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'user_card_collection') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: Array(collectionCount).fill({ card_id: 0 }),
              error: null,
            }),
          }),
        }
      }
      if (table === 'readings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: Array(readingsCount).fill({}),
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'user_daily_reveal') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: Array(dailyRevealsCount).fill({}),
              error: null,
            }),
          }),
        }
      }
      return { select: vi.fn() }
    }),
  } as any
}

describe('ACHIEVEMENT_DEFINITIONS', () => {
  it('has all 7 achievement definitions', () => {
    expect(Object.keys(ACHIEVEMENT_DEFINITIONS)).toHaveLength(7)
  })

  it('each achievement has trigger, check function, label, and description', () => {
    for (const [id, def] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
      expect(def).toHaveProperty('trigger')
      expect(def).toHaveProperty('check')
      expect(def).toHaveProperty('label')
      expect(def).toHaveProperty('description')
      expect(typeof def.check).toBe('function')
    }
  })
})

describe('checkAndGrantAchievements', () => {
  it('only checks achievements matching the trigger type', async () => {
    const supabase = createMockSupabase({ readingsCount: 1 })
    const granted = await checkAndGrantAchievements(supabase, 'user-123', 'reading')
    // Should not check streak or card_unlock achievements
    expect(Array.isArray(granted)).toBe(true)
  })

  it('does not re-grant existing achievements', async () => {
    const supabase = createMockSupabase({
      existingAchievements: ['first_reading'],
      readingsCount: 1,
    })
    const granted = await checkAndGrantAchievements(supabase, 'user-123', 'reading')
    expect(granted).not.toContain('first_reading')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/achievements.test.ts`
Expected: FAIL — module `../achievements` not found

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/achievements.ts
import { SupabaseClient } from '@supabase/supabase-js'

export type AchievementTrigger = 'reading' | 'daily_reveal' | 'streak' | 'card_unlock'

interface AchievementDef {
  trigger: AchievementTrigger
  check: (supabase: SupabaseClient, userId: string, context?: any) => Promise<boolean>
  label: string
  description: string
}

export const ACHIEVEMENT_DEFINITIONS: Record<string, AchievementDef> = {
  first_reading: {
    trigger: 'reading',
    label: 'Primeira Tiragem',
    description: 'Completou sua primeira leitura de tarot',
    check: async (supabase, userId) => {
      const { data } = await supabase
        .from('readings')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'completed')
      return (data?.length ?? 0) >= 1
    },
  },
  first_daily: {
    trigger: 'daily_reveal',
    label: 'Primeiro Amanhecer',
    description: 'Revelou sua primeira carta do dia',
    check: async (supabase, userId) => {
      const { data } = await supabase
        .from('user_daily_reveal')
        .select('date')
        .eq('user_id', userId)
      return (data?.length ?? 0) >= 1
    },
  },
  '7_day_streak': {
    trigger: 'streak',
    label: 'Semana Mística',
    description: '7 dias consecutivos revelando a carta do dia',
    check: async (supabase, userId, context?: { current_streak: number }) => {
      return (context?.current_streak ?? 0) >= 7
    },
  },
  '30_day_streak': {
    trigger: 'streak',
    label: 'Mês Iluminado',
    description: '30 dias consecutivos revelando a carta do dia',
    check: async (supabase, userId, context?: { current_streak: number }) => {
      return (context?.current_streak ?? 0) >= 30
    },
  },
  all_major_arcana: {
    trigger: 'card_unlock',
    label: 'Guardião dos Arcanos Maiores',
    description: 'Coletou todos os 22 arcanos maiores',
    check: async (supabase, userId) => {
      const { data } = await supabase
        .from('user_card_collection')
        .select('card_id')
        .eq('user_id', userId)
      const majorIds = (data ?? []).filter((r: { card_id: number }) => r.card_id <= 21)
      return majorIds.length >= 22
    },
  },
  all_suits: {
    trigger: 'card_unlock',
    label: 'Explorador dos Naipes',
    description: 'Coletou pelo menos uma carta de cada naipe',
    check: async (supabase, userId) => {
      const { data } = await supabase
        .from('user_card_collection')
        .select('card_id')
        .eq('user_id', userId)
      const ids = (data ?? []).map((r: { card_id: number }) => r.card_id)
      // Copas: 22-35, Espadas: 36-49, Ouros: 50-63, Paus: 64-77
      const hasCopas = ids.some((id: number) => id >= 22 && id <= 35)
      const hasEspadas = ids.some((id: number) => id >= 36 && id <= 49)
      const hasOuros = ids.some((id: number) => id >= 50 && id <= 63)
      const hasPaus = ids.some((id: number) => id >= 64 && id <= 77)
      return hasCopas && hasEspadas && hasOuros && hasPaus
    },
  },
  '78_cards': {
    trigger: 'card_unlock',
    label: 'Colecionador Supremo',
    description: 'Coletou todas as 78 cartas do tarot',
    check: async (supabase, userId) => {
      const { data } = await supabase
        .from('user_card_collection')
        .select('card_id')
        .eq('user_id', userId)
      return (data?.length ?? 0) >= 78
    },
  },
}

/**
 * Check and grant achievements for a given trigger.
 * Only evaluates achievements matching the trigger type.
 * Returns list of newly granted achievement IDs.
 */
export async function checkAndGrantAchievements(
  supabase: SupabaseClient,
  userId: string,
  trigger: AchievementTrigger,
  context?: any
): Promise<string[]> {
  // Get existing achievements
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)

  const existingIds = new Set((existing ?? []).map((r: { achievement_id: string }) => r.achievement_id))

  // Filter to matching trigger, skip already granted
  const candidates = Object.entries(ACHIEVEMENT_DEFINITIONS).filter(
    ([id, def]) => def.trigger === trigger && !existingIds.has(id)
  )

  const granted: string[] = []

  for (const [id, def] of candidates) {
    const met = await def.check(supabase, userId, context)
    if (met) {
      await supabase
        .from('user_achievements')
        .upsert({ user_id: userId, achievement_id: id }, { onConflict: 'user_id,achievement_id' })
      granted.push(id)
    }
  }

  return granted
}

/**
 * Get all achievements for a user.
 */
export async function getAchievements(
  supabase: SupabaseClient,
  userId: string
): Promise<{ achievement_id: string; unlocked_at: string }[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return (data ?? []) as { achievement_id: string; unlocked_at: string }[]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/achievements.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/achievements.ts src/lib/__tests__/achievements.test.ts
git commit -m "feat: add achievements system with trigger-based checking"
```

---

## Task 6: Daily Content Generation (Lazy Cache)

**Files:**
- Create: `src/lib/daily-content.ts`
- Create: `src/lib/__tests__/daily-content.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/daily-content.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetMoonData, mockStreamInterpretation } = vi.hoisted(() => ({
  mockGetMoonData: vi.fn(),
  mockStreamInterpretation: vi.fn(),
}))

vi.mock('../moon', () => ({ getMoonData: mockGetMoonData }))
vi.mock('../gemini', () => ({
  streamInterpretation: mockStreamInterpretation,
  extractMetadata: vi.fn(),
}))

import { getOrCreateDailyContent, type DailyContent } from '../daily-content'

function createMockSupabase(existingContent: DailyContent | null = null) {
  const insertMock = vi.fn().mockResolvedValue({ error: null })
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: existingContent,
            error: existingContent ? null : { code: 'PGRST116' },
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: existingContent ?? {
              date: '2026-03-22',
              card_id: 5,
              interpretation: 'Test interpretation',
              ritual: 'Test ritual',
              moon_phase: 'Lua Cheia',
              moon_element: 'Fogo',
              moon_color: 'Dourado',
              moon_energy: 'Culminação',
            },
            error: null,
          }),
        }),
      }),
    }),
    _insertMock: insertMock,
  } as any
}

describe('getOrCreateDailyContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMoonData.mockReturnValue({
      phase: 'Lua Cheia',
      element: 'Fogo',
      color: 'Dourado',
      energy: 'Culminação e celebração',
    })
  })

  it('returns cached content if exists for today', async () => {
    const cached: DailyContent = {
      date: '2026-03-22',
      card_id: 5,
      interpretation: 'Cached interpretation',
      ritual: 'Cached ritual',
      moon_phase: 'Lua Cheia',
      moon_element: 'Fogo',
      moon_color: 'Dourado',
      moon_energy: 'Culminação',
    }
    const supabase = createMockSupabase(cached)
    const result = await getOrCreateDailyContent(supabase, new Date('2026-03-22'))
    expect(result.interpretation).toBe('Cached interpretation')
  })

  it('returns content with all required fields', async () => {
    const supabase = createMockSupabase(null)
    mockStreamInterpretation.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => 'Generated text' }
      })(),
    })
    const result = await getOrCreateDailyContent(supabase, new Date('2026-03-22'))
    expect(result).toHaveProperty('card_id')
    expect(result).toHaveProperty('interpretation')
    expect(result).toHaveProperty('ritual')
    expect(result).toHaveProperty('moon_phase')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/daily-content.test.ts`
Expected: FAIL — module `../daily-content` not found

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/daily-content.ts
import { SupabaseClient } from '@supabase/supabase-js'
import { getMoonData } from './moon'
import { streamInterpretation } from './gemini'
import { getSystemPromptForStyle } from './prompts'
import { getCard } from './tarot'

export interface DailyContent {
  date: string
  card_id: number
  interpretation: string
  ritual: string
  moon_phase: string
  moon_element: string
  moon_color: string
  moon_energy: string
}

/**
 * Get or create daily content. Uses lazy caching:
 * first request of the day generates, subsequent reads from DB.
 * Uses ON CONFLICT to handle race conditions.
 */
export async function getOrCreateDailyContent(
  supabase: SupabaseClient,
  date: Date
): Promise<DailyContent> {
  const dateStr = date.toISOString().split('T')[0]

  // Try cache first
  const { data: cached } = await supabase
    .from('daily_content')
    .select('date, card_id, interpretation, ritual, moon_phase, moon_element, moon_color, moon_energy')
    .eq('date', dateStr)
    .single()

  if (cached) return cached as DailyContent

  // Generate new content
  const content = await generateDailyContent(date)

  // Insert via SECURITY DEFINER function (bypasses RLS, handles race conditions)
  const { data: inserted, error } = await supabase.rpc('insert_daily_content', {
    p_date: dateStr,
    p_card_id: content.card_id,
    p_interpretation: content.interpretation,
    p_ritual: content.ritual,
    p_moon_phase: content.moon_phase,
    p_moon_element: content.moon_element,
    p_moon_color: content.moon_color,
    p_moon_energy: content.moon_energy,
  })

  if (error) throw new Error(`Failed to create daily content: ${error.message}`)

  return inserted as DailyContent
}

async function generateDailyContent(date: Date) {
  // Pick random card
  const cardId = Math.floor(Math.random() * 78)
  const card = getCard(cardId)

  // Moon data (algorithmic)
  const moon = getMoonData(date)

  // Generate interpretation + ritual in a single Gemini call
  const systemPrompt = getSystemPromptForStyle('acolhedora')
  const userPrompt = buildDailyPrompt(card.name, moon)

  let fullText = ''
  const stream = await streamInterpretation(userPrompt, systemPrompt)
  for await (const chunk of stream.stream) {
    fullText += chunk.text()
  }

  // Split interpretation and ritual from response
  const { interpretation, ritual } = parseDailyResponse(fullText)

  return {
    card_id: cardId,
    interpretation,
    ritual,
    moon_phase: moon.phase,
    moon_element: moon.element,
    moon_color: moon.color,
    moon_energy: moon.energy,
  }
}

function buildDailyPrompt(cardName: string, moon: { phase: string; element: string; energy: string }): string {
  return `Você é a Mystica gerando o conteúdo do dia.

CARTA DO DIA: ${cardName}
FASE LUNAR: ${moon.phase}
ELEMENTO: ${moon.element}
ENERGIA: ${moon.energy}

Gere duas seções separadas por "---RITUAL---":

1. INTERPRETAÇÃO DA CARTA DO DIA (3-4 parágrafos): Uma mensagem acolhedora e universal sobre o que a carta ${cardName} traz para o dia de hoje, considerando a fase lunar ${moon.phase}. Não use segunda pessoa específica — fale de forma que qualquer pessoa se identifique.

2. RITUAL DO DIA (após o separador): Um ritual simples para hoje baseado na carta e na fase lunar. Inclua: tipo (meditação, cristal, mantra ou banho de ervas), duração estimada, e instruções breves em 3-4 passos.`
}

function parseDailyResponse(text: string): { interpretation: string; ritual: string } {
  const separator = '---RITUAL---'
  const idx = text.indexOf(separator)
  if (idx === -1) {
    return { interpretation: text, ritual: '' }
  }
  return {
    interpretation: text.slice(0, idx).trim(),
    ritual: text.slice(idx + separator.length).trim(),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/daily-content.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/daily-content.ts src/lib/__tests__/daily-content.test.ts
git commit -m "feat: add daily content lazy generation with cache"
```

---

## Task 7: Daily Content API Routes

**Files:**
- Create: `src/app/api/daily/route.ts`
- Create: `src/app/api/daily/reveal/route.ts`
- Create: `src/app/api/__tests__/daily-route.test.ts`
- Create: `src/app/api/__tests__/daily-reveal-route.test.ts`

- [ ] **Step 1: Write the failing tests for GET /api/daily**

```typescript
// src/app/api/__tests__/daily-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetOrCreateDailyContent, mockGetUser, mockGetStreak, mockFrom } = vi.hoisted(() => ({
  mockGetOrCreateDailyContent: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetStreak: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/daily-content', () => ({
  getOrCreateDailyContent: mockGetOrCreateDailyContent,
}))
vi.mock('@/lib/streaks', () => ({
  getStreak: mockGetStreak,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: mockFrom,
  }),
}))

import { GET } from '../daily/route'

describe('GET /api/daily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    mockGetStreak.mockResolvedValue({ current_streak: 3, longest_streak: 10, last_reveal_date: '2026-03-21' })
    mockGetOrCreateDailyContent.mockResolvedValue({
      date: '2026-03-22',
      card_id: 5,
      interpretation: 'test',
      ritual: 'test ritual',
      moon_phase: 'Lua Cheia',
      moon_element: 'Fogo',
      moon_color: 'Dourado',
      moon_energy: 'Culminação',
    })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No user' } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns daily content with streak data', async () => {
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('daily')
    expect(body).toHaveProperty('streak')
    expect(body.daily.card_id).toBe(5)
    expect(body.streak.current_streak).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/__tests__/daily-route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write GET /api/daily endpoint**

```typescript
// src/app/api/daily/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateDailyContent } from '@/lib/daily-content'
import { getStreak } from '@/lib/streaks'
import { getCard } from '@/lib/tarot'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date()
    const [daily, streak] = await Promise.all([
      getOrCreateDailyContent(supabase, today),
      getStreak(supabase, user.id),
    ])

    // Enrich with card data (server-side, avoids shipping cards.json to client)
    const card = getCard(daily.card_id)

    // Check if user already revealed today
    const todayStr = today.toISOString().split('T')[0]
    const { data: reveal } = await supabase
      .from('user_daily_reveal')
      .select('revealed_at')
      .eq('user_id', user.id)
      .eq('date', todayStr)
      .single()

    return NextResponse.json({
      daily: {
        ...daily,
        card_name: card.name,
        card_arcana: card.arcana_type,
        card_suit: card.suit,
      },
      streak,
      revealed: !!reveal,
    })
  } catch (err) {
    console.error('Failed to get daily content:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Write the failing tests for POST /api/daily/reveal**

```typescript
// src/app/api/__tests__/daily-reveal-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockUpdateStreak, mockUnlockCards, mockCheckAndGrantAchievements, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateStreak: vi.fn(),
  mockUnlockCards: vi.fn(),
  mockCheckAndGrantAchievements: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: mockFrom,
  }),
}))
vi.mock('@/lib/streaks', () => ({
  updateStreak: mockUpdateStreak,
}))
vi.mock('@/lib/collection', () => ({
  unlockCards: mockUnlockCards,
}))
vi.mock('@/lib/achievements', () => ({
  checkAndGrantAchievements: mockCheckAndGrantAchievements,
}))

import { POST } from '../daily/reveal/route'

describe('POST /api/daily/reveal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    mockUpdateStreak.mockResolvedValue({ current_streak: 1, longest_streak: 1 })
    mockUnlockCards.mockResolvedValue(undefined)
    mockCheckAndGrantAchievements.mockResolvedValue([])
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { card_id: 5 }, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No user' } })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('reveals card and returns streak + achievements', async () => {
    const res = await POST()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('streak')
    expect(body).toHaveProperty('achievements')
    expect(mockUpdateStreak).toHaveBeenCalled()
    expect(mockUnlockCards).toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: Write POST /api/daily/reveal endpoint**

```typescript
// src/app/api/daily/reveal/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateStreak } from '@/lib/streaks'
import { unlockCards } from '@/lib/collection'
import { checkAndGrantAchievements } from '@/lib/achievements'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Get today's daily content to know the card_id
    const { data: daily } = await supabase
      .from('daily_content')
      .select('card_id')
      .eq('date', todayStr)
      .single()

    if (!daily) {
      return NextResponse.json({ error: 'Daily content not generated yet' }, { status: 404 })
    }

    // Insert reveal (PK constraint prevents duplicates)
    const { error: revealError } = await supabase
      .from('user_daily_reveal')
      .insert({ user_id: user.id, date: todayStr })

    // If duplicate, return idempotently
    if (revealError?.code === '23505') {
      const streak = await import('@/lib/streaks').then(m => m.getStreak(supabase, user.id))
      return NextResponse.json({ streak, achievements: [], already_revealed: true })
    }

    if (revealError) throw revealError

    // Update streak (race-safe via DB function)
    const streak = await updateStreak(supabase, user.id, today)

    // Unlock card in collection
    await unlockCards(supabase, user.id, [daily.card_id], 'daily')

    // Check achievements (multiple triggers)
    const achievementsFromReveal = await checkAndGrantAchievements(supabase, user.id, 'daily_reveal')
    const achievementsFromStreak = await checkAndGrantAchievements(supabase, user.id, 'streak', streak)
    const achievementsFromCard = await checkAndGrantAchievements(supabase, user.id, 'card_unlock')

    const allNewAchievements = [
      ...achievementsFromReveal,
      ...achievementsFromStreak,
      ...achievementsFromCard,
    ]

    return NextResponse.json({
      streak,
      achievements: allNewAchievements,
      already_revealed: false,
    })
  } catch (err) {
    console.error('Failed to reveal daily card:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run src/app/api/__tests__/daily-route.test.ts src/app/api/__tests__/daily-reveal-route.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/daily/route.ts src/app/api/daily/reveal/route.ts src/app/api/__tests__/daily-route.test.ts src/app/api/__tests__/daily-reveal-route.test.ts
git commit -m "feat: add GET /api/daily and POST /api/daily/reveal endpoints"
```

---

## Task 8: Collection & Achievements API Routes

**Files:**
- Create: `src/app/api/collection/route.ts`
- Create: `src/app/api/achievements/route.ts`

- [ ] **Step 1: Write GET /api/collection**

```typescript
// src/app/api/collection/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCollection } from '@/lib/collection'
import { getCard } from '@/lib/tarot'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const collection = await getCollection(supabase, user.id)
    // Enrich with card data server-side
    const enriched = collection.map(entry => {
      const card = getCard(entry.card_id)
      return {
        ...entry,
        card_name: card.name,
        card_arcana: card.arcana_type,
        card_suit: card.suit,
        card_number: card.number,
      }
    })
    return NextResponse.json({ collection: enriched, total: enriched.length })
  } catch (err) {
    console.error('Failed to get collection:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write GET /api/achievements**

```typescript
// src/app/api/achievements/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAchievements, ACHIEVEMENT_DEFINITIONS } from '@/lib/achievements'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const unlocked = await getAchievements(supabase, user.id)

    // Enrich with labels and descriptions
    const achievements = Object.entries(ACHIEVEMENT_DEFINITIONS).map(([id, def]) => {
      const earned = unlocked.find(a => a.achievement_id === id)
      return {
        id,
        label: def.label,
        description: def.description,
        unlocked: !!earned,
        unlocked_at: earned?.unlocked_at ?? null,
      }
    })

    return NextResponse.json({ achievements })
  } catch (err) {
    console.error('Failed to get achievements:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/collection/route.ts src/app/api/achievements/route.ts
git commit -m "feat: add GET /api/collection and GET /api/achievements endpoints"
```

---

## Task 9: Retrospective API Route

**Files:**
- Create: `src/app/api/retrospective/route.ts`
- Create: `src/app/api/__tests__/retrospective-route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/__tests__/retrospective-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockFrom, mockCheckRateLimit, mockStreamInterpretation, mockEncryptForUser, mockDecryptForUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockStreamInterpretation: vi.fn(),
  mockEncryptForUser: vi.fn(),
  mockDecryptForUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: mockFrom,
  }),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/gemini', () => ({
  streamInterpretation: mockStreamInterpretation,
}))
vi.mock('@/lib/encryption', () => ({
  encryptForUser: mockEncryptForUser,
  decryptForUser: mockDecryptForUser,
}))

import { GET } from '../retrospective/route'

describe('GET /api/retrospective', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    mockCheckRateLimit.mockResolvedValue({ success: true })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No user' } })
    const req = new Request('http://localhost/api/retrospective?month=2026-02')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for future month', async () => {
    const req = new Request('http://localhost/api/retrospective?month=2099-01')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid month format', async () => {
    const req = new Request('http://localhost/api/retrospective?month=invalid')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/__tests__/retrospective-route.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/app/api/retrospective/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { streamInterpretation } from '@/lib/gemini'
import { encryptForUser, decryptForUser } from '@/lib/encryption'
import { getCard } from '@/lib/tarot'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

  // Validate month format (YYYY-MM)
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM.' }, { status: 400 })
  }

  // Reject future months
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (month > currentMonth) {
    return NextResponse.json({ error: 'Cannot generate retrospective for future months.' }, { status: 400 })
  }

  // Rate limit
  const rateLimit = await checkRateLimit(`retrospective:${user.id}`)
  if (!rateLimit.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const isCurrentMonth = month === currentMonth

    // Check cache (skip for current month — user may have new readings)
    if (!isCurrentMonth) {
      const { data: cached } = await supabase
        .from('user_retrospectives')
        .select('content, created_at')
        .eq('user_id', user.id)
        .eq('month', month)
        .single()

      if (cached) {
        const decrypted = await decryptForUser(user.id, cached.content)
        return NextResponse.json({ month, content: decrypted, cached: true })
      }
    }

    // Fetch readings for the month
    const startDate = `${month}-01`
    const [year, mon] = month.split('-').map(Number)
    const endDate = new Date(year, mon, 0).toISOString().split('T')[0]

    const { data: readings } = await supabase
      .from('readings')
      .select('card_ids, metadata, created_at, spread_type')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: true })

    if (!readings || readings.length === 0) {
      return NextResponse.json({ month, content: null, message: 'Nenhuma leitura neste mês.' })
    }

    // Build retrospective prompt
    const prompt = buildRetrospectivePrompt(readings, month)
    const systemPrompt = `Você é a Mystica, gerando uma retrospectiva mística mensal. Seja acolhedora, perspicaz e profunda. Analise os padrões e ofereça insights sobre a jornada espiritual do consulente neste mês.`

    let fullText = ''
    const stream = await streamInterpretation(prompt, systemPrompt)
    for await (const chunk of stream.stream) {
      fullText += chunk.text()
    }

    // Encrypt and cache (upsert for current month updates)
    const encrypted = await encryptForUser(user.id, fullText)
    await supabase
      .from('user_retrospectives')
      .upsert({ user_id: user.id, month, content: encrypted }, { onConflict: 'user_id,month' })

    return NextResponse.json({ month, content: fullText, cached: false })
  } catch (err) {
    console.error('Failed to generate retrospective:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildRetrospectivePrompt(readings: any[], month: string): string {
  const cardFrequency: Record<string, number> = {}
  const themes: string[] = []
  const journalingNotes: string[] = []

  for (const reading of readings) {
    // Count card frequency
    if (reading.card_ids) {
      for (const cardId of reading.card_ids) {
        const card = getCard(cardId)
        cardFrequency[card.name] = (cardFrequency[card.name] || 0) + 1
      }
    }

    // Collect metadata
    if (reading.metadata) {
      if (reading.metadata.themes) themes.push(...reading.metadata.themes)
      if (reading.metadata.journaling_note) journalingNotes.push(reading.metadata.journaling_note)
    }
  }

  const topCards = Object.entries(cardFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count}x)`)

  return `Gere uma retrospectiva mística para o mês ${month}.

DADOS DO MÊS:
- Total de leituras: ${readings.length}
- Cartas mais frequentes: ${topCards.join(', ') || 'N/A'}
- Temas recorrentes: ${[...new Set(themes)].join(', ') || 'N/A'}
- Notas de reflexão: ${journalingNotes.join(' | ') || 'Nenhuma'}

Estruture a retrospectiva em:
1. VISÃO GERAL — O que o mês trouxe em termos de energia e direção
2. CARTAS RECORRENTES — O que a repetição dessas cartas significa
3. TEMAS E PADRÕES — Conexões entre as leituras
4. EVOLUÇÃO — Como a jornada espiritual evoluiu ao longo do mês
5. MENSAGEM PARA O PRÓXIMO MÊS — Um conselho baseado nos padrões observados`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/__tests__/retrospective-route.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/retrospective/route.ts src/app/api/__tests__/retrospective-route.test.ts
git commit -m "feat: add GET /api/retrospective with lazy generation and encryption"
```

---

## Task 10: Hook Card Collection Into Existing Interpret Endpoint

**Files:**
- Modify: `src/app/api/reading/[id]/interpret/route.ts`

- [ ] **Step 1: Read the current interpret route**

Read file: `src/app/api/reading/[id]/interpret/route.ts`

- [ ] **Step 2: Add card collection unlock after successful interpretation**

At the end of the interpret route, after `incrementCompletedReadings` is called, add:

```typescript
// Import at top of file
import { unlockCards } from '@/lib/collection'
import { checkAndGrantAchievements } from '@/lib/achievements'

// After incrementCompletedReadings(supabase, user.id), add:
if (reading.card_ids && reading.card_ids.length > 0) {
  unlockCards(supabase, user.id, reading.card_ids, 'reading').catch(console.error)
  checkAndGrantAchievements(supabase, user.id, 'card_unlock').catch(console.error)
}
checkAndGrantAchievements(supabase, user.id, 'reading').catch(console.error)
```

These are fire-and-forget (`.catch(console.error)`) to not block the SSE stream.

- [ ] **Step 3: Run existing interpret tests to verify no regression**

Run: `npx vitest run src/app/api/__tests__/reading-interpret-encryption.test.ts`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reading/[id]/interpret/route.ts
git commit -m "feat: hook card collection unlock and achievements into interpret endpoint"
```

---

## Task 11: Frontend — DailyCardSection Component

**Files:**
- Create: `src/components/DailyCardSection.tsx`
- Create: `src/components/StreakCounter.tsx`

- [ ] **Step 1: Create StreakCounter component**

```typescript
// src/components/StreakCounter.tsx
'use client'

interface StreakCounterProps {
  currentStreak: number
  longestStreak: number
}

export default function StreakCounter({ currentStreak, longestStreak }: StreakCounterProps) {
  if (currentStreak === 0) return null

  return (
    <div className="flex items-center gap-2 text-sm text-amber-400">
      <span className="text-lg">🔥</span>
      <span>{currentStreak} {currentStreak === 1 ? 'dia' : 'dias'} consecutivos</span>
      {longestStreak > currentStreak && (
        <span className="text-xs text-gray-500">(recorde: {longestStreak})</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create DailyCardSection component**

```typescript
// src/components/DailyCardSection.tsx
'use client'

import { useState, useEffect } from 'react'
import StreakCounter from './StreakCounter'

interface DailyData {
  daily: {
    date: string
    card_id: number
    card_name: string
    card_arcana: string
    card_suit: string | null
    interpretation: string
    ritual: string
    moon_phase: string
    moon_element: string
    moon_color: string
    moon_energy: string
  }
  streak: {
    current_streak: number
    longest_streak: number
  }
  revealed: boolean
}

export default function DailyCardSection() {
  const [data, setData] = useState<DailyData | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revealing, setRevealing] = useState(false)

  useEffect(() => {
    fetch('/api/daily')
      .then(res => res.json())
      .then(d => {
        setData(d)
        setRevealed(d.revealed)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleReveal = async () => {
    if (revealing || revealed) return
    setRevealing(true)

    try {
      const res = await fetch('/api/daily/reveal', { method: 'POST' })
      const result = await res.json()

      setRevealed(true)
      if (data) {
        setData({
          ...data,
          streak: result.streak,
        })
      }
    } catch (err) {
      console.error('Failed to reveal:', err)
    } finally {
      setRevealing(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl bg-gray-900/50 p-6 animate-pulse">
        <div className="h-6 w-40 bg-gray-800 rounded mb-4" />
        <div className="h-48 bg-gray-800 rounded" />
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="rounded-2xl bg-gray-900/50 border border-gray-800 p-6">
      {/* Moon banner */}
      <div className="text-sm text-gray-400 mb-4 flex items-center gap-2 flex-wrap">
        <span>{data.daily.moon_phase}</span>
        <span>·</span>
        <span>Elemento {data.daily.moon_element}</span>
        <span>·</span>
        <span>Cor: {data.daily.moon_color}</span>
        <span>·</span>
        <span>{data.daily.moon_energy}</span>
      </div>

      <h2 className="text-xl font-semibold text-white mb-4">Carta do Dia</h2>

      <StreakCounter
        currentStreak={data.streak.current_streak}
        longestStreak={data.streak.longest_streak}
      />

      <div className="mt-4">
        {!revealed ? (
          <button
            onClick={handleReveal}
            disabled={revealing}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50"
          >
            {revealing ? 'Revelando...' : 'Revelar Carta do Dia'}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{data.daily.card_name}</p>
              <p className="text-sm text-gray-400">
                {data.daily.card_arcana === 'major' ? 'Arcano Maior' : data.daily.card_suit}
              </p>
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <p>{data.daily.interpretation}</p>
            </div>
            {data.daily.ritual && (
              <div className="mt-4 p-4 rounded-lg bg-purple-900/20 border border-purple-800/30">
                <h3 className="text-sm font-semibold text-purple-300 mb-2">Ritual do Dia</h3>
                <p className="text-sm text-gray-300">{data.daily.ritual}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DailyCardSection.tsx src/components/StreakCounter.tsx
git commit -m "feat: add DailyCardSection and StreakCounter components"
```

---

## Task 12: Integrate DailyCardSection into Home Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Read the current home page**

Read file: `src/app/page.tsx`

- [ ] **Step 2: Add DailyCardSection import and render at top of home**

Add import at top:
```typescript
import DailyCardSection from '@/components/DailyCardSection'
```

Add the section after the hero and before AdviceSection:
```tsx
{/* Daily Card Section */}
<DailyCardSection />
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx next build` (or `npm run build`)
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add card of the day section to home page"
```

---

## Task 13: Collection Page

**Files:**
- Create: `src/components/CardMiniSheet.tsx`
- Create: `src/components/CardCollection.tsx`
- Create: `src/app/colecao/page.tsx`

- [ ] **Step 1: Create CardMiniSheet component**

```typescript
// src/components/CardMiniSheet.tsx
'use client'

interface CardMiniSheetProps {
  card: {
    card_id: number
    card_name: string
    card_arcana: string
    card_suit: string | null
    card_number: number
  }
  onClose: () => void
}

export default function CardMiniSheet({ card, onClose }: CardMiniSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">{card.card_name}</h3>
            <p className="text-sm text-gray-400">
              {card.card_arcana === 'major' ? 'Arcano Maior' : `Arcano Menor — ${card.card_suit}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            ✕
          </button>
        </div>
        <div className="text-sm text-gray-300">
          <p>Número: {card.card_number}</p>
          {card.card_suit && <p>Naipe: {card.card_suit}</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create CardCollection component**

```typescript
// src/components/CardCollection.tsx
'use client'

import { useState, useEffect } from 'react'
import CardMiniSheet from './CardMiniSheet'

interface EnrichedCard {
  card_id: number
  card_name: string
  card_arcana: string
  card_suit: string | null
  card_number: number
  unlocked_at: string
  source: string
}

export default function CardCollection() {
  const [collection, setCollection] = useState<EnrichedCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<EnrichedCard | null>(null)

  useEffect(() => {
    fetch('/api/collection')
      .then(res => res.json())
      .then(data => {
        setCollection(data.collection)
        setTotal(data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const unlockedMap = new Map(collection.map(c => [c.card_id, c]))

  if (loading) {
    return <div className="animate-pulse grid grid-cols-6 gap-2">
      {Array(78).fill(0).map((_, i) => (
        <div key={i} className="h-20 bg-gray-800 rounded" />
      ))}
    </div>
  }

  return (
    <>
      <div className="mb-4 text-center">
        <p className="text-lg text-gray-300">
          <span className="text-white font-bold">{total}</span>/78 cartas coletadas
        </p>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {Array.from({ length: 78 }, (_, id) => {
          const entry = unlockedMap.get(id)
          return (
            <button
              key={id}
              onClick={() => entry && setSelectedCard(entry)}
              disabled={!entry}
              className={`
                aspect-[2/3] rounded-lg text-xs p-1 flex items-center justify-center text-center transition-all
                ${entry
                  ? 'bg-purple-900/40 border border-purple-700 text-white hover:bg-purple-800/50 cursor-pointer'
                  : 'bg-gray-900/50 border border-gray-800 text-gray-600 cursor-default'}
              `}
              title={entry ? entry.card_name : '???'}
            >
              {entry ? entry.card_name : '?'}
            </button>
          )
        })}
      </div>

      {selectedCard && (
        <CardMiniSheet card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </>
  )
}
```

- [ ] **Step 3: Create collection page**

```typescript
// src/app/colecao/page.tsx
import { AppHeader } from '@/components/AppHeader'
import CardCollection from '@/components/CardCollection'

export default function ColecaoPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Coleção de Cartas</h1>
        <CardCollection />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/CardMiniSheet.tsx src/components/CardCollection.tsx src/app/colecao/page.tsx
git commit -m "feat: add card collection page with mini-sheet overlay"
```

---

## Task 14: Retrospective Page

**Files:**
- Create: `src/app/retrospectiva/page.tsx`

- [ ] **Step 1: Create retrospective page**

```typescript
// src/app/retrospectiva/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { AppHeader } from '@/components/AppHeader'
import ReactMarkdown from 'react-markdown'

export default function RetrospectivaPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    // Default to previous month
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  })
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRetrospective = async (m: string) => {
    setLoading(true)
    setError(null)
    setContent(null)

    try {
      const res = await fetch(`/api/retrospective?month=${m}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao gerar retrospectiva')
        return
      }

      if (data.message) {
        setError(data.message)
        return
      }

      setContent(data.content)
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRetrospective(month)
  }, [month])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Retrospectiva Mística</h1>

        <div className="mb-6">
          <label className="text-sm text-gray-400 mb-1 block">Mês</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        {loading && (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-800 rounded w-3/4" />
            <div className="h-4 bg-gray-800 rounded w-1/2" />
            <div className="h-4 bg-gray-800 rounded w-5/6" />
          </div>
        )}

        {error && (
          <p className="text-gray-400">{error}</p>
        )}

        {content && (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/retrospectiva/page.tsx
git commit -m "feat: add monthly retrospective page"
```

---

## Task 15: Add Navigation Links

**Files:**
- Modify: `src/components/AppHeader.tsx`

- [ ] **Step 1: Read AppHeader**

Read file: `src/components/AppHeader.tsx`

- [ ] **Step 2: Add navigation links for new pages**

Add links to `/colecao` and `/retrospectiva` in the navigation section of AppHeader, following the existing pattern for `/history`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/AppHeader.tsx
git commit -m "feat: add collection and retrospective links to navigation"
```

---

## Task 16: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (existing + new)

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve any issues from full test suite run"
```
