# Mystica — Roadmap Features Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** 14 features across 5 blocks

---

## Overview

This spec covers the full feature roadmap for Mystica, expanding the platform from tarot-only to a comprehensive mystical experience. Features are organized into 5 implementation blocks that share infrastructure.

**Architecture decision:** All daily content (card of the day, ritual, moon data) uses **lazy generation with cache** — the first user access of the day triggers generation, subsequent accesses read from the database.

---

## Cross-Cutting Concerns

### Migration Strategy

The existing `readings` table has a CHECK constraint on `spread_type` (`'tres-cartas' | 'carta-do-dia'`) and `card_ids int[] NOT NULL`. A migration must:

1. `ALTER TABLE readings DROP CONSTRAINT readings_spread_type_check`
2. `ALTER TABLE readings ADD CONSTRAINT readings_spread_type_check CHECK (spread_type IN ('tres-cartas', 'carta-do-dia', 'sonho', 'leitura-dupla', 'ano-pessoal'))`
3. `ALTER TABLE readings ALTER COLUMN card_ids DROP NOT NULL`
4. `ALTER TABLE readings ADD COLUMN extra_context TEXT` (TEXT, not JSONB — stores encrypted envelope string)

TypeScript types to update: `SpreadType` in `tarot.ts`, `SPREAD_SIZES` and `POSITION_LABELS` in `prompts.ts`, `spreadLabel` map in `buildReadingPrompt`.

### RLS Policies

All new tables require Row-Level Security:

| Table | SELECT | INSERT | UPDATE |
|-------|--------|--------|--------|
| `daily_content` | All authenticated users | Service role only | Service role only |
| `user_daily_reveal` | Own rows (`user_id = auth.uid()`) | Own rows | None |
| `user_streaks` | Own rows | Own rows (upsert) | Own rows |
| `user_card_collection` | Own rows | Own rows | None |
| `user_achievements` | Own rows | Own rows | None |
| `user_retrospectives` | Own rows | Own rows | Own rows |

### Rate Limiting

New AI-calling endpoints use existing Upstash Redis rate limiting:
- `GET /api/daily` — protected by cache (only first request/day generates), no additional rate limit needed
- `GET /api/retrospective` — rate limited (3 req/30s, same as interpret). Only accepts past months + current month (rejects future months).
- `GET /api/reading/[id]/share` — rate limited (5 req/60s) to prevent abuse of CPU-intensive image generation. Requires authentication.

### Encryption Consistency

- `user_retrospectives.content` — encrypted with `encryptForUser`/`decryptForUser` (same pattern as readings)
- `readings.extra_context` — stored as TEXT (not JSONB) containing the encrypted envelope string. Encrypted/decrypted with the same per-user key derivation.

### Concurrency Protection

- **Daily content generation:** `INSERT INTO daily_content ... ON CONFLICT (date) DO NOTHING` — if two requests race, the second insert is a no-op and reads the existing row.
- **Streak update:** Wrapped in a PostgreSQL function using `SELECT ... FOR UPDATE` on `user_streaks` to prevent race conditions. The `user_daily_reveal` composite PK `(user_id, date)` rejects duplicate reveals at DB level — endpoint catches the conflict and returns idempotently.
- **`user_streaks` row creation:** Auto-created via upsert on first daily reveal (same pattern as `profiles` auto-creation).

### Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `user_card_collection` | `(user_id)` | Collection page query |
| `user_daily_reveal` | PK covers `(user_id, date)` | Already optimal |
| `readings` | `(user_id, spread_type, created_at)` | Personal year reading limit check |

### Free Tier Limits

All reading types that call Gemini (dream, duo, personal year) count toward the existing 5 readings/month free tier limit. They flow through the same `incrementCompletedReadings` code path.

---

## Block 1: Retention & Gamification

### 1.1 Database Schema

#### Table: `daily_content`
Global daily content generated once per day via lazy caching.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| date | DATE UNIQUE | Cache key |
| card_id | INTEGER | 0-77, card of the day |
| interpretation | TEXT | Interpretation (acolhedora style) |
| ritual | TEXT | Daily ritual suggestion |
| moon_phase | TEXT | Moon phase name |
| moon_element | TEXT | Element of the day |
| moon_color | TEXT | Lucky color |
| moon_energy | TEXT | Predominant energy |
| created_at | TIMESTAMPTZ | |

#### Table: `user_daily_reveal`
Tracks which users revealed the daily card.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID (ref auth.users) | |
| date | DATE | |
| revealed_at | TIMESTAMPTZ | |
| **PK** | (user_id, date) | |

