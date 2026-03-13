# Mystica MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Brazilian tarot SaaS where users draw cards from an animated fan and receive AI-generated readings in PT-BR, with journaling context that makes Mystica feel like it knows their story.

**Architecture:** Next.js 15 App Router on Vercel, Supabase for auth + PostgreSQL, Pinecone for RAG (hybrid search: card_id filter + semantic), Gemini for streaming interpretation + metadata extraction. Card draw is server-side (fan_indices → card_ids) to prevent cheating; readings are saved in two phases (draw → interpret) for idempotency.

**Tech Stack:** Next.js 15, TypeScript, Supabase (Auth + PostgreSQL), Pinecone, Google Gemini 2.0 Flash, `@google/generative-ai`, `@pinecone-database/pinecone`, `@supabase/supabase-js`, Vitest for unit tests, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-03-12-mystica-design.md`

---

## Chunk 1: Project Bootstrap + Supabase

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- Create: `.env.local.example`
- Create: `middleware.ts`

- [ ] **Step 1: Scaffold the project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: project files created in current directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @pinecone-database/pinecone @google/generative-ai
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 4: Create `.env.local.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Pinecone
PINECONE_API_KEY=your-api-key
PINECONE_INDEX_NAME=mystica-tarot

# Gemini
GEMINI_API_KEY=your-api-key
```

Copy to `.env.local` and fill in real values.

- [ ] **Step 5: Configure `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
```

- [ ] **Step 6: Commit**

```bash
git init
echo ".env.local" >> .gitignore
echo ".superpowers/" >> .gitignore
git add -A
git commit -m "chore: initialize Next.js 15 project with Supabase/Pinecone/Gemini deps"
```

---

### Task 2: Supabase clients + auth middleware

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Create browser Supabase client**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server Supabase client**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create middleware helper**

`src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 4: Wire up root middleware**

`middleware.ts`:

```ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Supabase clients and auth middleware"
```

---

### Task 3: Database migrations

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create Supabase project**

Go to supabase.com → New project. Copy URL and keys into `.env.local`.

- [ ] **Step 2: Write migration**

`supabase/migrations/001_initial_schema.sql`:

```sql
-- Profiles (extends auth.users)
create table public.profiles (
  id                  uuid primary key references auth.users on delete cascade,
  plan                text not null default 'free' check (plan in ('free', 'paid')),
  readings_this_month int not null default 0,
  month_cycle         text not null default '',
  updated_at          timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Readings
create table public.readings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null,
  status         text not null check (status in ('drawn', 'completed', 'failed')),
  spread_type    text not null check (spread_type in ('tres-cartas', 'carta-do-dia')),
  question       text,
  card_ids       int[] not null,
  interpretation text,
  metadata       jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.readings enable row level security;

create policy "Users can view own readings"
  on public.readings for select
  using (auth.uid() = user_id);

create policy "Users can insert own readings"
  on public.readings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own readings"
  on public.readings for update
  using (auth.uid() = user_id);

-- Index for history queries
create index readings_user_created on public.readings (user_id, created_at desc);
```

- [ ] **Step 3: Run migration in Supabase dashboard**

Go to Supabase Dashboard → SQL Editor → paste and run `001_initial_schema.sql`.

Verify: tables `profiles` and `readings` appear in Table Editor.

- [ ] **Step 4: Enable Google OAuth in Supabase**

Dashboard → Authentication → Providers → Google → enable.
Add Google OAuth credentials (from Google Cloud Console).
Set redirect URL: `http://localhost:3000/auth/callback` (dev) + your Vercel domain (prod).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema — profiles + readings with RLS"
```

---

### Task 4: Auth routes

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Create OAuth callback route**

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

- [ ] **Step 2: Create login page**

`src/app/login/page.tsx`:

```tsx
'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0d0d1a, #1a0a2e)' }}>
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-serif" style={{ color: '#c9a96e' }}>
          Mystica
        </h1>
        <p className="text-sm" style={{ color: '#c9a96e88' }}>
          Sua taróloga digital
        </p>
        <button
          onClick={signInWithGoogle}
          className="px-8 py-3 rounded-lg text-white font-medium"
          style={{ background: 'linear-gradient(90deg, #4a2080, #7b3fa0)' }}
        >
          Entrar com Google
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Test auth flow manually**

```bash
npm run dev
```

Navigate to `http://localhost:3000/login` → click "Entrar com Google" → should redirect through OAuth and back to `/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add auth routes — Google OAuth callback + login page"
```

---

## Chunk 2: Tarot Data + Card Logic

### Task 5: Cards data + tarot logic

**Files:**
- Create: `src/data/cards.json`
- Create: `src/lib/tarot.ts`
- Create: `src/lib/__tests__/tarot.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/__tests__/tarot.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveCards, getCard, SPREAD_SIZES } from '../tarot'

describe('resolveCards', () => {
  it('maps fan_indices to card_ids deterministically', () => {
    const result = resolveCards([0, 1, 2], 'tres-cartas')
    expect(result).toHaveLength(3)
    expect(result.every(id => id >= 0 && id <= 77)).toBe(true)
  })

  it('returns different cards for different indices', () => {
    const r1 = resolveCards([0, 1, 2], 'tres-cartas')
    const r2 = resolveCards([10, 20, 30], 'tres-cartas')
    expect(r1).not.toEqual(r2)
  })

  it('throws if fan_indices length does not match spread size', () => {
    expect(() => resolveCards([0, 1], 'tres-cartas')).toThrow()
    expect(() => resolveCards([0, 1], 'carta-do-dia')).toThrow()
  })

  it('carta-do-dia requires exactly 1 index', () => {
    const result = resolveCards([5], 'carta-do-dia')
    expect(result).toHaveLength(1)
  })
})

describe('getCard', () => {
  it('returns card data by id', () => {
    const card = getCard(0)
    expect(card).toHaveProperty('id', 0)
    expect(card).toHaveProperty('name')
    expect(card).toHaveProperty('arcana_type')
  })

  it('throws for unknown card id', () => {
    expect(() => getCard(999)).toThrow()
  })
})

describe('SPREAD_SIZES', () => {
  it('tres-cartas requires 3 cards', () => {
    expect(SPREAD_SIZES['tres-cartas']).toBe(3)
  })
  it('carta-do-dia requires 1 card', () => {
    expect(SPREAD_SIZES['carta-do-dia']).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm run test:run -- src/lib/__tests__/tarot.test.ts
```

Expected: FAIL — `Cannot find module '../tarot'`

- [ ] **Step 3: Create cards data**

`src/data/cards.json` — array of 78 objects. Major Arcana (0–21) + Minor Arcana (22–77). Example structure:

