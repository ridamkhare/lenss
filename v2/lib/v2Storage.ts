/**
 * V2 sidecar storage.
 *
 * V2 notices are stored under their own localStorage key, keyed by the
 * V1 archive item id. V1's storage layer is never touched — V2 writes
 * alongside it. If a V1 item is deleted from V1's archive, the V2
 * sidecar entry becomes orphaned but causes no failure on read
 * (orphans are filtered out at render time).
 */

import type { NoticeMode } from "@/v2/lib/noticeTypes"

export interface SavedV2Notice {
  /** Matches the V1 SavedItem.id. */
  id: string
  /** ISO timestamp of when V2 ran. */
  createdAt: string
  /** Which V1 mode this notice was produced under. */
  mode: NoticeMode
  /** The single grounded sentence shown to the user. */
  notice: string
  /** Verbatim anchor phrase, if present. */
  anchor?: string
}

const V2_ARCHIVE_KEY = "lens:v2:archive"

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

function readAll(): Record<string, SavedV2Notice> {
  if (!isBrowser()) return {}
  try {
    const raw = window.localStorage.getItem(V2_ARCHIVE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, SavedV2Notice>
    }
    return {}
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, SavedV2Notice>): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(V2_ARCHIVE_KEY, JSON.stringify(map))
  } catch {
    /* quota — silent, same posture as V1 */
  }
}

export function saveV2Notice(args: {
  v1ItemId: string
  mode: NoticeMode
  notice: string
  anchor?: string
}): void {
  if (!isBrowser()) return
  const map = readAll()
  map[args.v1ItemId] = {
    id: args.v1ItemId,
    createdAt: new Date().toISOString(),
    mode: args.mode,
    notice: args.notice,
    anchor: args.anchor,
  }
  writeAll(map)
}

export function getV2Notice(v1ItemId: string): SavedV2Notice | null {
  const map = readAll()
  return map[v1ItemId] ?? null
}

export function listV2Notices(): Record<string, SavedV2Notice> {
  return readAll()
}

export function deleteV2Notice(v1ItemId: string): void {
  if (!isBrowser()) return
  const map = readAll()
  if (v1ItemId in map) {
    delete map[v1ItemId]
    writeAll(map)
  }
}

export function clearV2Archive(): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(V2_ARCHIVE_KEY)
  } catch {
    /* ignore */
  }
}
