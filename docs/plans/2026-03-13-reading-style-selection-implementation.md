# Reading Style Selection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a required reading-style choice to the tarot flow, persist it on each reading, use it to shape Mystica's interpretation, and expose it in history with clearer user-facing labels.

**Architecture:** Introduce a small typed reading-style domain shared by the UI, API routes, and prompt builder. Persist the chosen style on `readings`, default older records to `sincera`, and thread the value through draw, read, interpret, and history surfaces so the selected voice is transparent and stable across retries.

**Tech Stack:** Next.js App Router, React Client and Server Components, TypeScript, Supabase, Vitest, Testing Library.

---

### Task 1: Define the reading-style domain and database support

**Files:**
- Create: `src/lib/reading-style.ts`
- Create: `supabase/migrations/002_reading_style.sql`
- Modify: `src/app/api/reading/draw/route.ts`
- Modify: `src/app/api/reading/[id]/route.ts`
- Modify: `src/app/api/reading/[id]/interpret/route.ts`

**Step 1: Write the failing test**

```ts
it('returns the saved reading style and falls back to sincera when missing', async () => {
  // Mock a completed reading with `reading_style: null`
  // Expect GET /api/reading/[id] serialization to expose `reading_style: "sincera"`
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/__tests__/reading-decryption.test.ts`

Expected: FAIL because the current API payload has no `reading_style` field or fallback behavior.

**Step 3: Write minimal implementation**

```ts
export const READING_STYLES = ['sincera', 'acolhedora', 'analitica'] as const
export type ReadingStyle = (typeof READING_STYLES)[number]

export function resolveReadingStyle(style: string | null | undefined): ReadingStyle {
  return style === 'acolhedora' || style === 'analitica' ? style : 'sincera'
}
```

