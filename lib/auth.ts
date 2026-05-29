import { randomBytes } from "node:crypto"
import { db, schema } from "@/lib/db"
import { eq, and, gt } from "drizzle-orm"

/**
 * Auth model (v1): email-only, magic-link.
 *
 * Lifecycle:
 *   1. POST /api/auth/signup with {email} → creates a pending user
 *      (or finds existing), generates a magic_token, sets a 24h expiry,
 *      sends magic link via email.
 *   2. User clicks the link → GET /api/auth/activate?token=<magic>
 *      → validates token + expiry, generates a session_token, clears the
 *      pending magic, redirects to /send-check?token=<session>.
 *   3. Page reads ?token=... from URL on mount, saves to localStorage,
 *      includes it in every subsequent API call via Authorization header.
 *   4. Server endpoints look up user by session_token; if not found,
 *      treat request as anonymous.
 *
 * Tokens are plaintext in the DB for v1. Trade-off: simpler code, weaker
 * defense against a hypothetical DB compromise. Acceptable until we have
 * paying customers in volume; revisit when we add hashing then.
 */

const MAGIC_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function generateToken(): string {
  return randomBytes(32).toString("hex")
}

export function isEmailShape(s: unknown): s is string {
  if (typeof s !== "string") return false
  const trimmed = s.trim()
  if (trimmed.length < 3 || trimmed.length > 254) return false
  // RFC-5322-ish but practical: one @ with non-empty parts and at least one dot in the domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Issue a fresh magic token for an email. Creates the user row on first
 * signup or refreshes the pending token on a repeat signup. Returns the
 * (plaintext) token so the caller can email it. The trial countdown starts
 * at first user creation, NOT at every signup attempt.
 */
export async function issueMagicTokenForEmail(emailRaw: string): Promise<{
  email: string
  magicToken: string
  isNewUser: boolean
}> {
  const email = normalizeEmail(emailRaw)
  const magicToken = generateToken()
  const expiresAt = new Date(Date.now() + MAGIC_TOKEN_TTL_MS)

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(schema.users)
      .set({
        pendingMagicToken: magicToken,
        pendingMagicExpiresAt: expiresAt,
      })
      .where(eq(schema.users.id, existing[0].id))
    return { email, magicToken, isNewUser: false }
  }

  await db.insert(schema.users).values({
    email,
    pendingMagicToken: magicToken,
    pendingMagicExpiresAt: expiresAt,
    // plan + trial defaults handled by schema (trial / now / now+14d)
  })
  return { email, magicToken, isNewUser: true }
}

/**
 * Validate a magic token, mint a session token, and return the resulting
 * user state. Idempotent: re-using a valid magic token within its window
 * still works (replaces the existing pending token + issues a fresh
 * session). Once activated, the pending magic is cleared so the same
 * token can't be reused after that.
 */
export async function activateMagicToken(magicToken: string): Promise<{
  ok: true
  sessionToken: string
  userId: string
} | { ok: false; reason: string }> {
  if (!magicToken || magicToken.length < 32) {
    return { ok: false, reason: "invalid_token" }
  }
  const now = new Date()
  const rows = await db
    .select({
      id: schema.users.id,
      pendingExpiresAt: schema.users.pendingMagicExpiresAt,
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.pendingMagicToken, magicToken),
        gt(schema.users.pendingMagicExpiresAt, now)
      )
    )
    .limit(1)
  if (rows.length === 0) {
    return { ok: false, reason: "expired_or_unknown" }
  }
  const userId = rows[0].id
  const sessionToken = generateToken()
  await db
    .update(schema.users)
    .set({
      sessionToken,
      sessionTokenCreatedAt: now,
      pendingMagicToken: null,
      pendingMagicExpiresAt: null,
      lastActiveAt: now,
    })
    .where(eq(schema.users.id, userId))
  return { ok: true, sessionToken, userId }
}

export interface ResolvedUser {
  id: string
  email: string
  plan: "trial" | "free" | "active" | "lapsed"
  trialEndsAt: Date
}

/**
 * Look up a user by their session token (sent via Authorization: Bearer).
 * Returns null when token is missing, malformed, or unknown — callers
 * should treat that as anonymous.
 *
 * Also handles the trial→free transition: if a user's plan is "trial"
 * but trial_ends_at has passed, flip them to "free" inline and return
 * the corrected state. Avoids needing a separate cron job for trial
 * expiry — they convert lazily on their next request.
 */
export async function resolveSessionToken(
  authHeader: string | null
): Promise<ResolvedUser | null> {
  if (!authHeader) return null
  const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(authHeader.trim())
  if (!match) return null
  const token = match[1].toLowerCase()

  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      plan: schema.users.plan,
      trialEndsAt: schema.users.trialEndsAt,
    })
    .from(schema.users)
    .where(eq(schema.users.sessionToken, token))
    .limit(1)
  if (rows.length === 0) return null
  const u = rows[0]

  const now = new Date()
  let plan = u.plan
  if (plan === "trial" && u.trialEndsAt <= now) {
    plan = "free"
    await db
      .update(schema.users)
      .set({ plan, lastActiveAt: now })
      .where(eq(schema.users.id, u.id))
  } else {
    // touch last_active_at on every authed request
    await db
      .update(schema.users)
      .set({ lastActiveAt: now })
      .where(eq(schema.users.id, u.id))
  }

  return {
    id: u.id,
    email: u.email,
    plan,
    trialEndsAt: u.trialEndsAt,
  }
}
