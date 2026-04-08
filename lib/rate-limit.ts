/**
 * Simple in-memory rate limiter.
 * Max 20 requests per user per 60-second window.
 * Note: resets per serverless instance — suitable for edge abuse prevention,
 * not a replacement for a Redis-backed limiter in high-traffic production.
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 20

export function rateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(userId)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(userId, { count: 1, windowStart: now })
    return { allowed: true, remaining: MAX_REQUESTS - 1 }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: MAX_REQUESTS - entry.count }
}
