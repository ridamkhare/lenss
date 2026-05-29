import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"

export const runtime = "nodejs"

/**
 * DELETE /api/personas/[id] — removes a persona belonging to the
 * authenticated user. Enforced ownership via WHERE user_id AND id.
 */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing persona id." }, { status: 400 })
  }

  const deleted = await db
    .delete(schema.personas)
    .where(
      and(eq(schema.personas.id, id), eq(schema.personas.userId, user.id))
    )
    .returning({ id: schema.personas.id })

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Persona not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
