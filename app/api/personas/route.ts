import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq, desc, count } from "drizzle-orm"

export const runtime = "nodejs"

/**
 * GET  /api/personas — list current user's saved personas (newest first)
 * POST /api/personas — save a new persona { label, context }
 *
 * DELETE /api/personas/[id] lives in its own route file.
 *
 * Caps: free = 3, pro = 30. Enforced on POST.
 */

const FREE_CAP = 3
const PRO_CAP = 30

const ARCHETYPE_RE = /^[a-zA-Z][a-zA-Z0-9 \-']{0,29}$/
const MAX_CONTEXT = 200

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
} as const

function normalizeLabel(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, " ")
  return ARCHETYPE_RE.test(trimmed) ? trimmed : null
}

export async function GET(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }
  const user = await resolveSessionToken(req.headers.get("authorization"))
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  }

  const rows = await db
    .select({
      id: schema.personas.id,
      label: schema.personas.label,
      context: schema.personas.context,
      createdAt: schema.personas.createdAt,
    })
    .from(schema.personas)
    .where(eq(schema.personas.userId, user.id))
    .orderBy(desc(schema.personas.createdAt))

  const isPro = user.plan === "trial" || user.plan === "active"
  return NextResponse.json(
    {
      personas: rows.map((r) => ({
        id: r.id,
        label: r.label,
        context: r.context,
        created_at: r.createdAt.toISOString(),
      })),
      cap: isPro ? PRO_CAP : FREE_CAP,
    },
    { headers: NO_CACHE_HEADERS }
  )
}

export async function POST(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }
  const user = await resolveSessionToken(req.headers.get("authorization"))
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const label = typeof body?.label === "string" ? normalizeLabel(body.label) : null
  const context =
    typeof body?.context === "string"
      ? body.context.trim().slice(0, MAX_CONTEXT) || null
      : null

  if (!label) {
    return NextResponse.json(
      { error: "Persona name needs to start with a letter, 1–30 chars, letters/numbers/spaces/hyphens." },
      { status: 400 }
    )
  }

  const isPro = user.plan === "trial" || user.plan === "active"
  const cap = isPro ? PRO_CAP : FREE_CAP

  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.personas)
    .where(eq(schema.personas.userId, user.id))

  if (Number(n) >= cap) {
    return NextResponse.json(
      {
        error: isPro
          ? `You've hit the ${cap}-persona cap. Delete one to add another.`
          : `Free plan keeps ${cap} saved personas. Upgrade to Pro for ${PRO_CAP}, or delete one to make room.`,
      },
      { status: 400 }
    )
  }

  try {
    const inserted = await db
      .insert(schema.personas)
      .values({ userId: user.id, label, context })
      .returning({
        id: schema.personas.id,
        label: schema.personas.label,
        context: schema.personas.context,
        createdAt: schema.personas.createdAt,
      })
    const r = inserted[0]
    return NextResponse.json({
      persona: {
        id: r.id,
        label: r.label,
        context: r.context,
        created_at: r.createdAt.toISOString(),
      },
    })
  } catch (err) {
    // Unique-violation on (user_id, label) most likely
    const msg = String(err)
    if (msg.includes("personas_user_label_unique")) {
      return NextResponse.json(
        { error: `You already have a persona named "${label}". Pick a different name or delete the existing one.` },
        { status: 409 }
      )
    }
    console.error("[personas] insert failed:", err)
    return NextResponse.json(
      { error: "Couldn't save that persona. Try again." },
      { status: 500 }
    )
  }
}
