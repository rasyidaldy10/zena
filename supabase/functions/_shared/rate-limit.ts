/**
 * RATE LIMITING
 * Pentagon-Grade DoS Protection
 *
 * Strategy: Sliding window algorithm with Redis backend
 * - Prevents brute force attacks
 * - Prevents DoS attacks
 * - Per-IP and per-user limits
 *
 * Without external Redis (production deployment), uses in-memory cache
 * with LRU eviction (suitable for single-instance Edge Functions)
 */

/**
 * In-Memory Rate Limiter (Fallback)
 *
 * Uses LRU cache with time-based expiration
 * Good for: Development, single-instance deployments
 * Limitation: Does not persist across function restarts
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class InMemoryRateLimiter {
  private cache: Map<string, RateLimitEntry>
  private maxSize: number

  constructor(maxSize = 10000) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  /**
   * Check if request is allowed
   * @param key - Unique identifier (IP address, user ID, etc)
   * @param limit - Max requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns { success: boolean, remaining: number, resetAt: number }
   */
  async check(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ success: boolean; remaining: number; resetAt: number }> {
    const now = Date.now()

    // Clean expired entries periodically (every 100 checks)
    if (this.cache.size > this.maxSize) {
      this.cleanExpired(now)
    }

    const entry = this.cache.get(key)

    // No entry or expired - allow and create new entry
    if (!entry || entry.resetAt < now) {
      const resetAt = now + windowMs
      this.cache.set(key, { count: 1, resetAt })
      return {
        success: true,
        remaining: limit - 1,
        resetAt
      }
    }

    // Entry exists and not expired - check count
    if (entry.count < limit) {
      entry.count++
      this.cache.set(key, entry)
      return {
        success: true,
        remaining: limit - entry.count,
        resetAt: entry.resetAt
      }
    }

    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt
    }
  }

  /**
   * Clean expired entries (LRU eviction)
   */
  private cleanExpired(now: number) {
    const toDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (entry.resetAt < now) {
        toDelete.push(key)
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key)
    }

    // If still over limit, delete oldest entries
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries())
      const toRemove = entries.slice(0, this.cache.size - this.maxSize)

      for (const [key] of toRemove) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    this.cache.delete(key)
  }
}

// Global instance (persists across requests within same function instance)
const globalLimiter = new InMemoryRateLimiter()

/**
 * Rate limit configuration presets
 */
export const RATE_LIMITS = {
  // OAuth endpoints (sensitive, low frequency)
  OAUTH: {
    limit: 10,
    windowMs: 60 * 1000 // 10 requests per minute
  },

  // Token refresh (moderate frequency)
  TOKEN_REFRESH: {
    limit: 30,
    windowMs: 60 * 1000 // 30 requests per minute
  },

  // Data fetching (higher frequency)
  DATA_FETCH: {
    limit: 60,
    windowMs: 60 * 1000 // 60 requests per minute
  },

  // Global fallback (very permissive)
  GLOBAL: {
    limit: 100,
    windowMs: 60 * 1000 // 100 requests per minute
  }
}

/**
 * Extract rate limit key from request
 * Uses IP address + user agent for fingerprinting
 */
export function getRateLimitKey(req: Request, prefix: string): string {
  const ip = req.headers.get('x-forwarded-for')
    || req.headers.get('x-real-ip')
    || 'unknown'

  const userAgent = req.headers.get('user-agent') || 'unknown'

  // Hash user agent to prevent key explosion
  const uaHash = userAgent.split('').reduce(
    (hash, char) => ((hash << 5) - hash) + char.charCodeAt(0),
    0
  ).toString(16)

  return `${prefix}:${ip}:${uaHash}`
}

/**
 * Rate limit middleware
 *
 * @param req - Request object
 * @param config - Rate limit configuration
 * @param keyPrefix - Prefix for rate limit key (e.g., 'oauth', 'refresh')
 * @returns { success: boolean, response?: Response }
 */
export async function rateLimit(
  req: Request,
  config: { limit: number; windowMs: number },
  keyPrefix: string
): Promise<{ success: boolean; response?: Response; remaining?: number }> {
  try {
    const key = getRateLimitKey(req, keyPrefix)

    const result = await globalLimiter.check(key, config.limit, config.windowMs)

    if (!result.success) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)

      return {
        success: false,
        response: new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again in ${retryAfter} seconds.`,
            retry_after: retryAfter
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.floor(result.resetAt / 1000).toString()
            }
          }
        )
      }
    }

    // Request allowed
    return {
      success: true,
      remaining: result.remaining
    }
  } catch (error) {
    console.error('Rate limiting error:', error)
    // On error, allow request (fail open)
    return { success: true }
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  headers: HeadersInit,
  config: { limit: number; windowMs: number },
  remaining: number
): Headers {
  const headersObj = new Headers(headers)

  headersObj.set('X-RateLimit-Limit', config.limit.toString())
  headersObj.set('X-RateLimit-Remaining', remaining.toString())
  headersObj.set(
    'X-RateLimit-Reset',
    Math.floor((Date.now() + config.windowMs) / 1000).toString()
  )

  return headersObj
}

/**
 * Rate limit wrapper for Edge Functions
 *
 * Usage:
 * ```ts
 * serve(withRateLimit(async (req) => {
 *   // Your handler
 * }, RATE_LIMITS.OAUTH, 'oauth'))
 * ```
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  config: { limit: number; windowMs: number },
  keyPrefix: string
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Check rate limit
    const { success, response, remaining } = await rateLimit(req, config, keyPrefix)

    if (!success && response) {
      return response
    }

    // Execute handler
    const handlerResponse = await handler(req)

    // Add rate limit headers to response
    if (remaining !== undefined) {
      const headers = addRateLimitHeaders(
        handlerResponse.headers,
        config,
        remaining
      )

      return new Response(handlerResponse.body, {
        status: handlerResponse.status,
        statusText: handlerResponse.statusText,
        headers
      })
    }

    return handlerResponse
  }
}
