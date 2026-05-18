# Design Doc: Application-Level Encryption

## Objective

Protect user privacy by encrypting sensitive reading content before it is persisted to Supabase. The server may still handle the content in memory during generation, streaming, and retrieval, but the database must store `question` and `interpretation` in a format that is not human-readable.

This design is intentionally scoped to fit Mystica's current architecture. It preserves the existing server-side RAG pipeline, Gemini integration, SSE streaming, and reading history while eliminating plaintext storage of the most sensitive fields.

## Approved Scope

- Encrypt `readings.question`.
- Encrypt `readings.interpretation`.
- Keep `readings.metadata` in plaintext by explicit product decision.
- Preserve the current UX and API behavior for reading generation, detail view, and history.
- Support legacy rows that were created before encryption existed.

## Non-Goals

- End-to-end encryption where even the Mystica backend cannot see the reading in memory.
- Client-managed keys or recovery phrases.
- Encrypting `metadata`, `card_ids`, `spread_type`, or other operational fields.
- Rebuilding the RAG or streaming architecture.

## Why This Approach

Mystica currently generates readings on the server. The server reads the user's question, builds a contextual prompt, calls Gemini, streams the response to the browser, and saves the final interpretation in Supabase. Because of that architecture, true E2E privacy would require a much larger redesign.

Application-level encryption is the best fit because it solves the main ethical issue: persisted user content is no longer visible in Supabase or through routine database access. It is materially safer while keeping the current product intact.

## High-Level Architecture

### Current State

- `question` and `interpretation` are stored as plaintext in `public.readings`.
- The detail and history APIs read those fields directly from Supabase and return them to the frontend.
- The interpretation endpoint generates plaintext, streams plaintext, and then persists plaintext.

### Target State

- `question` and `interpretation` are encrypted before any write to Supabase.
- History and detail endpoints decrypt those fields after reading them from Supabase and before responding to the authenticated owner.
- The interpretation endpoint still handles plaintext in memory during prompt construction and streaming, but only encrypted values are persisted.
- `metadata` remains plaintext.

## Cryptographic Design

### Algorithm

- Use `AES-256-GCM`.
- Generate a fresh random IV for each encryption operation.
- Use authenticated encryption so tampered payloads fail decryption cleanly.

### Key Derivation

- Keep a single server-side master secret in environment configuration, for example `APP_MASTER_KEY`.
- Derive a user-specific key from the master key and the authenticated Supabase `user.id`.
- Recommended derivation: HKDF over the master key, namespaced for Mystica and versioned for future rotation.

This gives per-user isolation while keeping the operational model simple. It does not prevent someone with full runtime and secret access from decrypting content, but it does prevent casual visibility in Supabase and removes plaintext persistence.

## Storage Format

Encrypted fields will be stored as serialized JSON envelopes rather than opaque base64 blobs.

Example:

```json
{
  "v": 1,
  "alg": "A256GCM",
  "iv": "base64...",
  "ciphertext": "base64..."
}
```

Notes:

- `v` supports format evolution and key-rotation strategies later.
- `alg` makes the payload self-describing.
- `iv` stores the nonce used for the operation.
- `ciphertext` stores the encrypted payload and authentication data as produced by the chosen implementation.

If the implementation library exposes the GCM tag separately, it may be stored explicitly as `tag`. If the API returns ciphertext with the tag already appended, the envelope may omit a separate `tag` field. The important requirement is stable versioned structure, not a specific Node.js buffer layout.

## Data Flow

### Reading Creation and Interpretation

1. The user submits a question.
2. The server receives the question in plaintext for the request lifecycle.
3. The interpretation endpoint reads the draft reading and builds the RAG prompt.
4. Gemini returns plaintext chunks that are streamed to the browser.
5. When the interpretation completes, the server encrypts:
   - the original `question`
   - the final `interpretation`
6. Supabase stores only the encrypted envelopes for those fields.
7. `metadata` is stored in plaintext as it is today.

### Reading Detail

