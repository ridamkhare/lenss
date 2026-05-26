/**
 * Stable redirect to the Chrome Web Store listing for the Lenss
 * companion extension. The footer link points at `/extension`, not
 * directly at the CWS URL, so future store-URL changes are a single
 * env-var edit, not a content edit.
 *
 * Strict-isolation note: this is the ONE intentional surface where
 * lenss.one acknowledges the extension exists — a one-way discovery
 * link, no shared code, no runtime coupling. The extension never
 * calls back into lenss.one.
 *
 * Behavior:
 *   - When NEXT_PUBLIC_EXTENSION_CWS_URL is set, 302-redirect to it.
 *   - When unset, return 404 so a misconfigured deploy fails loudly
 *     instead of silently sending users to a broken URL. The footer
 *     link is also hidden in that case, so this 404 only ever fires
 *     for someone hand-typing /extension.
 */

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  const url = process.env.NEXT_PUBLIC_EXTENSION_CWS_URL
  if (!url) {
    return new NextResponse("Extension listing not yet configured.", {
      status: 404,
    })
  }
  return NextResponse.redirect(url, 302)
}