#### Table: `user_streaks`
Streak tracking per user.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID PK (ref auth.users) | |
| current_streak | INTEGER DEFAULT 0 | |
| longest_streak | INTEGER DEFAULT 0 | |
| last_reveal_date | DATE | |

#### Table: `user_card_collection`
Cards unlocked by the user.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID (ref auth.users) | |
| card_id | INTEGER (0-77) | |
| unlocked_at | TIMESTAMPTZ | |
| source | TEXT ('daily' \| 'reading') | |
| **PK** | (user_id, card_id) | |

#### Table: `user_achievements`
Badges earned by the user.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID (ref auth.users) | |
| achievement_id | TEXT | |
| unlocked_at | TIMESTAMPTZ | |
| **PK** | (user_id, achievement_id) | |

#### Table: `user_retrospectives`
Monthly retrospective cache.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID (ref auth.users) | |
| month | TEXT (YYYY-MM) | |
| content | TEXT | Gemini-generated analysis |
| created_at | TIMESTAMPTZ | |
| **PK** | (user_id, month) | |

### 1.2 Card of the Day + Streak

**Flow:**
1. User opens home → `GET /api/daily`
2. API checks `daily_content` for today's date
   - Not found → generate: shuffle deck, pick card, call Gemini (acolhedora style interpretation + ritual), calculate moon phase algorithmically, save to `daily_content`
   - Found → return cached content
3. Frontend shows "Carta do Dia" section at top of home with card face-down
4. User clicks "Revelar" → `POST /api/daily/reveal`
   - Insert into `user_daily_reveal`
   - Update `user_streaks`: if `last_reveal_date` = yesterday → increment; else → reset to 1
   - Update `longest_streak` if `current_streak` exceeds it
   - Unlock card in `user_card_collection` (source: 'daily')
   - Check and grant achievements
   - Return interpretation + current streak
5. Frontend animates card flip, shows interpretation + streak counter

**Streak logic:** Duolingo-style — skipping 1 day resets the streak to 0.

### 1.3 Card Collection

**Page:** `/colecao` — grid of all 78 arcana.

- **Unlocked cards:** Full color, clickable. Shows mini-sheet on click with data from `cards.json` + cached Pinecone chunk (no Gemini call).
- **Locked cards:** Darkened silhouette.
- **Progress indicator:** "42/78 cartas coletadas"
- **Unlock sources:**
  - Card of the day (source: 'daily')
  - Normal tarot readings (source: 'reading') — hook into existing interpret endpoint to unlock drawn cards

### 1.4 Achievements

Checked at key moments via centralized `checkAndGrantAchievements(userId, trigger)`. The function filters checks by trigger type to avoid unnecessary queries (streak achievements only on `'streak'` trigger, collection achievements only on `'card_unlock'` trigger):

| ID | Trigger | Condition |
|----|---------|-----------|
| `first_reading` | After completing first reading | readings count = 1 |
| `first_daily` | After first daily reveal | daily reveals count = 1 |
| `7_day_streak` | On streak update | current_streak >= 7 |
| `30_day_streak` | On streak update | current_streak >= 30 |
| `all_major_arcana` | On card unlock | 22 major arcana collected |
| `all_suits` | On card unlock | At least 1 card from each suit |
| `78_cards` | On card unlock | Total collection = 78 |

### 1.5 Monthly Retrospective

**Page:** `/retrospectiva`

**Flow:**
1. `GET /api/retrospective?month=2026-03`
2. Check `user_retrospectives` for cache
   - Not found → fetch all readings from that month, build prompt with metadata (themes, cards, journaling notes), call Gemini, save result
   - Found → return cached
3. Display: most frequent cards, recurring themes, emotional evolution, Gemini insight

**Availability:** Generated on first access after the month ends, or on-demand for the current month.

---

## Block 2: Reading Expansion

### 2.1 Reading by Moment (Context Shortcuts)

**Frontend-only change.** On `/reading`, before the free-text question field, display clickable chips:

| Chip | Pre-filled question |
|------|-------------------|
| Amor | "O que as cartas revelam sobre minha vida amorosa neste momento?" |
| Trabalho | "O que as cartas dizem sobre minha vida profissional agora?" |
| Saúde | "O que as cartas revelam sobre minha saúde e bem-estar?" |
| Decisão | "Preciso tomar uma decisão importante. O que as cartas aconselham?" |
| Autoconhecimento | "O que as cartas revelam sobre meu momento de autoconhecimento?" |

- Clicking a chip fills the question field (user can edit)
- No backend change — flows through existing pipeline
- Defined in `const READING_CONTEXTS` in frontend

