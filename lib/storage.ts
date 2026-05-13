import type {
  CompareResult,
  RevealResult,
  SelfReadingResult,
} from "./types"

/**
 * Local-only archive of saved readings. Lives in localStorage on the
 * user's device and never leaves it.
 */

export type SavedRevealItem = {
  id: string
  createdAt: string
  mode: "reveal"
  source: string
  result: RevealResult
}

export type SavedCompareItem = {
  id: string
  createdAt: string
  mode: "compare"
  sourceA: string
  sourceB: string
  result: CompareResult
}

export type SavedSelfItem = {
  id: string
  createdAt: string
  mode: "self"
  source: string
  result: SelfReadingResult
}

export type SavedItem = SavedRevealItem | SavedCompareItem | SavedSelfItem

const ARCHIVE_KEY = "lens:archive"
const COMPARE_PREFILL_KEY = "lens:compare:prefill"

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

function readArchive(): SavedItem[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedItem[]) : []
  } catch {
    return []
  }
}

function writeArchive(items: SavedItem[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(items))
  } catch {
    // quota exceeded — silent failure is acceptable for prototype
  }
}

function newId(): string {
  if (isBrowser() && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function saveReveal(source: string, result: RevealResult): SavedItem {
  const item: SavedItem = {
    id: newId(),
    createdAt: new Date().toISOString(),
    mode: "reveal",
    source,
    result,
  }
  const items = readArchive()
  items.unshift(item)
  writeArchive(items)
  return item
}

export function saveCompare(
  sourceA: string,
  sourceB: string,
  result: CompareResult
): SavedItem {
  const item: SavedItem = {
    id: newId(),
    createdAt: new Date().toISOString(),
    mode: "compare",
    sourceA,
    sourceB,
    result,
  }
  const items = readArchive()
  items.unshift(item)
  writeArchive(items)
  return item
}

export function saveSelf(
  source: string,
  result: SelfReadingResult
): SavedItem {
  const item: SavedItem = {
    id: newId(),
    createdAt: new Date().toISOString(),
    mode: "self",
    source,
    result,
  }
  const items = readArchive()
  items.unshift(item)
  writeArchive(items)
  return item
}

export function listItems(): SavedItem[] {
  return readArchive()
}

export function deleteItem(id: string): void {
  const items = readArchive().filter((i) => i.id !== id)
  writeArchive(items)
}

export function clearArchive(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(ARCHIVE_KEY)
}

/* Short-lived prefill for compare mode — when the user clicks
   "Compare with another" on an archived item, the source is held
   in sessionStorage and read once by /compare on mount. */

export function setComparePrefill(text: string): void {
  if (!isBrowser()) return
  try {
    window.sessionStorage.setItem(COMPARE_PREFILL_KEY, text)
  } catch {
    /* ignore */
  }
}

export function takeComparePrefill(): string | null {
  if (!isBrowser()) return null
  try {
    const v = window.sessionStorage.getItem(COMPARE_PREFILL_KEY)
    if (v) window.sessionStorage.removeItem(COMPARE_PREFILL_KEY)
    return v
  } catch {
    return null
  }
}
