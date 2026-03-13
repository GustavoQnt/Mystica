import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Ensures Upstash variables are present. If not, it simply bypasses rate-limiting
 * gracefully rather than crashing the whole app, allowing easier local development
 * without needing an immediate Redis instance until ready for production.
 */
let redisConfigured = false
let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    redisConfigured = true
  } catch (error) {
    console.warn('Failed to initialize Upstash Redis. Rate limiting disabled.', error)
  }
}

// Create a new ratelimiter, that allows 3 requests per 30 seconds
const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '30 s'),
      analytics: true,
      /**
       * Optional prefix for the keys used in redis. This is useful if you want to share a redis
       * instance with other applications and want to avoid key collisions. The default prefix is
       * @upstash/ratelimit
       */
      prefix: '@upstash/ratelimit',
    })
  : null

export async function checkRateLimit(identifier: string): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  if (!ratelimit || !redisConfigured) {
    // If Redis is not configured, bypass rate limiting
    return { success: true, limit: 100, remaining: 100, reset: 0 }
  }

  return ratelimit.limit(identifier)
}