### 2.2 Dream Reading

New reading type alongside tarot.

**Flow:**
1. User selects "Sonhos" as reading type → field changes to "Descreva seu sonho"
2. No card selection step — goes directly to interpretation
3. `POST /api/reading/draw` with `spread_type: 'sonho'`, `card_ids: null`
   - Draw endpoint detects `spread_type === 'sonho'` and skips `resolveCards()` entirely
   - `SPREAD_SIZES['sonho'] = 0` — validation accepts empty card selection
   - Saves reading with `card_ids = null`, `status = 'drawn'`
4. `POST /api/reading/[id]/interpret`:
   - Detects dream reading → skips card-based RAG search (no `$in` filter with empty array)
   - RAG searches Pinecone using **semantic search only** with the dream description as query
   - Additional filter: `content_type: 'dreams'` (requires extending `HybridQueryParams` and `buildHybridQuery` in `pinecone.ts` to support `content_type` filter)
   - Adapted system prompt: esoteric symbology, Jungian archetypes, hidden meanings
   - Respects user's chosen reading style (3 styles available)
   - Standard SSE streaming
5. Saved as normal reading, displayed in history with distinct dream icon

**Schema changes (see Cross-Cutting Concerns):**
- `readings.spread_type`: add value `'sonho'`
- `readings.card_ids`: make nullable

**Code changes required:**
- `tarot.ts`: add `'sonho'` to `SpreadType`, `SPREAD_SIZES['sonho'] = 0`
- `pinecone.ts`: extend `HybridQueryParams` with optional `content_type` filter, update `buildHybridQuery`
- `prompts.ts`: add dream-specific system prompt variant, add `spreadLabel['sonho']`
- `draw/route.ts`: conditional skip of `resolveCards()` for dream readings
- `interpret/route.ts`: conditional RAG strategy (semantic-only for dreams)

**RAG:** Ingest dream symbology content into Pinecone with metadata `content_type: 'dreams'` (dream symbol dictionary, archetypes, esoteric interpretation).

### 2.3 Duo Reading

New spread type for relationship readings.

**Flow:**
1. User selects "Leitura em Dupla" spread type
2. Additional fields: name/context of the other person + relationship type (couple, friendship, family, work)
3. 5-card spread: querent's card, other person's card, relationship dynamic, challenge, advice
4. Adapted prompt: interprets cards in relational context using the other person's context

**Schema changes (see Cross-Cutting Concerns):**
- `readings.spread_type`: add value `'leitura-dupla'`
- `readings.extra_context`: new TEXT column (nullable), stores encrypted envelope of `{ person: "name", relationship: "type" }`

**Code changes required:**
- `tarot.ts`: add `'leitura-dupla'` to `SpreadType`, `SPREAD_SIZES['leitura-dupla'] = 5`
- `prompts.ts`: add `POSITION_LABELS['leitura-dupla']` = ['Carta do consulente', 'Carta do outro', 'Dinâmica da relação', 'Desafio', 'Conselho']. Add `spreadLabel['leitura-dupla']`. Inject relational context into prompt: after decrypting `extra_context`, append "A leitura é sobre a relação do consulente com {person} ({relationship})" to the user prompt section.
- `draw/route.ts`: accept and encrypt `extra_context` field
- `interpret/route.ts`: decrypt `extra_context` and pass to `buildReadingPrompt`

### 2.4 Daily Ritual

Generated alongside the card of the day in the same lazy Gemini call. Already stored in `daily_content.ritual` (Block 1 schema).

**Prompt addition:** "Suggest a simple ritual for today based on card {card} and moon phase {moon_phase}. Include: type (meditation, crystal, mantra, herbal bath), duration, and brief instructions."

**Frontend:** Section on home below the card of the day — "Ritual do Dia". Visible only after revealing the daily card (incentivizes the reveal interaction).

---

## Block 3: Personalization & Home

### 3.1 Mystical Profile

**Data collected:**
- Birth date (required)
- Birth time (optional — for future ascendant calculation)
- Birth city (optional — idem)
- Full name (for future numerology)

**Onboarding:** Screen after first login with these fields. Existing users see a banner on home "Complete seu perfil místico" linking to `/perfil`. Banner stops showing once `birth_date` is set (the only required field).

**Schema — `profiles` table additions:**

| Column | Type | Description |
|--------|------|-------------|
| birth_date | DATE | |
| birth_time | TIME (nullable) | |
| birth_city | TEXT (nullable) | |
| full_name | TEXT (nullable) | |
| sun_sign | TEXT | Calculated from birth_date |
| personal_card_id | INTEGER | Numerological reduction → major arcana |
| life_number | INTEGER | Numerological reduction of birth date |