```json
[
  { "id": 0,  "name": "O Louco",       "arcana_type": "major", "suit": null,    "number": 0  },
  { "id": 1,  "name": "O Mago",        "arcana_type": "major", "suit": null,    "number": 1  },
  { "id": 2,  "name": "A Papisa",      "arcana_type": "major", "suit": null,    "number": 2  },
  { "id": 3,  "name": "A Imperatriz",  "arcana_type": "major", "suit": null,    "number": 3  },
  { "id": 4,  "name": "O Imperador",   "arcana_type": "major", "suit": null,    "number": 4  },
  { "id": 5,  "name": "O Papa",        "arcana_type": "major", "suit": null,    "number": 5  },
  { "id": 6,  "name": "Os Amantes",    "arcana_type": "major", "suit": null,    "number": 6  },
  { "id": 7,  "name": "O Carro",       "arcana_type": "major", "suit": null,    "number": 7  },
  { "id": 8,  "name": "A Força",       "arcana_type": "major", "suit": null,    "number": 8  },
  { "id": 9,  "name": "O Eremita",     "arcana_type": "major", "suit": null,    "number": 9  },
  { "id": 10, "name": "A Roda da Fortuna", "arcana_type": "major", "suit": null, "number": 10 },
  { "id": 11, "name": "A Justiça",     "arcana_type": "major", "suit": null,    "number": 11 },
  { "id": 12, "name": "O Enforcado",   "arcana_type": "major", "suit": null,    "number": 12 },
  { "id": 13, "name": "A Morte",       "arcana_type": "major", "suit": null,    "number": 13 },
  { "id": 14, "name": "A Temperança",  "arcana_type": "major", "suit": null,    "number": 14 },
  { "id": 15, "name": "O Diabo",       "arcana_type": "major", "suit": null,    "number": 15 },
  { "id": 16, "name": "A Torre",       "arcana_type": "major", "suit": null,    "number": 16 },
  { "id": 17, "name": "A Estrela",     "arcana_type": "major", "suit": null,    "number": 17 },
  { "id": 18, "name": "A Lua",         "arcana_type": "major", "suit": null,    "number": 18 },
  { "id": 19, "name": "O Sol",         "arcana_type": "major", "suit": null,    "number": 19 },
  { "id": 20, "name": "O Julgamento",  "arcana_type": "major", "suit": null,    "number": 20 },
  { "id": 21, "name": "O Mundo",       "arcana_type": "major", "suit": null,    "number": 21 },
  { "id": 22, "name": "Ás de Copas",   "arcana_type": "minor", "suit": "copas", "number": 1  },
  { "id": 23, "name": "2 de Copas",    "arcana_type": "minor", "suit": "copas", "number": 2  },
  { "id": 24, "name": "3 de Copas",    "arcana_type": "minor", "suit": "copas", "number": 3  },
  { "id": 25, "name": "4 de Copas",    "arcana_type": "minor", "suit": "copas", "number": 4  },
  { "id": 26, "name": "5 de Copas",    "arcana_type": "minor", "suit": "copas", "number": 5  },
  { "id": 27, "name": "6 de Copas",    "arcana_type": "minor", "suit": "copas", "number": 6  },
  { "id": 28, "name": "7 de Copas",    "arcana_type": "minor", "suit": "copas", "number": 7  },
  { "id": 29, "name": "8 de Copas",    "arcana_type": "minor", "suit": "copas", "number": 8  },
  { "id": 30, "name": "9 de Copas",    "arcana_type": "minor", "suit": "copas", "number": 9  },
  { "id": 31, "name": "10 de Copas",   "arcana_type": "minor", "suit": "copas", "number": 10 },
  { "id": 32, "name": "Valete de Copas","arcana_type": "minor", "suit": "copas", "number": 11 },
  { "id": 33, "name": "Cavaleiro de Copas","arcana_type":"minor","suit":"copas","number":12  },
  { "id": 34, "name": "Rainha de Copas","arcana_type": "minor", "suit": "copas", "number": 13 },
  { "id": 35, "name": "Rei de Copas",  "arcana_type": "minor", "suit": "copas", "number": 14 },
  { "id": 36, "name": "Ás de Espadas", "arcana_type": "minor", "suit": "espadas","number": 1  },
  { "id": 37, "name": "2 de Espadas",  "arcana_type": "minor", "suit": "espadas","number": 2  },
  { "id": 38, "name": "3 de Espadas",  "arcana_type": "minor", "suit": "espadas","number": 3  },
  { "id": 39, "name": "4 de Espadas",  "arcana_type": "minor", "suit": "espadas","number": 4  },
  { "id": 40, "name": "5 de Espadas",  "arcana_type": "minor", "suit": "espadas","number": 5  },
  { "id": 41, "name": "6 de Espadas",  "arcana_type": "minor", "suit": "espadas","number": 6  },
  { "id": 42, "name": "7 de Espadas",  "arcana_type": "minor", "suit": "espadas","number": 7  },
  { "id": 43, "name": "8 de Espadas",  "arcana_type": "minor", "suit": "espadas","number": 8  },
  { "id": 44, "name": "9 de Espadas",  "arcana_type": "minor", "suit": "espadas","number": 9  },
  { "id": 45, "name": "10 de Espadas", "arcana_type": "minor", "suit": "espadas","number": 10 },
  { "id": 46, "name": "Valete de Espadas","arcana_type":"minor","suit":"espadas","number":11 },
  { "id": 47, "name": "Cavaleiro de Espadas","arcana_type":"minor","suit":"espadas","number":12},
  { "id": 48, "name": "Rainha de Espadas","arcana_type":"minor","suit":"espadas","number":13 },
  { "id": 49, "name": "Rei de Espadas","arcana_type": "minor", "suit": "espadas","number": 14 },
  { "id": 50, "name": "Ás de Ouros",   "arcana_type": "minor", "suit": "ouros", "number": 1  },
  { "id": 51, "name": "2 de Ouros",    "arcana_type": "minor", "suit": "ouros", "number": 2  },
  { "id": 52, "name": "3 de Ouros",    "arcana_type": "minor", "suit": "ouros", "number": 3  },
  { "id": 53, "name": "4 de Ouros",    "arcana_type": "minor", "suit": "ouros", "number": 4  },
  { "id": 54, "name": "5 de Ouros",    "arcana_type": "minor", "suit": "ouros", "number": 5  },
  { "id": 55, "name": "6 de Ouros",    "arcana_type": "minor", "suit": "ouros", "number": 6  },
  { "id": 56, "name": "7 de Ouros",    "arcana_type": "minor", "suit": "ouros", "number": 7  },
  { "id": 57, "name": "8 de Ouros",    "arcana_type": "minor", "suit": "ouros", "number": 8  },
  { "id": 58, "name": "9 de Ouros",    "arcana_type": "minor", "suit": "ouros", "number": 9  },
  { "id": 59, "name": "10 de Ouros",   "arcana_type": "minor", "suit": "ouros", "number": 10 },
  { "id": 60, "name": "Valete de Ouros","arcana_type":"minor","suit":"ouros","number":11    },
  { "id": 61, "name": "Cavaleiro de Ouros","arcana_type":"minor","suit":"ouros","number":12 },
  { "id": 62, "name": "Rainha de Ouros","arcana_type":"minor","suit":"ouros","number":13   },
  { "id": 63, "name": "Rei de Ouros",  "arcana_type": "minor", "suit": "ouros", "number": 14 },
  { "id": 64, "name": "Ás de Paus",    "arcana_type": "minor", "suit": "paus",  "number": 1  },
  { "id": 65, "name": "2 de Paus",     "arcana_type": "minor", "suit": "paus",  "number": 2  },
  { "id": 66, "name": "3 de Paus",     "arcana_type": "minor", "suit": "paus",  "number": 3  },
  { "id": 67, "name": "4 de Paus",     "arcana_type": "minor", "suit": "paus",  "number": 4  },
  { "id": 68, "name": "5 de Paus",     "arcana_type": "minor", "suit": "paus",  "number": 5  },
  { "id": 69, "name": "6 de Paus",     "arcana_type": "minor", "suit": "paus",  "number": 6  },
  { "id": 70, "name": "7 de Paus",     "arcana_type": "minor", "suit": "paus",  "number": 7  },
  { "id": 71, "name": "8 de Paus",     "arcana_type": "minor", "suit": "paus",  "number": 8  },
  { "id": 72, "name": "9 de Paus",     "arcana_type": "minor", "suit": "paus",  "number": 9  },
  { "id": 73, "name": "10 de Paus",    "arcana_type": "minor", "suit": "paus",  "number": 10 },
  { "id": 74, "name": "Valete de Paus","arcana_type": "minor", "suit": "paus",  "number": 11 },
  { "id": 75, "name": "Cavaleiro de Paus","arcana_type":"minor","suit":"paus","number":12   },
  { "id": 76, "name": "Rainha de Paus","arcana_type": "minor", "suit": "paus",  "number": 13 },
  { "id": 77, "name": "Rei de Paus",   "arcana_type": "minor", "suit": "paus",  "number": 14 }
]
```

- [ ] **Step 4: Implement `src/lib/tarot.ts`**

