import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const ENVELOPE_ALGORITHM = 'A256GCM'
const ENVELOPE_VERSION = 1
const IV_LENGTH = 12
const KEY_LENGTH = 32
const HKDF_INFO = 'mystica:readings:v1'

interface EncryptionEnvelopeV1 {
  v: 1
  alg: 'A256GCM'
  iv: string
  ciphertext: string
  tag: string
}

export async function encryptForUser(userId: string, plaintext: string | null) {
  if (plaintext === null) {
    return null
  }

  const key = deriveUserKey(userId)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const envelope: EncryptionEnvelopeV1 = {
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALGORITHM,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  }

  return JSON.stringify(envelope)
}

export async function decryptForUser(userId: string, value: string | null) {
  if (value === null) {
    return null
  }

  const envelope = parseEnvelope(value)
  if (!envelope) {
    return value
  }

  const key = deriveUserKey(userId)
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(envelope.iv, 'base64')
  )

  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ])

  return plaintext.toString('utf8')
}

function deriveUserKey(userId: string) {
  const masterKey = getMasterKey()
  return hkdfSync('sha256', masterKey, Buffer.from(userId, 'utf8'), HKDF_INFO, KEY_LENGTH)
}

function getMasterKey() {
  const configured = process.env.APP_MASTER_KEY
  if (!configured) {
    throw new Error('APP_MASTER_KEY is required')
  }

  const decoded = Buffer.from(configured, 'base64')
  if (decoded.length === 0) {
    throw new Error('APP_MASTER_KEY must be a valid base64 value')
  }

  return decoded
}

function parseEnvelope(value: string): EncryptionEnvelopeV1 | null {
  try {
    const parsed = JSON.parse(value) as Partial<EncryptionEnvelopeV1>

    if (
      parsed.v !== ENVELOPE_VERSION ||
      parsed.alg !== ENVELOPE_ALGORITHM ||
      typeof parsed.iv !== 'string' ||
      typeof parsed.ciphertext !== 'string' ||
      typeof parsed.tag !== 'string'
    ) {
      return null
    }

    return parsed as EncryptionEnvelopeV1
  } catch {
    return null
  }
}
