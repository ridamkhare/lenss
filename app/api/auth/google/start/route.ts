import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"

export const runtime = "nodejs"

/**
 * GET /api/auth/google/start — kicks off the Google OAuth flow.
 *
 * Generates a CSRF-protection `state` (random hex string), stores it in a
 * short-lived httpOnly cookie, then 302-redirects the user to Google's
 * authorization endpoint with our client_id and the redirect URI for this
 * environment.
 *
 * Google will redirect the user back to /api/auth/google/callback with the
 * same state param + an auth code. The callback verifies the state matches
 * the cookie, exchanges the code for user info, and mints a session.
 */

const STATE_COOKIE = "lenss_oauth_state"
const STATE_TTL_SECONDS = 10 * 60 // 10 minutes — Google flows usually complete in <1 min

function baseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("host") || "lenss.one"
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1")
  return isLocal ? `http://${host}` : `${proto}://${host}`
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "Google sign-in isn't configured." },
      { status: 503 }
    )
  }

  const state = randomBytes(32).toString("hex")
  const redirectUri = `${baseUrl(req)}/api/auth/google/callback`

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", "openid email profile")
  authUrl.searchParams.set("state", state)
  // access_type=online — we don't need offline refresh tokens, just one-shot auth
  authUrl.searchParams.set("access_type", "online")
  // prompt=select_account — lets users pick which Google account, useful for
  // people with personal + work emails
  authUrl.searchParams.set("prompt", "select_account")

  const res = NextResponse.redirect(authUrl.toString())
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // lax so the cookie travels back on Google's redirect
    maxAge: STATE_TTL_SECONDS,
    path: "/",
  })
  return res
}
