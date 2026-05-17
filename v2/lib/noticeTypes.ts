/**
 * V2 — Notice
 *
 * V2 surfaces exactly ONE additional grounded interaction-dynamic the user
 * may have overlooked in V1's reading. It is a curation layer, not a depth
 * layer. The model is asked to find one specific thing V1 did not say and
 * to anchor it to the actual wording — or to decline.
 */

export interface NoticeResult {
  /**
   * The single grounded interaction-dynamic line. One sentence.
   * Must read like an observation, not a thesis.
   */
  notice: string

  /**
   * Verbatim phrase from the source (2–8 words) that the notice is
   * anchored to. Optional but strongly preferred. Surfaced as a quiet
   * citation under the notice.
   */
  anchor?: string
}

export interface NoticeDeclined {
  declined: true
  reason: string
}

export type NoticeResponse = NoticeResult | NoticeDeclined

export function isNoticeDeclined(r: NoticeResponse): r is NoticeDeclined {
  return "declined" in r && r.declined === true
}

export type NoticeMode = "reveal" | "self" | "compare"

export interface NoticeRequest {
  mode: NoticeMode
  /** Source text. For compare mode, this is passage A. */
  text: string
  /** For compare mode only. */
  textB?: string
  /**
   * The V1 observations already shown to the user. The model uses
   * this to avoid restating what V1 already surfaced.
   */
  v1Observations: string[]
}
