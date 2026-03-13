import { beforeEach, describe, expect, it } from 'vitest'

import { decryptForUser, encryptForUser } from '@/lib/encryption'

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
