/**
 * Layer 2 of the refusal system: cheap, deterministic shape detection.
 *
 * Inputs the user pastes are often *obviously* not interpretively shaped —
 * code blocks, computations, bullet lists, single-sentence questions,
 * one-line greetings. We can catch these without a model call, which is
 * faster, free, and lets us write a more specific refusal message than
 * the model would.
 *
 * Returns `null` if the input passes; `{ reason }` if it should be refused.
 */

export interface HeuristicRefusal {
  reason: string
}

export function detectShape(text: string): HeuristicRefusal | null {
  if (looksLikeCode(text)) {
    return { reason: "This reads as code. The instrument is built for prose." }
  }
  if (looksLikeComputation(text)) {
    return { reason: "This is a computation. There isn't a frame to surface." }
  }
  if (looksLikeListOfFacts(text)) {
    return {
      reason: "This is a list. There isn't prose here to read the shape of.",
    }
  }
  if (looksLikeSingleQuestion(text)) {
    return { reason: "This is a question, not an answer." }
  }
  if (looksLikeGreeting(text)) {
    return { reason: "This is a greeting. There's nothing here to interpret." }
  }
  return null
}

/**
 * Jaccard similarity over lowercased word sets. Used by compare mode to
 * detect near-paraphrases (the case where the most trust-building refusal
 * is: "These are close enough that the difference is in the words, not
 * the shape.")
 */
export function wordSetSimilarity(a: string, b: string): number {
  const wordsA = new Set((a.toLowerCase().match(/[a-z][a-z']+/g) || []).filter((w) => w.length > 2))
  const wordsB = new Set((b.toLowerCase().match(/[a-z][a-z']+/g) || []).filter((w) => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let inter = 0
  for (const w of wordsA) if (wordsB.has(w)) inter++
  const union = wordsA.size + wordsB.size - inter
  return union === 0 ? 0 : inter / union
}

/* ────────────────────────────────────────────────────────────────────
   Detectors
   ──────────────────────────────────────────────────────────────────── */

function looksLikeCode(text: string): boolean {
  const codeTokens: RegExp[] = [
    /\bfunction\s+\w+\s*\(/,
    /\bclass\s+\w+[\s({]/,
    /\bimport\s+[\w{}*,\s]+\s+from\b/,
    /\b(const|let|var)\s+\w+\s*=/,
    /\bdef\s+\w+\s*\(/,
    /\b(public|private|protected)\s+\w+/,
    /=>\s*[{(]/,
    /console\.log\s*\(/,
    /<\/?[a-z][\w-]*[^>]*>/i,
    /\b(if|else|while|for)\s*\(/,
    /^\s*(\/\/|#)\s+\w/m, // // or # comment lines
    /\breturn\s+[^\s]/,
  ]
  const hits = codeTokens.filter((p) => p.test(text)).length
  if (hits >= 2) return true

  const codePuncts = (text.match(/[{}()[\];<>=]/g) || []).length
  const total = text.length
  if (total > 30 && codePuncts / total > 0.12) return true

  return false
}

function looksLikeComputation(text: string): boolean {
  const trimmed = text.trim()
  if (/^[\d\s+\-*/=().,!^%]+$/.test(trimmed)) return true
  const arith = (text.match(/[\d+\-*/=]/g) || []).length
  const nonSpace = text.replace(/\s/g, "").length
  if (nonSpace > 20 && arith / nonSpace > 0.4) return true
  return false
}

function looksLikeListOfFacts(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) return false
  const bulletLines = lines.filter((l) =>
    /^([-*•·]|\d+[.)])\s/.test(l)
  ).length
  if (bulletLines < 3) return false

  const proseChars = lines
    .filter((l) => !/^([-*•·]|\d+[.)])\s/.test(l))
    .join(" ")
    .length
  return proseChars < 200
}

function looksLikeSingleQuestion(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.endsWith("?")) return false
  const terminal = (trimmed.match(/[.!?]/g) || []).length
  if (terminal !== 1) return false
  const words = trimmed.split(/\s+/).filter(Boolean).length
  return words < 20
}

function looksLikeGreeting(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length > 80) return false
  if (t.split("\n").length > 1) return false
  return /^(hi|hello|hey|good (?:morning|afternoon|evening)|thanks?|thank you|cheers|yo|sup|howdy)[\s,.!?]*$/.test(
    t
  )
}
