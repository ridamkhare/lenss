/**
 * Server-side interaction logger.
 *
 * Writes one structured record per model interaction to Upstash Redis
 * (provisioned through the Vercel KV / marketplace integration).
 *
 * Storage shape:
 *   - List key `lens:events` — each entry is a JSON-encoded LoggedEvent.
 *     Inserted via LPUSH (newest first). Retrieve via LRANGE 0 N.
 *   - Daily count key `lens:events:count:YYYY-MM-DD` — incremented on
 *     each successful log, useful for at-a-glance volume monitoring
 *     from the Upstash UI without scanning the list.
 *
 * Geofenced: never writes anything for traffic identified as
 * originating in GDPR / UK / Swiss regions. The skip is silent.
 *
 * Failure mode: if Upstash is unreachable or the env vars are missing,
 * the logger emits a console.error and returns. It never throws, so an
 * outage of the logging path never breaks the user-facing flow.
 */

import { Redis } from "@upstash/redis"
import { isGdprRegion } from "./euCheck"
import type { Signal } from "./types"

const EVENT_LIST_KEY = "lens:events"
const DAY_COUNTER_PREFIX = "lens:events:count:"

type LoggedRoute = "reveal" | "read" | "compare" | "notice"
type LoggedMode = "read" | "yours" | "compare"
type LoggedOutcome =
  | "signals" // V1 returned signals
  | "notice" // V2 returned a notice
  | "declined" // model declined (could be V1 or V2)
  | "input_rejected" // pre-model validation failed (too short, injection, etc.)
  | "error" // pipeline error

export interface LoggedEvent {
  ts: string // ISO 8601
  route: LoggedRoute
  mode: LoggedMode
  outcome: LoggedOutcome
  duration_ms: number
  input: string // full pasted text (single passage)
  input_b?: string // second passage for compare
  signals?: Signal[] // V1 signals if outcome === "signals"
  notice?: string // V2 notice if outcome === "notice"
  decline_reason?: string // present when outcome is declined / input_rejected / error
  country?: string // x-vercel-ip-country at time of request
  user_agent?: string
}

let redisSingleton: Redis | null | undefined

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    redisSingleton = null
    return null
  }
  redisSingleton = new Redis({ url, token })
  return redisSingleton
}

/**
 * Log one interaction. Always returns; never throws.
 *
 * `req` is the incoming request — used for the GDPR check and to grab
 * useful headers (country, user agent). Pass the original NextRequest
 * directly.
 */
export async function logInteraction(
  req: Request,
  event: Omit<LoggedEvent, "ts" | "country" | "user_agent">
): Promise<void> {
  if (isGdprRegion(req)) return

  const redis = getRedis()
  if (!redis) {
    // Logging not configured. Stay silent — we don't want this path
    // to pollute server logs on every request when KV isn't set up.
    return
  }

  const full: LoggedEvent = {
    ...event,
    ts: new Date().toISOString(),
    country:
      req.headers.get("x-vercel-ip-country")?.toUpperCase() ?? undefined,
    user_agent: req.headers.get("user-agent") ?? undefined,
  }

  try {
    const dayKey =
      DAY_COUNTER_PREFIX + full.ts.slice(0, 10) // YYYY-MM-DD
    await Promise.all([
      redis.lpush(EVENT_LIST_KEY, JSON.stringify(full)),
      redis.incr(dayKey),
    ])
  } catch (err) {
    // Logging failed but the user request is already served. Don't
    // throw upstream — emit a single console.error so it surfaces in
    // Vercel function logs but doesn't break anything.
    console.error("[eventLog] failed to write:", err)
  }
}
