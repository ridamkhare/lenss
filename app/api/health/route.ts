import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Read-only health/diagnostic endpoint. Exposes no secrets — only the
 * configured model identifiers (which are not sensitive) and booleans
 * indicating whether the required environment variables are set.
 *
 * Hit https://lenss.one/api/health any time to verify what's actually
 * running in production.
 */
export async function GET() {
  const openrouterModel =
    process.env.OPENROUTER_MODEL || "(default: anthropic/claude-sonnet-4.5)"
  const openrouterSelfModel =
    process.env.OPENROUTER_SELF_MODEL || openrouterModel

  return NextResponse.json({
    status: "ok",
    models: {
      read_and_compare: openrouterModel,
      yours: openrouterSelfModel,
    },
    env: {
      openrouter_api_key_set: !!process.env.OPENROUTER_API_KEY,
      anthropic_api_key_set: !!process.env.ANTHROPIC_API_KEY,
      clarity_id_set: !!process.env.NEXT_PUBLIC_CLARITY_ID,
      ga_id_set: !!process.env.NEXT_PUBLIC_GA_ID,
    },
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      region: process.env.VERCEL_REGION || null,
    },
  })
}