```ts
import cardsData from '@/data/cards.json'

export type SpreadType = 'tres-cartas' | 'carta-do-dia'
export type ArcanaType = 'major' | 'minor'
export type Suit = 'copas' | 'espadas' | 'ouros' | 'paus' | null

export interface Card {
  id: number
  name: string
  arcana_type: ArcanaType
  suit: Suit
  number: number
}

export const SPREAD_SIZES: Record<SpreadType, number> = {
  'tres-cartas': 3,
  'carta-do-dia': 1,
}

export const POSITION_LABELS: Record<SpreadType, string[]> = {
  'tres-cartas': ['passado', 'presente', 'futuro'],
  'carta-do-dia': ['presente'],
}

const CARDS: Card[] = cardsData as Card[]

/** Returns a shuffled copy of card IDs (Fisher-Yates) */
function shuffleDeck(): number[] {
  const deck = CARDS.map(c => c.id)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/**
 * Resolves fan_indices (positions in a shuffled deck) to card IDs.
 * The deck is shuffled server-side per request — fan_indices are positional
 * picks the user made from the visual fan. We shuffle, then pick by index.
 */
export function resolveCards(fanIndices: number[], spreadType: SpreadType): number[] {
  const expected = SPREAD_SIZES[spreadType]
  if (fanIndices.length !== expected) {
    throw new Error(
      `${spreadType} requires ${expected} card(s), got ${fanIndices.length}`
    )
  }

  const shuffled = shuffleDeck()

  return fanIndices.map(idx => {
    const clampedIdx = ((idx % shuffled.length) + shuffled.length) % shuffled.length
    return shuffled[clampedIdx]
  })
}

export function getCard(id: number): Card {
  const card = CARDS.find(c => c.id === id)
  if (!card) throw new Error(`Card id ${id} not found`)
  return card
}

export function getPositionLabel(spreadType: SpreadType, positionIndex: number): string {
  return POSITION_LABELS[spreadType][positionIndex] ?? `posição ${positionIndex + 1}`
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npm run test:run -- src/lib/__tests__/tarot.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add tarot card data (78 cards) and resolveCards logic"
```

---

## Chunk 3: RAG Pipeline

### Task 6: Knowledge base — sample cards

**Files:**
- Create: `knowledge/arcanos-maiores/a-torre.md`
- Create: `knowledge/arcanos-maiores/a-lua.md`
- Create: `knowledge/arcanos-maiores/o-sol.md`

> These 3 files are enough to bootstrap and test the RAG pipeline. The remaining 75 cards follow the same template and can be added iteratively.

- [ ] **Step 1: Create A Torre (id: 16)**

`knowledge/arcanos-maiores/a-torre.md`:

```markdown
---
card_id: 16
card_name: A Torre
arcana_type: major
suit: null
---

# A Torre (XVI)

## Significado geral
A Torre representa ruptura repentina, colapso de estruturas falsas e libertação forçada.
É a energia que derruba o que não serve mais, abrindo espaço para o novo.
Axé vem após a tempestade — a Torre limpa o caminho.

## Posição normal
Mudança abrupta, revelação chocante, fim de ilusões. O que parecia sólido desmorona,
mas essa queda é necessária. Caminhos que estavam bloqueados se abrem após a ruptura.

## Invertida
A ruptura foi adiada mas não evitada. Resistência à mudança inevitável.
Medo de soltar o que já não sustenta mais.

## Contextos

### Amor
Uma relação pode chegar ao fim de forma inesperada, ou uma verdade que mudará tudo
está prestes a emergir. Se houver desonestidade, a Torre a revelará.

### Carreira
Demissão inesperada, mudança radical de área, ou o fim de um projeto que parecia estável.
Sinal para reconstruir em base mais sólida.

### Saúde
Alerta para não ignorar sintomas. O corpo pode estar pedindo uma mudança urgente de hábitos.

### Espiritualidade
Desconstrução de crenças limitantes. A alma pede autenticidade — máscaras precisam cair.

## Combinações notáveis
- **Torre + Sol**: crise seguida de renascimento e clareza. A ruptura abre para o axé.
- **Torre + Lua**: confusão e medo durante a transição. Ainda não se vê o que vem depois.
- **Torre + Estrela**: após o caos, esperança e renovação surgem naturalmente.
```

- [ ] **Step 2: Create A Lua (id: 18)**

`knowledge/arcanos-maiores/a-lua.md`:

```markdown
---
card_id: 18
card_name: A Lua
arcana_type: major
suit: null
---

# A Lua (XVIII)

## Significado geral
A Lua representa o inconsciente, ilusões, medos ocultos e a sabedoria da intuição profunda.
O que não está sendo dito. A energia da noite — o que só se vê às avessas.

## Posição normal
Confusão, dúvidas, algo oculto que precisa vir à luz. Intuição pedindo para ser ouvida.
Não tome decisões baseadas apenas no que aparece na superfície.

## Invertida
Ilusões começando a se dissipar. Medos perdendo força. A verdade está emergindo.
Ou: negação de sentimentos que precisam ser reconhecidos.

## Contextos

### Amor
Amarração emocional — sentimentos não expressos criam névoa na relação.
O que não está sendo dito pode estar sabotando a conexão. É hora de conversar com honestidade.

### Carreira
Desconfiança no ambiente de trabalho. Fofocas ou intrigas por trás das cenas.
Atenção redobrada antes de assinar qualquer contrato ou acordo.

### Saúde
Ansiedade, distúrbios do sono, questões psicossomáticas. O emocional pedindo atenção.

### Espiritualidade
Momento de limpeza espiritual. A Lua pede que padrões inconscientes sejam trazidos à luz.
Trabalho com sonhos ou meditação pode revelar muito agora.

## Combinações notáveis
- **Lua + Torre**: caos emocional, medo durante ruptura. Algo oculto precipita a queda.
- **Lua + Sol**: da confusão para a clareza. O dia nasce após a noite mais escura.
- **Lua + Eremita**: período de recolhimento e introspecção necessários.
```

- [ ] **Step 3: Create O Sol (id: 19)**

`knowledge/arcanos-maiores/o-sol.md`:

```markdown
---
card_id: 19
card_name: O Sol
arcana_type: major
suit: null
---

# O Sol (XIX)

## Significado geral
O Sol é uma das cartas mais auspiciosas do baralho. Representa clareza, alegria, axé puro,
sucesso, vitalidade e o fim de períodos difíceis. A luz que dissipa todas as sombras.

## Posição normal
Ótimos augúrios. Clareza de propósito, energia renovada, alegria genuína.
Caminhos abertos. O que foi plantado com intenção está florescendo.

## Invertida
Alegria temporariamente nublada por dúvidas. Não desanime — o Sol está apenas atrás das nuvens.
Ou: excesso de otimismo sem ação concreta.

## Contextos

### Amor
Relação em fase de florescimento e alegria genuína. Para quem está sozinha, novos encontros
cheios de leveza e luz. O Sol traz parceria que ilumina, não que sufoca.

### Carreira
Reconhecimento, promoção, sucesso em projetos. Energia abundante para realizar.
Hora de dar aquele passo que estava sendo adiado — o momento é favorável.

### Saúde
Vitalidade e recuperação. Se havia doença ou cansaço, o Sol indica melhora significativa.
Exposição à luz natural e movimento físico fortalecem ainda mais a energia.

### Espiritualidade
Conexão plena com o propósito de vida. Gratidão e abundância espiritual.
O Sol convida a celebrar a própria jornada.

## Combinações notáveis
- **Sol + Torre**: após ruptura necessária, vem o renascimento. Axé puro após a limpeza.
- **Sol + Lua**: transição da confusão para a clareza. A noite terminou.
- **Sol + Mundo**: realização completa, ciclo encerrado com êxito total.
```

- [ ] **Step 4: Commit**

```bash
git add knowledge/
git commit -m "feat: add knowledge base — A Torre, A Lua, O Sol (RAG seed content)"
```

---

### Task 7: Pinecone client + hybrid search

**Files:**
- Create: `src/lib/pinecone.ts`
- Create: `src/lib/__tests__/pinecone.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/__tests__/pinecone.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { buildHybridQuery } from '../pinecone'

describe('buildHybridQuery', () => {
  it('includes card_id filter when card_ids provided', () => {
    const query = buildHybridQuery({
      cardIds: [16, 18, 19],
      semanticText: 'relacionamento futuro amor',
      topK: 8,
    })
    expect(query.filter).toEqual({ card_id: { $in: [16, 18, 19] } })
    expect(query.topK).toBe(8)
    expect(query.semanticText).toBe('relacionamento futuro amor')
  })

  it('has no filter when cardIds is empty', () => {
    const query = buildHybridQuery({ cardIds: [], semanticText: 'amor', topK: 5 })
    expect(query.filter).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test:run -- src/lib/__tests__/pinecone.test.ts
```