1. The detail endpoint fetches the row for the authenticated owner.
2. If the reading is completed, the server attempts to decrypt `question` and `interpretation`.
3. The API returns plaintext values to the authenticated browser exactly as the frontend expects.

### History

1. The history endpoint fetches completed readings for the authenticated owner.
2. Each row is decrypted server-side before being returned.
3. The frontend remains unchanged apart from depending on the decrypted response format.

## Backward Compatibility

The system must support existing rows created before encryption.

Rules:

- `null` remains `null`.
- If a field contains a valid encryption envelope, decrypt it.
- If a field does not parse as a recognized envelope, treat it as legacy plaintext and return it unchanged.

This avoids immediate breakage and allows gradual migration of existing rows if desired.

## Error Handling

### Missing Configuration

- If `APP_MASTER_KEY` is absent, endpoints that require encryption or decryption must fail closed.
- The application must not silently fall back to plaintext persistence.

### Corrupt or Incompatible Payloads

- If an envelope is malformed, version-unknown, or fails authentication, the API must return a controlled failure.
- The response must not include raw encrypted payloads or partially recovered text.
- Logs may include non-sensitive identifiers such as reading ID, endpoint, and failure category.

### Legacy Data

- Legacy plaintext is not an error condition.
- It should continue to load normally until an explicit migration strategy is executed.

## Schema Strategy

No immediate schema change is strictly required because both encrypted payloads and legacy plaintext can still fit in the current text columns.

That said, the application contract changes:

- `readings.question` becomes either legacy plaintext or serialized encrypted envelope.
- `readings.interpretation` becomes either legacy plaintext or serialized encrypted envelope.

Optional future work:

- Add a boolean or enum marker if operational visibility into migration progress becomes important.
- Backfill old rows into encrypted form once the runtime path is stable.

## Application Components

### New Module

Create a dedicated encryption utility, for example:

- `src/lib/encryption.ts`

Responsibilities:

- parse and validate the master key
- derive a user-scoped key
- encrypt plaintext into the versioned envelope
- decrypt versioned envelopes
- detect and pass through legacy plaintext safely

### Routes To Update

- `src/app/api/reading/[id]/interpret/route.ts`
- `src/app/api/reading/[id]/route.ts`
- `src/app/api/history/route.ts`

Expected behavior:

- `interpret` encrypts before persistence
- `reading/[id]` decrypts before returning completed readings
- `history` decrypts each returned row before serializing the API response

## Security Properties

This design provides:

- no plaintext persistence of the most sensitive content
- reduced exposure through database consoles, exports, and snapshots
- per-user key separation derived from a single application secret
- authenticated decryption failure on tampered ciphertext

This design does not provide:

- protection against a trusted operator with full runtime secret access
- protection against plaintext visibility during active request processing
- E2E confidentiality between the user's browser and the model provider

## Testing Requirements

### Unit Tests

- encrypt/decrypt round-trip returns the original plaintext
- different users derive different effective keys
- decrypting with the wrong user context fails
- malformed envelopes fail safely
- legacy plaintext passes through unchanged
- `null` input remains `null`

### Route/Integration Tests

- interpretation endpoint persists encrypted `question` and `interpretation`
- detail endpoint returns decrypted values for completed readings
- history endpoint returns decrypted values for completed readings
- metadata remains unchanged and readable
- missing `APP_MASTER_KEY` fails closed

## Migration Strategy

Phase 1:

- ship runtime encryption for all new writes
- support decryption plus legacy plaintext fallback on reads

Phase 2, optional:

- add a one-time backfill script to encrypt historical rows
- measure completion and remove legacy fallback only after all relevant data is migrated

## Design Summary

Mystica should adopt server-side application-level encryption for `question` and `interpretation` using `AES-256-GCM` with a versioned JSON envelope and a user-scoped derived key. This preserves the current product architecture, keeps `metadata` open for model improvement, removes plaintext persistence from Supabase, and materially improves privacy without introducing the complexity of true end-to-end encryption.
