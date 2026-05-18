# Home Recent Cards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the home page "Memoria recente" section render real tarot card thumbnails using the same visual pattern as the history page.

**Architecture:** Reuse the existing card image helper and mirror the history card-preview markup inside the home recent readings section. Keep the rest of the home card layout intact, changing only the card preview area.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Vitest.

---

### Task 1: Replace text-only recent card blocks with real card previews

**Files:**
- Modify: `src/app/sections.tsx`
- Modify: `src/app/sections.test.tsx`

**Step 1: Write the failing test**

```ts
it('renders recent readings with real tarot card thumbnails', async () => {
  render(await RecentReadingsSection())

  expect(screen.getByAltText('O Mago')).toBeInTheDocument()
  expect(screen.getByText('O Mago')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/sections.test.tsx`

Expected: FAIL because the section still renders text-only blocks and no image alt text.

**Step 3: Write minimal implementation**

```ts
import { getCardImageCandidates } from '@/lib/card-images'

// Replace the text box per card with:
// - picture
// - avif/webp sources
// - img with card.name alt text
// - caption below image
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/sections.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/sections.tsx src/app/sections.test.tsx
git commit -m "feat: align home recent cards with history previews"
```