Expected: FAIL — `Cannot find module '../pinecone'`

- [ ] **Step 3: Implement `src/lib/pinecone.ts`**

```ts
import { Pinecone } from '@pinecone-database/pinecone'

let _client: Pinecone | null = null

function getClient(): Pinecone {
  if (!_client) {
    _client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  }
  return _client
}

export function getIndex() {
  return getClient().index(process.env.PINECONE_INDEX_NAME!)
}

export interface HybridQueryParams {
  cardIds: number[]
  semanticText: string
  topK: number
}

export interface HybridQuery {
  filter?: { card_id: { $in: number[] } }
  topK: number
  semanticText: string
}

export function buildHybridQuery(params: HybridQueryParams): HybridQuery {
  const { cardIds, semanticText, topK } = params
  return {
    ...(cardIds.length > 0 && { filter: { card_id: { $in: cardIds } } }),
    topK,
    semanticText,
  }
}

export async function hybridSearch(params: HybridQueryParams, embedding: number[]): Promise<string[]> {
  const index = getIndex()
  const query = buildHybridQuery(params)

  const result = await index.query({
    vector: embedding,
    topK: query.topK,
    filter: query.filter,
    includeMetadata: true,
  })

  return result.matches
    .filter(m => m.metadata?.text)
    .map(m => m.metadata!.text as string)
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm run test:run -- src/lib/__tests__/pinecone.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Pinecone client with hybrid search (card_id filter + semantic)"
```

---

### Task 8: Gemini client (streaming + JSON extraction)

**Files:**
- Create: `src/lib/gemini.ts`
- Create: `src/lib/prompts.ts`

- [ ] **Step 1: Create prompt templates**

`src/lib/prompts.ts`:

```ts
import type { SpreadType } from './tarot'

export interface PromptContext {
  spreadType: SpreadType
  cardLines: string[]       // ex: ["A Torre (passado)", "A Lua (presente)", "O Sol (futuro)"]
  question: string
  ragContext: string        // chunks do Pinecone
  historyContext: string    // contexto do histórico do usuário (pode ser '')
}

export const SYSTEM_PROMPT = `Você é Mystica, uma taróloga experiente com décadas de prática no esoterismo brasileiro.

REGRAS:
- Use o conhecimento fornecido como BASE, mas adicione sua intuição
- Conecte as cartas entre si, mostrando a narrativa da tiragem como um todo
- Use o vocabulário do esoterismo brasileiro quando apropriado: axé, caminhos abertos, limpeza energética, amarração emocional, proteção espiritual
- Seja empática mas honesta — não suavize mensagens difíceis, a verdade serve
- Adapte a linguagem ao contexto da pergunta
- Se houver memória de leituras anteriores, mencione padrões com delicadeza
- Termine com um conselho prático e acionável`

export function buildReadingPrompt(ctx: PromptContext): string {
  const spreadLabel: Record<SpreadType, string> = {
    'tres-cartas': 'Três Cartas (passado / presente / futuro)',
    'carta-do-dia': 'Carta do Dia',
  }

  const historySection = ctx.historyContext
    ? `[MEMÓRIA DA USUÁRIA]\n${ctx.historyContext}\n\n`
    : ''

  return `[CONTEXTO — CONHECIMENTO DO TAROT]
${ctx.ragContext}

${historySection}[TIRAGEM]
Tipo: ${spreadLabel[ctx.spreadType]}
Cartas: ${ctx.cardLines.join(' | ')}
Pergunta: "${ctx.question}"

Faça a leitura completa, conectando as cartas em uma narrativa coesa.`
}

export const METADATA_EXTRACTION_PROMPT = (interpretation: string) => `
Dado o seguinte texto de leitura de tarot, extraia os metadados estruturados.

TEXTO:
${interpretation}

Extraia no formato JSON especificado. Seja conciso nos campos de texto.`

export const METADATA_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    themes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Temas principais da leitura (2-4 itens)',
    },
    energy: {
      type: 'string',
      description: 'Energia geral da tiragem em uma frase curta',
    },
    cards_summary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          card_id: { type: 'number' },
          keyword: { type: 'string' },
          position_index: { type: 'number' },
        },
        required: ['card_id', 'keyword', 'position_index'],
      },
    },
    journaling_note: {
      type: 'string',
      description: 'Nota de 1 frase para o journaling sistêmico da usuária',
    },
    next_step_advice: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Ação concreta a tomar' },
        why: { type: 'string', description: 'Por que esta ação' },
        timing: { type: 'string', description: 'Quando fazer (ex: esta semana, nos próximos 3 dias)' },
      },
      required: ['action', 'why', 'timing'],
    },
  },
  required: ['themes', 'energy', 'cards_summary', 'journaling_note', 'next_step_advice'],
}
```

- [ ] **Step 2: Implement `src/lib/gemini.ts`**

`src/lib/gemini.ts`:

```ts
import { GoogleGenerativeAI, type GenerateContentStreamResult } from '@google/generative-ai'
import { SYSTEM_PROMPT, METADATA_EXTRACTION_PROMPT, METADATA_RESPONSE_SCHEMA } from './prompts'

let _genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  }
  return _genAI
}

export interface ReadingMetadata {
  themes: string[]
  energy: string
  cards_summary: Array<{ card_id: number; keyword: string; position_index: number }>
  journaling_note: string
  next_step_advice: { action: string; why: string; timing: string }
}

/**
 * Call 1: streams the narrative interpretation.
 * Returns an async iterable of text chunks.
 */
export async function streamInterpretation(
  userPrompt: string
): Promise<GenerateContentStreamResult> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  return model.generateContentStream(userPrompt)
}

/**
 * Call 2: extracts structured metadata from a completed interpretation.
 * Uses JSON mode — does NOT repeat the full RAG context.
 */
export async function extractMetadata(interpretation: string): Promise<ReadingMetadata> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: METADATA_RESPONSE_SCHEMA as never,
    },
  })

  const result = await model.generateContent(METADATA_EXTRACTION_PROMPT(interpretation))
  const text = result.response.text()
  return JSON.parse(text) as ReadingMetadata
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Gemini client — streaming interpretation + JSON metadata extraction"
```

---

### Task 9: Context injection + RAG orchestration

**Files:**
- Create: `src/lib/context-injection.ts`
- Create: `src/lib/rag.ts`
- Create: `src/lib/__tests__/context-injection.test.ts`

- [ ] **Step 1: Write failing test for context injection**

`src/lib/__tests__/context-injection.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatHistoryContext } from '../context-injection'

describe('formatHistoryContext', () => {
  it('returns empty string for no readings', () => {
    expect(formatHistoryContext([])).toBe('')
  })

  it('formats a single reading with journaling note', () => {
    const readings = [{
      card_names: ['A Torre', 'A Lua'],
      journaling_note: 'Ruptura no trabalho',
      created_at: '2026-03-05T10:00:00Z',
    }]
    const result = formatHistoryContext(readings)
    expect(result).toContain('A Torre')
    expect(result).toContain('A Lua')
    expect(result).toContain('Ruptura no trabalho')
  })

  it('limits context to 3 most recent readings', () => {
    const readings = Array.from({ length: 5 }, (_, i) => ({
      card_names: [`Carta ${i}`],
      journaling_note: `Nota ${i}`,
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
    }))
    const result = formatHistoryContext(readings)
    expect(result).not.toContain('Carta 3')
    expect(result).not.toContain('Carta 4')
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test:run -- src/lib/__tests__/context-injection.test.ts
```

Expected: FAIL — `Cannot find module '../context-injection'`

