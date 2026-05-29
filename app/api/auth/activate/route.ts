import { NextRequest, NextResponse } from "next/server"
import { activateMagicToken } from "@/lib/auth"

export const runtime = "nodejs"

/**
 * Magic link landing endpoint. User clicks the link in their email, which
 * brings them here with ?token=<magic_token>. We validate it, mint a session
 * token, and redirect them to /send-check with the session token as a URL
 * param. The page reads the param on mount, saves to localStorage, and
 * strips it from the URL.
 *
 * Deliberately permissive on CORS — this is a top-level navigation from
 * the user's email client, not an AJAX call. No security gate beyond the
 * magic token itself.
 */

const FALLBACK_URL = "/send-check"

function activateUrlFor(req: NextRequest, sessionToken: string, error?: string): string {
  const params = new URLSearchParams()
  if (sessionToken) params.set("token", sessionToken)
  if (error) params.set("activation_error", error)
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("host") || "lenss.one"
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1")
  const base = isLocal ? `http://${host}` : `${proto}://${host}`
  const qs = params.toString()
  return `${base}${FALLBACK_URL}${qs ? "?" + qs : ""}`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  if (!token) {
    return NextResponse.redirect(activateUrlFor(req, "", "missing_token"))
  }

  const result = await activateMagicToken(token)
  if (!result.ok) {
    return NextResponse.redirect(activateUrlFor(req, "", result.reason))
  }

  return NextResponse.redirect(activateUrlFor(req, result.sessionToken))
}
