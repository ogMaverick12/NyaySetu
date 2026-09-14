/**
 * Sliding-Window In-Memory Rate Limiter for NyaySetu API Routes
 * Strict Requirement (02-TRD.md): "Rate limiting on upload and LLM endpoints."
 */

import { NextRequest, NextResponse } from "next/server";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Duration in milliseconds
}

export type RateLimitBucket = "ingest" | "extract" | "qa" | "compare";

export const DEFAULT_RATE_LIMITS: Record<RateLimitBucket, RateLimitConfig> = {
  ingest: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 10 uploads per 15 minutes
  },
  extract: {
    maxRequests: 15,
    windowMs: 15 * 60 * 1000, // 15 LLM clause extractions per 15 minutes
  },
  qa: {
    maxRequests: 30,
    windowMs: 15 * 60 * 1000, // 30 Q&A consultations per 15 minutes
  },
  compare: {
    maxRequests: 15,
    windowMs: 15 * 60 * 1000, // 15 comparisons per 15 minutes
  },
};

interface ClientHistory {
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
}

export class RateLimiter {
  private store = new Map<string, ClientHistory>();
  private defaultMaxRequests: number;
  private defaultWindowMs: number;

  constructor(defaultMaxRequests = 30, defaultWindowMs = 15 * 60 * 1000) {
    this.defaultMaxRequests = defaultMaxRequests;
    this.defaultWindowMs = defaultWindowMs;
  }

  /**
   * Resolves client identifier from HTTP request headers.
   */
  resolveClientId(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();

    const sessionId =
      request.headers.get("x-session-id") || request.cookies.get("nyaysetu_session")?.value;
    if (sessionId) return `sess_${sessionId.trim()}`;

    return "anonymous_client";
  }

  /**
   * Direct rate check for custom standalone rate limiters.
   */
  checkLimit(clientId: string, maxRequests?: number, windowMs?: number): RateLimitResult {
    const config: RateLimitConfig = {
      maxRequests: maxRequests ?? this.defaultMaxRequests,
      windowMs: windowMs ?? this.defaultWindowMs,
    };
    return this.checkInternal(`standalone:${clientId}`, config);
  }

  /**
   * Checks rate limit for client on given bucket.
   */
  check(
    clientId: string,
    bucket: RateLimitBucket,
    customConfig?: RateLimitConfig
  ): RateLimitResult {
    const config = customConfig || DEFAULT_RATE_LIMITS[bucket];
    return this.checkInternal(`${bucket}:${clientId}`, config);
  }

  private checkInternal(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const history = this.store.get(key) || { timestamps: [] };

    // Evict timestamps older than the sliding window
    const recentTimestamps = history.timestamps.filter((ts) => ts > windowStart);

    if (recentTimestamps.length >= config.maxRequests) {
      const earliest = recentTimestamps[0];
      const resetTime = earliest + config.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));

      this.store.set(key, { timestamps: recentTimestamps });
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime,
        retryAfterSeconds,
      };
    }

    // Record this request
    recentTimestamps.push(now);
    this.store.set(key, { timestamps: recentTimestamps });

    const remaining = Math.max(0, config.maxRequests - recentTimestamps.length);
    const resetTime = now + config.windowMs;

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetTime,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Resets stored history (useful for test isolation).
   */
  reset(): void {
    this.store.clear();
  }
}

export const InMemoryRateLimiter = RateLimiter;
export const rateLimiter = new RateLimiter();

/**
 * Convenience helper to enforce rate limit on an API route.
 * Returns an HTTP 429 response if limit breached, or null if allowed.
 */
export function enforceRateLimit(
  request: NextRequest,
  bucket: RateLimitBucket
): NextResponse | null {
  const clientId = rateLimiter.resolveClientId(request);
  const result = rateLimiter.check(clientId, bucket);

  if (!result.allowed) {
    const response = NextResponse.json(
      {
        error: "Rate limit exceeded. Too many requests submitted in a short period.",
        retryAfterSeconds: result.retryAfterSeconds,
        limit: result.limit,
      },
      { status: 429 }
    );

    response.headers.set("Retry-After", String(result.retryAfterSeconds));
    response.headers.set("X-RateLimit-Limit", String(result.limit));
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("X-RateLimit-Reset", String(result.resetTime));

    return response;
  }

  return null;
}