- [ ] **Step 3: Implement `src/lib/context-injection.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface RecentReading {
  card_names: string[]
  journaling_note: string | null
  created_at: string
}

export function formatHistoryContext(readings: RecentReading[]): string {
  if (readings.length === 0) return ''

  const recent = readings.slice(0, 3)
  const lines = recent.map(r => {
    const cards = r.card_names.join(', ')
    const date = new Date(r.created_at).toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'long',
    })
    const note = r.journaling_note ? ` — ${r.journaling_note}` : ''
    return `${date}: ${cards}${note}`
  })

  return lines.join('\n')
}

export async function fetchRecentReadings(
  supabase: SupabaseClient,
  userId: string
): Promise<RecentReading[]> {
  const { data } = await supabase
    .from('readings')
    .select('card_ids, metadata, created_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(3)

  if (!data) return []

  return data.map(row => ({
    card_names: [], // resolved in rag.ts where card data is available
    journaling_note: row.metadata?.journaling_note ?? null,
    created_at: row.created_at,
    _card_ids: row.card_ids,
  })) as RecentReading[]
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm run test:run -- src/lib/__tests__/context-injection.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Implement `src/lib/rag.ts`**

`src/lib/rag.ts`:

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { hybridSearch } from './pinecone'
import { fetchRecentReadings, formatHistoryContext } from './context-injection'
import { buildReadingPrompt } from './prompts'
import { getCard, getPositionLabel, type SpreadType } from './tarot'
import type { SupabaseClient } from '@supabase/supabase-js'

async function getEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.embedContent(text)
  return result.embedding.values
}

export interface OrchestrationInput {
  supabase: SupabaseClient
  userId: string
  cardIds: number[]
  spreadType: SpreadType
  question: string
}

export async function buildReadingContext(input: OrchestrationInput): Promise<string> {
  const { supabase, userId, cardIds, spreadType, question } = input

  const cards = cardIds.map(id => getCard(id))
  const cardLines = cards.map((c, i) => `${c.name} (${getPositionLabel(spreadType, i)})`)

  // Parallel: Pinecone hybrid search + Supabase history
  const semanticText = `${question} ${cards.map(c => c.name).join(' ')}`
  const embeddingPromise = getEmbedding(semanticText)
  const historyPromise = fetchRecentReadings(supabase, userId)

  const [embedding, rawHistory] = await Promise.all([embeddingPromise, historyPromise])

  // Resolve card names in history
  const history = rawHistory.map(r => ({
    ...r,
    card_names: ((r as unknown as { _card_ids: number[] })._card_ids ?? []).map(id => {
      try { return getCard(id).name } catch { return String(id) }
    }),
  }))

  // Hybrid search: first pass = exact card match, second pass = semantic context
  const [exactChunks, semanticChunks] = await Promise.all([
    hybridSearch({ cardIds, semanticText, topK: 6 }, embedding),
    hybridSearch({ cardIds: [], semanticText, topK: 4 }, embedding),
  ])

  // Deduplicate and combine
  const seen = new Set<string>()
  const ragContext = [...exactChunks, ...semanticChunks]
    .filter(chunk => { if (seen.has(chunk)) return false; seen.add(chunk); return true })
    .join('\n\n---\n\n')

  const historyContext = formatHistoryContext(history)

  return buildReadingPrompt({ spreadType, cardLines, question, ragContext, historyContext })
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add RAG orchestration — context injection + hybrid Pinecone search"
```

---

## Chunk 4: API Endpoints

### Task 10: `POST /api/reading/draw`

**Files:**
- Create: `src/app/api/reading/draw/route.ts`
- Create: `src/app/api/reading/draw/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests**

`src/app/api/reading/draw/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { plan: 'free', readings_this_month: 0, month_cycle: '' },
      }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: { id: 'reading-abc' }, error: null }),
    }),
  }),
}))

import { POST } from '../route'