- Add a migration that creates a nullable `reading_style` column on `public.readings`.
- Keep existing rows nullable so historical records can fall back in code instead of requiring a risky data rewrite.
- Extend API selects and serialization to include `reading_style`.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/__tests__/reading-decryption.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/reading-style.ts supabase/migrations/002_reading_style.sql src/app/api/reading/draw/route.ts src/app/api/reading/[id]/route.ts src/app/api/reading/[id]/interpret/route.ts src/app/api/__tests__/reading-decryption.test.ts
git commit -m "feat: add persisted reading style domain"
```

### Task 2: Require style selection in the new reading screen

**Files:**
- Modify: `src/app/reading/page.tsx`
- Modify: `src/app/sections.test.tsx` or create `src/app/reading/page.test.tsx`

**Step 1: Write the failing test**

```tsx
it('keeps the continue button disabled until a reading style is selected', () => {
  render(<ReadingPage />)

  fireEvent.change(screen.getByPlaceholderText('O que em mim precisa ser visto agora?'), {
    target: { value: 'Quero entender meu momento atual' },
  })

  expect(
    screen.getByRole('button', { name: 'Continuar para escolher as cartas' })
  ).toBeDisabled()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/reading/page.test.tsx`

Expected: FAIL because the screen has no style selector and the button only depends on question length.

**Step 3: Write minimal implementation**

```tsx
const [readingStyle, setReadingStyle] = useState<ReadingStyle | null>(null)
const canContinue = question.trim().length >= 3 && readingStyle !== null

<p className="mystica-label">Estilo da leitura</p>
<StyleOption title="Sincera" subtitle="Verdade nua e crua, sem enrolação." />
<StyleOption title="Acolhedora" subtitle="Verdade com mais cuidado e acolhimento." />
<StyleOption title="Analítica" subtitle="Verdade com leitura profunda de padrões, emoções e autoconhecimento." />
```

- Rename the CTA to `Continuar para escolher as cartas`.
- Rename the secondary action to `Voltar e editar minha pergunta`.
- Send `reading_style` in the draw payload.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/reading/page.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/reading/page.tsx src/app/reading/page.test.tsx
git commit -m "feat: require reading style before card selection"
```

### Task 3: Validate and persist the chosen style during draw creation

**Files:**
- Modify: `src/app/api/reading/draw/route.ts`
- Create or modify: `src/app/api/__tests__/reading-draw-route.test.ts`

**Step 1: Write the failing test**

```ts
it('rejects draw creation when reading_style is missing', async () => {
  const request = new Request('http://localhost/api/reading/draw', {
    method: 'POST',
    body: JSON.stringify({
      spread_type: 'tres-cartas',
      fan_indices: [0, 10, 20],
      question: 'O que preciso enxergar?',
    }),
  })

  const response = await POST(request)

  expect(response.status).toBe(400)
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/__tests__/reading-draw-route.test.ts`

Expected: FAIL because the route currently accepts payloads with no style.

**Step 3: Write minimal implementation**

```ts
if (!isReadingStyle(reading_style)) {
  return NextResponse.json({ error: 'Invalid reading_style' }, { status: 400 })
}

.insert({
  user_id: user.id,
  status: 'drawn',
  spread_type,
  question: question.trim(),
  card_ids: cardIds,
  reading_style,
})
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/__tests__/reading-draw-route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/reading/draw/route.ts src/app/api/__tests__/reading-draw-route.test.ts
git commit -m "feat: validate reading style on draw creation"
```

### Task 4: Refactor prompts so style changes delivery, not Mystica's identity

**Files:**
- Modify: `src/lib/prompts.ts`
- Create: `src/lib/__tests__/prompts.test.ts`

**Step 1: Write the failing test**

```ts
it('builds a sincera system prompt that preserves bronca with guidance', () => {
  const prompt = getSystemPromptForStyle('sincera')

  expect(prompt).toContain('comportamento')
  expect(prompt).toContain('solução')
})

it('builds an analitica system prompt with Jungian framing', () => {
  const prompt = getSystemPromptForStyle('analitica')

  expect(prompt).toContain('arquétipos')
  expect(prompt).toContain('sombra')
  expect(prompt).toContain('individuação')
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/__tests__/prompts.test.ts`

Expected: FAIL because prompt generation is currently a single fixed string.

**Step 3: Write minimal implementation**

```ts
export function getSystemPromptForStyle(style: ReadingStyle) {
  const baseIdentity = `Você é Mystica...`

  const variants = {
    sincera: `... bronca com humor, contexto e solução ...`,
    acolhedora: `... honestidade com amparo emocional ...`,
    analitica: `... leitura profunda com arquétipos, sombra e autoconhecimento ...`,
  }

  return `${baseIdentity}\n\n${variants[style]}`
}
```

- Preserve Mystica's core identity in all styles.
- Keep `Sincera` abrasive-but-caring, not demeaning.
- Keep `Analítica` Jungian but not academic.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/__tests__/prompts.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/prompts.ts src/lib/__tests__/prompts.test.ts
git commit -m "feat: add style-aware Mystica prompts"
```

### Task 5: Use the saved style during interpretation and regeneration

**Files:**
- Modify: `src/app/api/reading/[id]/interpret/route.ts`
- Modify: `src/app/api/__tests__/reading-interpret-encryption.test.ts`

**Step 1: Write the failing test**

```ts
it('passes the saved reading style into prompt construction during interpretation', async () => {
  // Mock a reading saved with `reading_style: "acolhedora"`
  // Expect the prompt builder to be called with that style
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/__tests__/reading-interpret-encryption.test.ts`

Expected: FAIL because the interpretation route currently ignores reading style.

**Step 3: Write minimal implementation**

```ts
const prompt = await buildReadingContext({
  ...,
  readingStyle: resolveReadingStyle(reading.reading_style),
})
```

- Ensure `completed` re-reads still return the already-generated interpretation without changing style.
- Ensure `failed` regeneration reuses the persisted style.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/__tests__/reading-interpret-encryption.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/reading/[id]/interpret/route.ts src/app/api/__tests__/reading-interpret-encryption.test.ts
git commit -m "feat: reuse saved reading style during interpretation"
```

### Task 6: Expose the style in history and detail UIs

**Files:**
- Modify: `src/app/history/sections.tsx`
- Modify: `src/app/history/sections.test.tsx`
- Modify: `src/app/reading/[id]/page.tsx`

**Step 1: Write the failing test**

```tsx
it('renders the selected reading style in the history card metadata', async () => {
  render(await HistoryListSection())

  expect(screen.getByText(/Sincera/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/history/sections.test.tsx`

Expected: FAIL because history currently does not render any style information.

**Step 3: Write minimal implementation**

```tsx
<p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-strong)]">
  {formattedDate} · {spreadLabel} · {readingStyleLabel}
</p>
```

- Include `reading_style` in the history query.
- Use a label helper so `analitica` renders as `Analítica`.
- Update the detail page record type so the field is available for future display needs and consistent client state.
- Rename `Nova tiragem` to `Fazer nova leitura`.
- Rename `Tentar novamente` to `Gerar interpretação novamente`.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/history/sections.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/history/sections.tsx src/app/history/sections.test.tsx src/app/reading/[id]/page.tsx
git commit -m "feat: show reading style in history and detail actions"
```

### Task 7: Run focused verification for the full slice

**Files:**
- No code changes required unless failures are found

**Step 1: Run the focused test suite**

Run: `npm run test:run -- src/app/reading/page.test.tsx src/app/history/sections.test.tsx src/app/api/__tests__/reading-draw-route.test.ts src/app/api/__tests__/reading-decryption.test.ts src/app/api/__tests__/reading-interpret-encryption.test.ts src/lib/__tests__/prompts.test.ts`

Expected: PASS

**Step 2: Run one broader regression suite**

Run: `npm run test:run -- src/app/sections.test.tsx src/app/history/sections.test.tsx src/app/login/page.test.tsx src/lib/__tests__/encryption.test.ts src/lib/__tests__/tarot.test.ts src/lib/supabase/middleware.test.ts`

Expected: PASS

**Step 3: If any test fails, fix with TDD before proceeding**

```ts
// Add the smallest failing test for the regression
// Implement the minimal fix
// Re-run the affected command
```

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify reading style selection flow"
```