**Calculations (algorithmic, no API):**
- `sun_sign`: date range lookup → zodiac sign
- `personal_card_id`: sum digits of birth date, reduce until ≤ 21, map to major arcana
- `life_number`: sum all digits of birth date, reduce to single digit (except master numbers 11, 22, 33)

**Page `/perfil`:**
- Shows "mystical identity": sun sign, personal card (with collection mini-sheet), life number
- Edit birth data fields
- Auto-unlocks personal card in collection

**Integration with readings:** `buildReadingPrompt()` injects mystical profile into context when available — "The querent is Scorpio, personal card The Hermit, life number 7". Improves personalization at zero extra LLM cost.

### 3.2 Moon & Energy of the Day

Generated with `daily_content` (lazy, same Block 1 flow). Stored in `moon_phase`, `moon_element`, `moon_color`, `moon_energy` fields.

**Moon phase calculation:** Algorithmic via synodic cycle formula (29.53 days). Lightweight lib like `lune` or manual calculation — no external API.

**Frontend:** Banner at top of home (above card of the day):
```
🌒 Lua Crescente · Elemento Fogo · Cor: Vermelho · Energia de Ação
```

Always visible, no interaction required. Element and color derived from moon phase + day of week via static esoteric correspondence table.

### 3.3 Mystical Calendar

**Page:** `/calendario` — monthly view marking relevant dates.

**Event types:**
- Full and new moons (algorithmic calculation)
- Solstices and equinoxes (fixed dates per year)
- Mercury retrograde (pre-defined date ranges per year — publicly known)
- Numerological portals (11/11, 22/02, etc. — static list)
- Eclipses (pre-defined dates per year)

**Data source:** Hardcoded in `const MYSTICAL_CALENDAR` (stored in `/src/data/mystical-calendar.json` for easy annual updates) + algorithmic moon phase calculations. No database table needed. Calendar data needs manual update once per year (Mercury retrograde dates, eclipses).

**Interaction:** Clicking a marked date shows a short static description of the event. No LLM call.

---

## Block 4: Content & Education

### 4.1 Mystical School

**Page:** `/escola` — modules organized by theme.

**Modules:**
- **Major Arcana** — 22 lessons, one per card
- **Minor Arcana** — 4 modules (Cups, Swords, Pentacles, Wands), each with suit overview + cards
- **Spreads** — how each spread type works
- **Symbology** — colors, numbers, elements in tarot

**Content:** Static, manually curated. Generated once by Gemini as a base, then reviewed. Stored as markdown files in `/content/escola/` — no database, no API. Next.js serves as static pages via `generateStaticParams`.

**Lesson format:**
- Title + card image
- General meaning (2-3 paragraphs)
- Keywords
- Reflection questions
- Link to collection mini-sheet (if unlocked)

**Progress:** No progress tracking — keep it simple. Free navigation.

### 4.2 Interactive Esoteric Glossary

**Data:** JSON file at `/src/data/glossary.json` with terms and short definitions.

```json
{
  "casa-7": { "term": "Casa 7", "definition": "A casa dos relacionamentos..." },
  "mercurio-retrogrado": { "term": "Mercúrio Retrógrado", "definition": "Período em que..." }
}
```

**Integration in readings:** A `<GlossaryTerm>` component wrapping terms in interpretations. On hover/tap, shows tooltip with definition.

**Term detection:** Applied **after the full interpretation is assembled** (not during streaming, to avoid partial-chunk matching issues). Once the complete text is available client-side, regex matching against the glossary term list replaces matched terms with `<GlossaryTerm>` on render.

**Page:** `/glossario` — full searchable list of all terms.

### 4.3 Personal Year Reading

**Availability:** January (New Year) or the user's birthday month (requires `birth_date` from mystical profile).

**Flow:**
1. Special button on home during birthday month or January
2. `POST /api/reading/draw` with `spread_type: 'ano-pessoal'`
3. 12-card spread (one per month)
4. Adapted prompt: "Interpret each card as the predominant energy of each month of the querent's personal year"
5. Standard streaming, saved as reading

**Limit:** 1 personal year reading per calendar year. Checked by querying `SELECT count(*) FROM readings WHERE user_id = $1 AND spread_type = 'ano-pessoal' AND extract(year from created_at) = extract(year from now())`. Simpler than birthday-to-birthday cycle and avoids timezone ambiguity.

**Schema:** Reuses `readings` table with `spread_type: 'ano-pessoal'`. No new table.