function makeRequest(body: object) {
  return new Request('http://localhost/api/reading/draw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/reading/draw', () => {
  it('returns 400 for wrong number of fan_indices', async () => {
    const res = await POST(makeRequest({
      spread_type: 'tres-cartas',
      fan_indices: [0, 1],
      question: 'test',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for carta-do-dia with multiple indices', async () => {
    const res = await POST(makeRequest({
      spread_type: 'carta-do-dia',
      fan_indices: [0, 1],
      question: 'test',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 201 with reading_id for valid tres-cartas draw', async () => {
    const res = await POST(makeRequest({
      spread_type: 'tres-cartas',
      fan_indices: [5, 20, 60],
      question: 'meu relacionamento tem futuro?',
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('reading_id')
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test:run -- src/app/api/reading/draw/__tests__/route.test.ts
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement `src/app/api/reading/draw/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveCards, SPREAD_SIZES, type SpreadType } from '@/lib/tarot'

const FREE_MONTHLY_LIMIT = 5

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { spread_type: SpreadType; fan_indices: number[]; question: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { spread_type, fan_indices, question } = body

  if (!spread_type || !SPREAD_SIZES[spread_type]) {
    return NextResponse.json({ error: 'Invalid spread_type' }, { status: 400 })
  }

  // Validate fan_indices count
  let card_ids: number[]
  try {
    card_ids = resolveCards(fan_indices ?? [], spread_type)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  // Lazy monthly reset + rate limit check
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, readings_this_month, month_cycle')
    .eq('id', user.id)
    .single()

  if (profile) {
    const currentCycle = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
    if (profile.month_cycle !== currentCycle) {
      await supabase
        .from('profiles')
        .update({ readings_this_month: 0, month_cycle: currentCycle, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      profile.readings_this_month = 0
    }

    if (profile.plan === 'free' && profile.readings_this_month >= FREE_MONTHLY_LIMIT) {
      return NextResponse.json(
        { error: 'Limite mensal atingido. Faça upgrade para continuar.' },
        { status: 403 }
      )
    }
  }

  // Seal the cards
  const { data: reading, error } = await supabase
    .from('readings')
    .insert({
      user_id: user.id,
      status: 'drawn',
      spread_type,
      question: question ?? '',
      card_ids,
    })
    .select('id')
    .single()

  if (error || !reading) {
    return NextResponse.json({ error: 'Failed to save reading' }, { status: 500 })
  }

  // Increment counter
  await supabase
    .from('profiles')
    .update({ readings_this_month: (profile?.readings_this_month ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.json({ reading_id: reading.id }, { status: 201 })
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm run test:run -- src/app/api/reading/draw/__tests__/route.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add POST /api/reading/draw — server-side card sealing with rate limiting"
```

---

### Task 11: `POST /api/reading/[id]/interpret`

**Files:**
- Create: `src/app/api/reading/[id]/interpret/route.ts`

- [ ] **Step 1: Implement the streaming interpret route**

`src/app/api/reading/[id]/interpret/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { buildReadingContext } from '@/lib/rag'
import { streamInterpretation, extractMetadata } from '@/lib/gemini'
import type { SpreadType } from '@/lib/tarot'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: reading } = await supabase
    .from('readings')
    .select('id, status, spread_type, card_ids, question, interpretation')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!reading) {
    return new Response('Not found', { status: 404 })
  }

  // Idempotency: already completed → return existing interpretation
  if (reading.status === 'completed' && reading.interpretation) {
    return new Response(reading.interpretation, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  if (reading.status !== 'drawn' && reading.status !== 'failed') {
    return new Response('Reading is not in a drawable state', { status: 409 })
  }

  // Reset failed readings
  if (reading.status === 'failed') {
    await supabase
      .from('readings')
      .update({ status: 'drawn', interpretation: null, metadata: null, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  // Build RAG context
  let prompt: string
  try {
    prompt = await buildReadingContext({
      supabase,
      userId: user.id,
      cardIds: reading.card_ids,
      spreadType: reading.spread_type as SpreadType,
      question: reading.question ?? '',
    })
  } catch {
    await supabase.from('readings').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', id)
    return new Response('RAG pipeline failed', { status: 500 })
  }

  // Stream interpretation
  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await streamInterpretation(prompt)

        for await (const chunk of result.stream) {
          const text = chunk.text()
          fullText += text
          controller.enqueue(encoder.encode(text))
        }

        // Save completed interpretation
        await supabase
          .from('readings')
          .update({ status: 'completed', interpretation: fullText, updated_at: new Date().toISOString() })
          .eq('id', id)

        controller.close()

        // Extract metadata asynchronously (non-blocking for the stream)
        extractMetadata(fullText)
          .then(metadata =>
            supabase.from('readings').update({ metadata, updated_at: new Date().toISOString() }).eq('id', id)
          )
          .catch(console.error)

      } catch (err) {
        await supabase.from('readings').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', id)
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
```

- [ ] **Step 2: Test manually (requires Supabase + Gemini configured)**

```bash
npm run dev
# Use a REST client (curl/Insomnia) to:
# 1. POST /api/reading/draw with valid fan_indices
# 2. POST /api/reading/{id}/interpret
# Verify text streams back and reading.status = 'completed' in Supabase
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add POST /api/reading/[id]/interpret — Gemini streaming with metadata extraction"
```

---

### Task 12: `GET /api/reading/[id]` + `GET /api/history`

**Files:**
- Create: `src/app/api/reading/[id]/route.ts`
- Create: `src/app/api/history/route.ts`

> **Note:** The draw endpoint withholds `card_ids` to prevent peek-before-reveal. After the reading page loads, the client fetches `GET /api/reading/[id]` to get card data and display the card reveal UI.

- [ ] **Step 1: Implement `GET /api/reading/[id]`**

`src/app/api/reading/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: reading } = await supabase
    .from('readings')
    .select('id, status, spread_type, card_ids, question, metadata, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!reading) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ reading })
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add GET /api/reading/[id] — returns card_ids and metadata for reading page"
```

- [ ] **Step 1: Implement**

`src/app/api/history/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: readings } = await supabase
    .from('readings')
    .select('id, spread_type, question, card_ids, metadata, created_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ readings: readings ?? [] })
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add GET /api/history — user reading history"
```

---

## Chunk 5: UI Components + Pages

### Task 13: Global layout + dark theme

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update `globals.css` with Mystica theme**

`src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --bg-deep: #0d0d1a;
  --bg-mid: #1a0a2e;
  --bg-card: #2d1b4e;
  --gold: #c9a96e;
  --gold-dim: #c9a96e66;
  --purple-cta: #4a2080;
  --purple-cta-hover: #7b3fa0;
  --text-primary: #e8e0d0;
  --text-secondary: #c9a96e88;
}

body {
  background: var(--bg-deep);
  color: var(--text-primary);
  font-family: 'Georgia', serif;
}

.gold { color: var(--gold); }
.gold-dim { color: var(--text-secondary); }
```

- [ ] **Step 2: Update root layout**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mystica — Sua Taróloga Digital',
  description: 'Leituras de tarot com IA, em português, com memória da sua jornada.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ background: '#0d0d1a', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add global dark mystical theme"
```

---

### Task 14: CardFan component

**Files:**
- Create: `src/components/CardFan.tsx`

- [ ] **Step 1: Implement animated card fan**

`src/components/CardFan.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface CardFanProps {
  totalCards?: number
  required: number
  onComplete: (fanIndices: number[]) => void
}

export function CardFan({ totalCards = 22, required, onComplete }: CardFanProps) {
  const [selected, setSelected] = useState<number[]>([])

  function handleSelect(index: number) {
    if (selected.includes(index)) return
    const next = [...selected, index]
    setSelected(next)
    if (next.length === required) {
      onComplete(next)
    }
  }

  const angleStep = 120 / (totalCards - 1)
  const startAngle = -60

  return (
    <div className="relative flex items-end justify-center" style={{ height: '220px', width: '100%' }}>
      {Array.from({ length: totalCards }, (_, i) => {
        const angle = startAngle + i * angleStep
        const isSelected = selected.includes(i)
        const isDisabled = selected.length >= required && !isSelected

        return (
          <button
            key={i}
            onClick={() => !isDisabled && handleSelect(i)}
            disabled={isDisabled}
            className="absolute transition-all duration-300"
            style={{
              width: '44px',
              height: '68px',
              borderRadius: '6px',
              background: isSelected
                ? 'linear-gradient(180deg, #4a2080, #7b3fa0)'
                : 'linear-gradient(180deg, #2d1b4e, #1a0a2e)',
              border: `1px solid ${isSelected ? '#c9a96e' : '#c9a96e44'}`,
              transform: `rotate(${angle}deg) translateY(-80px)`,
              transformOrigin: 'bottom center',
              bottom: '0',
              left: '50%',
              marginLeft: '-22px',
              boxShadow: isSelected ? '0 0 12px #c9a96e66' : 'none',
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: isDisabled ? 0.4 : 1,
            }}
            aria-label={`Carta ${i + 1}`}
          />
        )
      })}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs"
        style={{ color: '#c9a96e88' }}
      >
        {selected.length} de {required} cartas escolhidas
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add CardFan component — animated card selection UI"
```

---

### Task 15: ReadingStream + NextStepAdvice components

**Files:**
- Create: `src/components/ReadingStream.tsx`
- Create: `src/components/NextStepAdvice.tsx`
- Create: `src/components/TodaysAdvice.tsx`

- [ ] **Step 1: Implement ReadingStream**

`src/components/ReadingStream.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface ReadingStreamProps {
  readingId: string
  onComplete?: (text: string) => void
}

export function ReadingStream({ readingId, onComplete }: ReadingStreamProps) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)
  // Use a ref for the callback to avoid re-running the effect when the
  // parent re-renders and creates a new function reference
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    let cancelled = false

    async function stream() {
      const res = await fetch(`/api/reading/${readingId}/interpret`, { method: 'POST' })
      if (!res.ok || !res.body) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (!cancelled) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setText(full)
      }

      if (!cancelled) {
        setDone(true)
        onCompleteRef.current?.(full)
      }
    }

    stream()
    return () => { cancelled = true }
  }, [readingId]) // readingId only — callback stability handled by ref

  return (
    <div
      className="text-sm leading-relaxed whitespace-pre-wrap"
      style={{ color: '#e8e0d0', borderLeft: '2px solid #c9a96e44', paddingLeft: '16px' }}
    >
      {text}
      {!done && <span style={{ color: '#c9a96e' }}>█</span>}
    </div>
  )
}
```

- [ ] **Step 2: Implement NextStepAdvice**

`src/components/NextStepAdvice.tsx`:

```tsx
interface NextStepAdvice {
  action: string
  why: string
  timing: string
}

interface NextStepAdviceProps {
  advice: NextStepAdvice
}

export function NextStepAdvice({ advice }: NextStepAdviceProps) {
  return (
    <div
      className="rounded-lg p-4 space-y-2"
      style={{ background: '#1a0a2e', border: '1px solid #c9a96e44' }}
    >
      <p className="text-xs uppercase tracking-widest" style={{ color: '#c9a96e' }}>
        ✦ Conselho Prático
      </p>
      <p className="text-sm" style={{ color: '#e8e0d0' }}>{advice.action}</p>
      <p className="text-xs italic" style={{ color: '#c9a96e88' }}>{advice.why}</p>
      <p className="text-xs" style={{ color: '#c9a96e66' }}>{advice.timing}</p>
    </div>
  )
}
```

- [ ] **Step 3: Implement TodaysAdvice (home widget)**

`src/components/TodaysAdvice.tsx`:

```tsx
interface TodaysAdviceProps {
  advice: { action: string; timing: string } | null
  daysAgo: number | null
}

export function TodaysAdvice({ advice, daysAgo }: TodaysAdviceProps) {
  if (!advice) return null

  return (
    <div
      className="rounded-lg p-4 space-y-2"
      style={{ background: '#1a0a2e', border: '1px solid #c9a96e44' }}
    >
      <p className="text-xs uppercase tracking-widest" style={{ color: '#c9a96e' }}>
        Seu Conselho de Hoje
      </p>
      <p className="text-sm" style={{ color: '#e8e0d0' }}>"{advice.action}"</p>
      {daysAgo !== null && (
        <p className="text-xs" style={{ color: '#c9a96e66' }}>
          da sua última leitura · {daysAgo === 0 ? 'hoje' : `${daysAgo} dia${daysAgo > 1 ? 's' : ''} atrás`}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add ReadingStream, NextStepAdvice, TodaysAdvice components"
```

---

### Task 16: Reading flow page

**Files:**
- Create: `src/app/(auth)/reading/page.tsx`

- [ ] **Step 1: Implement the 3-step reading flow**

`src/app/(auth)/reading/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { CardFan } from '@/components/CardFan'
import { ReadingStream } from '@/components/ReadingStream'
import { NextStepAdvice } from '@/components/NextStepAdvice'
import { getCard, POSITION_LABELS, type SpreadType } from '@/lib/tarot'
import type { ReadingMetadata } from '@/lib/gemini'

type Step = 'intention' | 'fan' | 'reading'

export default function ReadingPage() {
  const [step, setStep] = useState<Step>('intention')
  const [spreadType, setSpreadType] = useState<SpreadType>('tres-cartas')
  const [question, setQuestion] = useState('')
  const [readingId, setReadingId] = useState<string | null>(null)
  const [cardIds, setCardIds] = useState<number[]>([])
  const [metadata, setMetadata] = useState<ReadingMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFanComplete(fanIndices: number[]) {
    setError(null)
    const res = await fetch('/api/reading/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spread_type: spreadType, fan_indices: fanIndices, question }),
    })

    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Erro ao sortear as cartas')
      return
    }

    const { reading_id } = await res.json()
    setReadingId(reading_id)

    // Fetch card_ids now that cards are sealed (no longer a spoiler — user is about to see them)
    const readingRes = await fetch(`/api/reading/${reading_id}`)
    if (readingRes.ok) {
      const { reading } = await readingRes.json()
      setCardIds(reading.card_ids ?? [])
    }

    setStep('reading')
  }

  function handleReadingComplete(_fullText: string) {
    // Poll for metadata — extracted async after stream completes
    const poll = (attempts: number) => {
      if (attempts <= 0) return
      setTimeout(async () => {
        const res = await fetch(`/api/reading/${readingId}`)
        if (!res.ok) return
        const { reading } = await res.json()
        if (reading.metadata?.next_step_advice) {
          setMetadata(reading.metadata)
        } else {
          poll(attempts - 1)
        }
      }, 2000)
    }
    poll(5)
  }

  const positions = POSITION_LABELS[spreadType]

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-serif text-center" style={{ color: '#c9a96e' }}>
        Mystica
      </h1>

      {step === 'intention' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest" style={{ color: '#c9a96e88' }}>
              Qual é a sua intenção?
            </label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="O que está no seu coração agora?"
              rows={3}
              className="w-full rounded-lg p-3 text-sm resize-none"
              style={{
                background: '#1a0a2e',
                border: '1px solid #c9a96e44',
                color: '#e8e0d0',
                outline: 'none',
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest" style={{ color: '#c9a96e88' }}>
              Tipo de tiragem
            </p>
            <div className="flex gap-3">
              {(['tres-cartas', 'carta-do-dia'] as SpreadType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setSpreadType(t)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{
                    background: spreadType === t ? '#4a2080' : '#1a0a2e',
                    border: `1px solid ${spreadType === t ? '#c9a96e' : '#c9a96e33'}`,
                    color: spreadType === t ? '#f0e8ff' : '#c9a96e88',
                  }}
                >
                  {t === 'tres-cartas' ? '3 Cartas' : 'Carta do Dia'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => question.trim() && setStep('fan')}
            disabled={!question.trim()}
            className="w-full py-3 rounded-lg font-medium"
            style={{
              background: question.trim()
                ? 'linear-gradient(90deg, #4a2080, #7b3fa0)'
                : '#1a0a2e',
              color: question.trim() ? '#f0e8ff' : '#c9a96e44',
            }}
          >
            Concentrar →
          </button>
        </div>
      )}

      {step === 'fan' && (
        <div className="space-y-8">
          <p className="text-center text-sm italic" style={{ color: '#c9a96e88' }}>
            "Deixe sua intuição guiar sua mão"
          </p>
          <CardFan
            required={spreadType === 'tres-cartas' ? 3 : 1}
            onComplete={handleFanComplete}
          />
          {error && (
            <p className="text-center text-sm" style={{ color: '#ff6b6b' }}>{error}</p>
          )}
        </div>
      )}

      {step === 'reading' && readingId && (
        <div className="space-y-6">
          <div className="flex gap-3 justify-center">
            {cardIds.map((id, i) => {
              const card = (() => { try { return getCard(id) } catch { return null } })()
              return (
                <div key={i} className="text-center space-y-1">
                  <div
                    className="w-12 h-20 rounded-lg flex items-center justify-center"
                    style={{ background: '#2d1b4e', border: '1px solid #c9a96e' }}
                  >
                    <span style={{ color: '#c9a96e', fontSize: '20px' }}>✦</span>
                  </div>
                  <p className="text-xs" style={{ color: '#c9a96e88' }}>{positions[i]}</p>
                  <p className="text-xs" style={{ color: '#e8e0d0' }}>{card?.name ?? '?'}</p>
                </div>
              )
            })}
          </div>

          <ReadingStream readingId={readingId} onComplete={handleReadingComplete} />

          {metadata?.next_step_advice && (
            <NextStepAdvice advice={metadata.next_step_advice} />
          )}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add reading flow page — intention → fan → streaming reading"
```

---

### Task 17: Home page + History page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/(auth)/history/page.tsx`

- [ ] **Step 1: Implement Home page**

`src/app/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { TodaysAdvice } from '@/components/TodaysAdvice'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let todaysAdvice = null
  let daysAgo: number | null = null
  let recentReadings: { card_ids: number[]; created_at: string }[] = []

  if (user) {
    const { data } = await supabase
      .from('readings')
      .select('card_ids, metadata, created_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(3)

    if (data?.length) {
      recentReadings = data
      const latest = data[0]
      if (latest.metadata?.next_step_advice) {
        todaysAdvice = latest.metadata.next_step_advice
        const diff = Date.now() - new Date(latest.created_at).getTime()
        daysAgo = Math.floor(diff / 86400000)
      }
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto space-y-8">
      <div className="text-center space-y-2 pt-8">
        <div className="text-4xl">🌙</div>
        <h1 className="text-3xl font-serif" style={{ color: '#c9a96e' }}>Mystica</h1>
        <p className="text-sm" style={{ color: '#c9a96e88' }}>Sua taróloga digital</p>
      </div>

      <TodaysAdvice advice={todaysAdvice} daysAgo={daysAgo} />

      {recentReadings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest" style={{ color: '#c9a96e88' }}>
            Últimas tiragens
          </p>
          <div className="flex gap-2">
            {recentReadings.slice(0, 1).flatMap(r =>
              r.card_ids.slice(0, 3).map((id, i) => (
                <div
                  key={i}
                  className="w-10 h-16 rounded"
                  style={{ background: '#2d1b4e', border: '1px solid #c9a96e44' }}
                />
              ))
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Link
          href="/reading"
          className="block w-full py-4 rounded-lg text-center font-medium"
          style={{ background: 'linear-gradient(90deg, #4a2080, #7b3fa0)', color: '#f0e8ff' }}
        >
          Nova Tiragem
        </Link>
        <Link
          href="/history"
          className="block w-full py-3 rounded-lg text-center text-sm"
          style={{ border: '1px solid #c9a96e33', color: '#c9a96e88' }}
        >
          Ver Histórico
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Implement History page**

`src/app/(auth)/history/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: readings } = await supabase
    .from('readings')
    .select('id, spread_type, question, card_ids, metadata, created_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" style={{ color: '#c9a96e88' }}>←</Link>
        <h1 className="text-xl font-serif" style={{ color: '#c9a96e' }}>Histórico</h1>
      </div>

      <div className="space-y-3">
        {(readings ?? []).map(r => (
          <div
            key={r.id}
            className="rounded-lg p-4 space-y-2"
            style={{ background: '#1a0a2e', border: '1px solid #c9a96e22' }}
          >
            <div className="flex justify-between items-start">
              <p className="text-sm" style={{ color: '#e8e0d0' }}>
                {r.question || (r.spread_type === 'carta-do-dia' ? 'Carta do Dia' : 'Tiragem de 3 cartas')}
              </p>
              <span className="text-xs" style={{ color: '#c9a96e66' }}>
                {new Date(r.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex gap-2">
              {(r.card_ids as number[]).slice(0, 3).map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-12 rounded"
                  style={{ background: '#2d1b4e', border: '1px solid #c9a96e33' }}
                />
              ))}
            </div>
            {r.metadata?.next_step_advice?.action && (
              <p className="text-xs italic" style={{ color: '#c9a96e88' }}>
                "{r.metadata.next_step_advice.action}"
              </p>
            )}
          </div>
        ))}

        {!readings?.length && (
          <p className="text-center text-sm" style={{ color: '#c9a96e44' }}>
            Nenhuma leitura ainda. Faça sua primeira tiragem!
          </p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add home page with TodaysAdvice widget + history page"
```

---

## Chunk 6: Ingestion Script + Knowledge Base Setup

### Task 18: Pinecone ingestion script

**Files:**
- Create: `scripts/ingest.ts`

> **Prerequisites:** Pinecone index must exist. Create it in the Pinecone dashboard:
> - Name: `mystica-tarot`
> - Dimensions: `768` (text-embedding-004)
> - Metric: `cosine`

- [ ] **Step 1: Implement `scripts/ingest.ts`**

```ts
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { Pinecone } from '@pinecone-database/pinecone'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Load env manually for script context
import { config } from 'dotenv'
config({ path: '.env.local' })

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface ChunkMetadata {
  card_id: number
  card_name: string
  section: string
  arcana_type: string
  suit: string | null
  text: string
}

function parseFrontmatter(content: string): Record<string, string | null> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  return Object.fromEntries(
    match[1].split('\n').map(line => {
      const [key, ...rest] = line.split(':')
      const value = rest.join(':').trim()
      return [key?.trim(), value === 'null' ? null : value]
    })
  )
}

function chunkBySection(content: string, meta: Record<string, string | null>): ChunkMetadata[] {
  const body = content.replace(/^---[\s\S]*?---\n/, '')
  // Split on both ## and ### headings to capture sub-context sections
  const sections = body.split(/(?=^#{2,3} )/m).filter(s => s.trim())

  return sections.map(section => {
    const titleMatch = section.match(/^#{2,3} (.+)/)
    const sectionName = titleMatch ? titleMatch[1].trim() : 'geral'
    return {
      card_id: meta.card_id != null ? Number(meta.card_id) : -1,
      card_name: meta.card_name ?? '',
      section: sectionName,
      arcana_type: meta.arcana_type ?? '',
      suit: meta.suit ?? null,
      text: section.trim(),
    }
  }).filter(chunk => chunk.text.length > 100) // skip near-empty heading-only chunks
}

function getAllMdFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...getAllMdFiles(full))
    } else if (entry.endsWith('.md')) {
      files.push(full)
    }
  }
  return files
}

async function getEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.embedContent(text)
  return result.embedding.values
}

async function main() {
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME!)
  const knowledgeDir = join(process.cwd(), 'knowledge')
  const files = getAllMdFiles(knowledgeDir)

  console.log(`Found ${files.length} knowledge files`)

  let upserted = 0
  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const meta = parseFrontmatter(content)
    const chunks = chunkBySection(content, meta)

    for (const chunk of chunks) {
      // Use filename slug for non-card files (spreads, simbolismo, contextos)
      const fileSlug = file.replace(/\\/g, '/').split('/knowledge/')[1]?.replace(/\//g, '-').replace('.md', '') ?? 'unknown'
      const idBase = chunk.card_id >= 0 ? `card-${chunk.card_id}` : `ref-${fileSlug}`
      const id = `${idBase}-${chunk.section.replace(/\s+/g, '-').toLowerCase()}`
      const embedding = await getEmbedding(chunk.text)

      const metadata: Record<string, string | number> = {
        section: chunk.section,
        arcana_type: chunk.arcana_type,
        suit: chunk.suit ?? '',
        text: chunk.text,
      }
      // Only include card_id for actual card files (enables hybrid filter)
      if (chunk.card_id >= 0) {
        metadata.card_id = chunk.card_id
        metadata.card_name = chunk.card_name
      }

      await index.upsert([{ id, values: embedding, metadata }])

      upserted++
      console.log(`  ✓ ${chunk.card_name} — ${chunk.section}`)
    }
  }

  console.log(`\nDone! Upserted ${upserted} vectors.`)
}

main().catch(console.error)
```

- [ ] **Step 2: Add script runner to package.json**

```json
"scripts": {
  "ingest": "npx tsx scripts/ingest.ts"
}
```

Install tsx: `npm install -D tsx dotenv`

- [ ] **Step 3: Run ingest on the 3 sample cards**

```bash
npm run ingest
```

Expected output:
```
Found 3 knowledge files
  ✓ A Torre — Significado geral
  ✓ A Torre — Posição normal
  ...
Done! Upserted ~18 vectors.
```

Verify in Pinecone dashboard: index has vectors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Pinecone ingestion script — chunks by section with metadata"
```

---

### Task 19: Remaining knowledge base cards

> This task is **content work**, not code work. Complete at your own pace — the system functions with partial content.

- [ ] **Step 1: Create card template**

Each remaining card follows the same template as A Torre. Create files for:
- All 22 Major Arcana (O Louco through O Mundo) — 19 remaining
- 56 Minor Arcana (Copas, Espadas, Ouros, Paus × 14 cards each)

Use this template for each. **IMPORTANT: Each section must have real prose content (min ~50 words). Empty section headings produce useless RAG chunks. The 3 seeded cards (A Torre, A Lua, O Sol) in `knowledge/arcanos-maiores/` are the reference for quality and tone.**

```markdown
---
card_id: [ID from cards.json]
card_name: [Name in PT-BR]
arcana_type: major|minor
suit: null|copas|espadas|ouros|paus
---

# [Card Name]

## Significado geral
[2-3 parágrafos. Use o vocabulário do esoterismo brasileiro quando apropriado: axé, caminhos
abertos, limpeza energética, amarração emocional. Contextualize o arquétipo da carta.]

## Posição normal
[1-2 parágrafos sobre o significado direto. Seja específico sobre o que essa energia traz.]

## Invertida
[1 parágrafo sobre o significado invertido — bloqueio, excesso ou forma adormecida da energia.]

## Contextos

### Amor
[Pelo menos 2-3 frases específicas sobre relacionamentos afetivos, conexões e vínculos emocionais.]

### Carreira
[Pelo menos 2-3 frases sobre trabalho, dinheiro, projetos, realizações profissionais.]

### Saúde
[Pelo menos 2 frases sobre corpo, energia vital, saúde física e emocional.]

### Espiritualidade
[Pelo menos 2 frases sobre desenvolvimento espiritual, propósito de vida, conexão com o sagrado.]

## Combinações notáveis
- **[Carta X] + [Nome desta carta]**: [o que essa dupla sugere]
- **[Carta Y] + [Nome desta carta]**: [o que essa dupla sugere]
- **[Carta Z] + [Nome desta carta]**: [o que essa dupla sugere]
```

- [ ] **Step 2: Run ingest after adding cards**

```bash
npm run ingest
```

- [ ] **Step 3: Commit each batch**

```bash
git add knowledge/
git commit -m "feat: add knowledge base — [arcana type] cards"
```

---

## Final Checklist

- [ ] All Supabase environment variables set in `.env.local`
- [ ] Pinecone index `mystica-tarot` created (768 dims, cosine)
- [ ] Google OAuth configured in Supabase + Google Cloud Console
- [ ] Ingestion script run (`npm run ingest`)
- [ ] Full flow tested: login → intention → fan → reading → history
- [ ] Deploy to Vercel: `vercel deploy`
- [ ] Set environment variables in Vercel dashboard
- [ ] Add Vercel domain to Supabase OAuth redirect URLs
