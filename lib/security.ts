import type { NextRequest } from "next/server"

/**
 * Server-side abuse guards. Run before any expensive work in the API
 * route handlers. Layered: origin check → payload size → per-IP rate
 * limit → optional emergency kill switch.
 *
 * Per-IP rate limit is in-memory inside the function instance. On a
 * serverless platform this is best-effort (each instance has its own
 * map), but it still cuts the realistic attack ceiling significantly:
 * a single attacker firing through one connection hits one instance
 * and gets capped quickly.
 */

const ALLOWED_ORIGINS = new Set([
  "https://lenss.one",
  "https://www.lenss.one",
])

if (process.env.NODE_ENV !== "production") {
  ALLOWED_ORIGINS.add("http://localhost:3000")
  ALLOWED_ORIGINS.add("http://127.0.0.1:3000")
}

const MAX_PAYLOAD_BYTES = 50 * 1024
const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX_PER_MINUTE = 5
const RATE_MAX_PER_HOUR = 30
const HOUR_MS = 60 * 60 * 1000

interface IpState {
  timestamps: number[]
}

const ipRequests = new Map<string, IpState>()

export interface SecurityCheckResult {
  ok: boolean
  status?: number
  reason?: string
}

export function checkSecurity(req: NextRequest): SecurityCheckResult {
  if (process.env.LENS_DISABLE_READS === "true") {
    return { ok: false, status: 503, reason: "Service temporarily paused." }
  }

  const origin = req.headers.get("origin")
  const referer = req.headers.get("referer")
  let originOk = false
  if (origin) {
    originOk = ALLOWED_ORIGINS.has(origin)
  } else if (referer) {
    try {
      const refUrl = new URL(referer)
      originOk = ALLOWED_ORIGINS.has(`${refUrl.protocol}//${refUrl.host}`)
    } catch {
      originOk = false
    }
  }
  if (!originOk) {
    return { ok: false, status: 403, reason: "forbidden" }
  }

  const contentLength = parseInt(req.headers.get("content-length") || "0", 10)
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return { ok: false, status: 413, reason: "payload too large" }
  }

  const ip = getIp(req)
  const now = Date.now()
  const state = ipRequests.get(ip) || { timestamps: [] }
  state.timestamps = state.timestamps.filter((t) => now - t < HOUR_MS)

  const recentMinute = state.timestamps.filter(
    (t) => now - t < RATE_WINDOW_MS
  ).length
  if (recentMinute >= RATE_MAX_PER_MINUTE) {
    return {
      ok: false,
      status: 429,
      reason: "Too many requests in the last minute.",
    }
  }
  if (state.timestamps.length >= RATE_MAX_PER_HOUR) {
    return {
      ok: false,
      status: 429,
      reason: "Too many requests in the last hour.",
    }
  }

  state.timestamps.push(now)
  ipRequests.set(ip, state)

  if (ipRequests.size > 2000) {
    for (const [k, v] of ipRequests.entries()) {
      v.timestamps = v.timestamps.filter((t) => now - t < HOUR_MS)
      if (v.timestamps.length === 0) ipRequests.delete(k)
    }
  }

  return { ok: true }
}

function getIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real
  return "unknown"
}
