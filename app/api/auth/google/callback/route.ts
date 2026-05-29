import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { generateToken, normalizeEmail } from "@/lib/auth"

export const runtime = "nodejs"

/**
 * GET /api/auth/google/callback — Google sends the user here after they
 * authorize (or cancel) the OAuth grant.
 *
 * Flow:
 *   1. Validate `state` param matches the CSRF cookie set by /start
 *   2. Exchange the `code` for an access_token (POST to Google token endpoint)
 *   3. Fetch the user's profile (GET to Google userinfo endpoint)
 *   4. Find-or-create a user by email in our DB, mint a session token
 *   5. 302-redirect to /send-check?token=<session_token>, clear state cookie
 */

const STATE_COOKIE = "lenss_oauth_state"

function baseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("host") || "lenss.one"
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1")
  return isLocal ? `http://${host}` : `${proto}://${host}`
}

function failRedirect(req: NextRequest, error: string): NextResponse {
  const url = new URL("/send-check", baseUrl(req))
  url.searchParams.set("activation_error", error)
  const res = NextResponse.redirect(url.toString())
  res.cookies.delete(STATE_COOKIE)
  return res
}

interface GoogleUserInfo {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  // User canceled or Google returned an error
  if (errorParam) {
    return failRedirect(req, "google_cancelled")
  }
  if (!code || !state) {
    return failRedirect(req, "missing_params")
  }

  // Validate state against cookie (CSRF protection)
  const stateCookie = req.cookies.get(STATE_COOKIE)?.value
  if (!stateCookie || stateCookie !== state) {
    return failRedirect(req, "state_mismatch")
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return failRedirect(req, "oauth_misconfigured")
  }

  const redirectUri = `${baseUrl(req)}/api/auth/google/callback`

  // 1. Exchange code for access_token
  let accessToken: string
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })
    if (!tokenRes.ok) {
      console.error("[google-oauth] token exchange failed:", tokenRes.status)
      return failRedirect(req, "token_exchange_failed")
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string }
    if (!tokenJson.access_token) {
      return failRedirect(req, "no_access_token")
    }
    accessToken = tokenJson.access_token
  } catch (err) {
    console.error("[google-oauth] token exchange error:", err)
    return failRedirect(req, "token_exchange_error")
  }

  // 2. Fetch user info
  let userInfo: GoogleUserInfo
  try {
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!profileRes.ok) {
      return failRedirect(req, "userinfo_failed")
    }
    userInfo = (await profileRes.json()) as GoogleUserInfo
  } catch (err) {
    console.error("[google-oauth] userinfo error:", err)
    return failRedirect(req, "userinfo_error")
  }

  if (!userInfo.email) {
    return failRedirect(req, "no_email")
  }
  // Only trust verified emails — prevents account-takeover via unverified
  // Google account claiming someone else's email
  if (userInfo.email_verified === false) {
    return failRedirect(req, "email_not_verified")
  }

  const email = normalizeEmail(userInfo.email)
  const sessionToken = generateToken()
  const now = new Date()

  // 3. Find or create user
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)

  if (existing.length > 0) {
    // Existing user: update their session token (replaces any previous device session)
    await db
      .update(schema.users)
      .set({
        sessionToken,
        sessionTokenCreatedAt: now,
        pendingMagicToken: null,
        pendingMagicExpiresAt: null,
        lastActiveAt: now,
      })
      .where(eq(schema.users.id, existing[0].id))
  } else {
    // New user: create with default free plan + immediate session
    await db.insert(schema.users).values({
      email,
      sessionToken,
      sessionTokenCreatedAt: now,
      lastActiveAt: now,
      // plan defaults to "free" (schema). Trial is opt-in from /account.
    })
  }

  // 4. Redirect to /send-check with session token in URL — page handler will
  //    save to localStorage and strip the param
  const dest = new URL("/send-check", baseUrl(req))
  dest.searchParams.set("token", sessionToken)
  const res = NextResponse.redirect(dest.toString())
  res.cookies.delete(STATE_COOKIE)
  return res
}
