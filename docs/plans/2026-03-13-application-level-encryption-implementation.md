# Application-Level Encryption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Encrypt `readings.question` and `readings.interpretation` at application level while preserving Mystica's current generation, streaming, detail, and history flows.

**Architecture:** Add a dedicated encryption module that derives a user-scoped key from `APP_MASTER_KEY` and `user.id`, serializes encrypted values into a versioned envelope, and transparently decrypts them on read. Update the reading detail, history, and interpretation routes to use that module while preserving plaintext fallback for legacy rows and leaving `metadata` unchanged.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Web Crypto / Node crypto, Supabase server client.

---

### Task 1: Encryption module

**Files:**
- Create: `src/lib/__tests__/encryption.test.ts`
- Create: `src/lib/encryption.ts`

**Step 1: Write the failing test**

```ts
import {
  decryptForUser,
  encryptForUser,
} from '@/lib/encryption'

describe('encryption', () => {
  beforeEach(() => {
    process.env.APP_MASTER_KEY = Buffer.alloc(32, 7).toString('base64')
  })

  it('round-trips a plaintext value for the same user', async () => {
    const payload = await encryptForUser('user-a', 'segredo')
    await expect(decryptForUser('user-a', payload)).resolves.toBe('segredo')
  })

  it('fails for a different user', async () => {
    const payload = await encryptForUser('user-a', 'segredo')
    await expect(decryptForUser('user-b', payload)).rejects.toThrow()
  })

  it('passes legacy plaintext through unchanged', async () => {
    await expect(decryptForUser('user-a', 'texto legado')).resolves.toBe('texto legado')
  })

  it('preserves null values', async () => {
    await expect(decryptForUser('user-a', null)).resolves.toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/__tests__/encryption.test.ts`

Expected: FAIL because `@/lib/encryption` does not exist yet.

**Step 3: Write minimal implementation**

```ts
export interface EncryptionEnvelopeV1 {
  v: 1
  alg: 'A256GCM'
  iv: string
  ciphertext: string
}

export async function encryptForUser(userId: string, plaintext: string | null) {
  // return null for null
  // derive a 32-byte key from APP_MASTER_KEY + userId
  // encrypt with AES-256-GCM and random 12-byte iv
  // return JSON.stringify(envelope)
}

export async function decryptForUser(userId: string, value: string | null) {
  // return null for null
  // if value is not a recognized envelope, return it unchanged
  // otherwise derive the same key and decrypt
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/__tests__/encryption.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/encryption.ts src/lib/__tests__/encryption.test.ts
git commit -m "feat: add application-level encryption helpers"
```

### Task 2: Read-path decryption for detail and history

**Files:**
- Create: `src/app/api/__tests__/reading-decryption.test.ts`
- Modify: `src/app/api/reading/[id]/route.ts`
- Modify: `src/app/api/history/route.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/encryption', () => ({
  decryptForUser: vi.fn(),
}))

it('decrypts completed reading fields before returning detail response', async () => {
  // mock supabase auth + row with encrypted question and interpretation
  // call GET on /api/reading/[id]
  // expect decryptForUser to be called for question and interpretation
  // expect JSON response to contain plaintext values
})

it('decrypts completed reading fields before returning history response', async () => {
  // mock completed history rows
  // expect response.readings[n].question to be plaintext
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/__tests__/reading-decryption.test.ts`

Expected: FAIL because routes still return stored values directly.

**Step 3: Write minimal implementation**

```ts
// in both routes:
// - keep auth flow unchanged
// - after fetching rows, call decryptForUser(user.id, reading.question)
// - call decryptForUser(user.id, reading.interpretation) for completed readings
// - leave metadata untouched
// - preserve legacy/plaintext fallback through the helper
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/__tests__/reading-decryption.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/__tests__/reading-decryption.test.ts src/app/api/reading/[id]/route.ts src/app/api/history/route.ts
git commit -m "feat: decrypt reading content on read"
```

### Task 3: Write-path encryption in interpretation flow

**Files:**
- Create: `src/app/api/__tests__/reading-interpret-encryption.test.ts`
- Modify: `src/app/api/reading/[id]/interpret/route.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/encryption', () => ({
  encryptForUser: vi.fn(),
}))

it('encrypts question and interpretation before persisting a completed reading', async () => {
  // mock a drawn reading with plaintext question
  // mock streamInterpretation to yield plaintext chunks
  // call POST on /api/reading/[id]/interpret
  // assert Supabase update receives encrypted question and encrypted interpretation
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/__tests__/reading-interpret-encryption.test.ts`

Expected: FAIL because the route still writes plaintext.

**Step 3: Write minimal implementation**

```ts
// in interpret route:
// - keep reading.question plaintext in memory for prompt generation
// - after stream completion, call encryptForUser(user.id, reading.question)
// - call encryptForUser(user.id, fullText)
// - persist encrypted values in the completion update
// - when returning an already completed reading, decrypt the stored interpretation before responding
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/__tests__/reading-interpret-encryption.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/__tests__/reading-interpret-encryption.test.ts src/app/api/reading/[id]/interpret/route.ts
git commit -m "feat: encrypt persisted reading content"
```

### Task 4: Verification sweep

**Files:**
- Modify: `src/lib/__tests__/encryption.test.ts` if gaps appear
- Modify: `src/app/api/__tests__/reading-decryption.test.ts` if gaps appear
- Modify: `src/app/api/__tests__/reading-interpret-encryption.test.ts` if gaps appear

**Step 1: Run targeted tests**

Run: `npm run test:run -- src/lib/__tests__/encryption.test.ts src/app/api/__tests__/reading-decryption.test.ts src/app/api/__tests__/reading-interpret-encryption.test.ts`

Expected: PASS

**Step 2: Run broader project tests**

Run: `npm run test:run`

Expected: PASS with no regressions in existing login or tarot tests.

**Step 3: Run lint**

Run: `npm run lint`

Expected: PASS

**Step 4: Commit**

```bash
git add src
git commit -m "test: verify application-level encryption integration"
```