---

## Block 5: Social & Immersion

### 5.1 Share Reading as Card

**Image generation:** API route `GET /api/reading/[id]/share` generates a PNG server-side.

**Stack:** `@vercel/og` (Satori-based) — optimized for Vercel, generates images from JSX without headless browser.

**Card layout (1080x1080 — square, ideal for Instagram/WhatsApp):**
- Dark background with mystical gradient (purple/gold Mystica tones)
- Drawn card(s) in center
- Interpretation excerpt (~150 characters)
- Reading date
- Mystica logo + "mystica.app" footer

**Flow:**
1. On reading page (`/reading/[id]`), "Compartilhar" button
2. Click → calls API to generate PNG
3. Mobile: `navigator.share()` (Web Share API) for native share sheet
4. Desktop: PNG download + copy link button

**Privacy:** Does not include the user's question — only cards and interpretation excerpt.

**Security:** Requires authentication (reading ownership check). Rate limited (5 req/60s). Image generated on-demand with short CDN cache (Cache-Control: public, max-age=3600) to avoid regenerating the same image repeatedly.

### 5.2 Pre-Reading Meditation Mode

**Intermediate screen** between card selection and interpretation start.

**Experience:**
- Fullscreen with dark background and subtle CSS animation (particles, pulsating gradient)
- Animated breathing circle: expand (inhale 4s) → hold (2s) → contract (exhale 4s)
- Guide text: "Inspire... Segure... Expire..."
- Duration: 30-60 seconds (3-4 breathing cycles)
- "Pular" (skip) button always visible
- Smooth transition to interpretation screen on completion

**Implementation:** 100% frontend. `<MeditationOverlay>` component with CSS animations. No backend, no mandatory audio.

**Audio:** If ambient sound is enabled, plays during meditation.

### 5.3 Ambient Sound

**Available sounds (MP3 files, ~30s looped, target ≤200KB each, total bundle ≤1MB):**
- Silence (default)
- Nature (rain + wind)
- Tibetan bells
- Crackling fire
- Nocturnal (crickets + gentle wind)

**Implementation:**
- Toggle on reading screen corner: sound icon 🔇/🔊
- Ambiance selector on click
- `<AudioProvider>` with React Context — manages play/pause/volume globally
- Files in `/public/audio/`, loaded via `<audio>` with `loop`
- Preference saved in `localStorage` (no database)
- Smooth fade in/out on switch or pause

**When it plays:** During pre-reading meditation and during interpretation streaming. Stops automatically on page exit.

---

## Schema Changes Summary

### New tables
- `daily_content`
- `user_daily_reveal`
- `user_streaks`
- `user_card_collection`
- `user_achievements`
- `user_retrospectives`

### Modified tables
- `profiles`: add `birth_date`, `birth_time`, `birth_city`, `full_name`, `sun_sign`, `personal_card_id`, `life_number`
- `readings`: add `spread_type` values (`'sonho'`, `'leitura-dupla'`, `'ano-pessoal'`), make `card_ids` nullable, add `extra_context TEXT` (nullable)

### New API routes
- `GET /api/daily` — fetch daily content (lazy generation)
- `POST /api/daily/reveal` — reveal daily card, update streak
- `GET /api/collection` — user's card collection
- `GET /api/achievements` — user's achievements
- `GET /api/retrospective` — monthly retrospective (lazy generation)
- `GET /api/reading/[id]/share` — generate share card PNG
- `GET /api/profile/mystic` — get mystical profile
- `PUT /api/profile/mystic` — update birth data, recalculate sun sign/card/number

### New pages
- `/colecao` — card collection grid
- `/retrospectiva` — monthly retrospective
- `/perfil` — mystical profile
- `/calendario` — mystical calendar
- `/escola` — mystical school
- `/glossario` — esoteric glossary

### New data files
- `/src/data/glossary.json` — esoteric terms
- `/content/escola/**/*.md` — school lesson content
- `/public/audio/*.mp3` — ambient sound files

### New frontend components
- `<DailyCardSection>` — card of the day on home
- `<StreakCounter>` — streak display
- `<CardCollection>` — collection grid
- `<CardMiniSheet>` — card detail sheet
- `<AchievementBadge>` — achievement display
- `<ReadingContextChips>` — moment/context shortcuts
- `<MeditationOverlay>` — breathing exercise
- `<AudioProvider>` + `<AmbientToggle>` — sound system
- `<GlossaryTerm>` — inline term tooltip
- `<MoonBanner>` — moon/energy display
- `<MysticalCalendar>` — calendar view
- `<ShareButton>` — share card generation
