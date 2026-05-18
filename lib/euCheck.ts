/**
 * Geofence helper for logging.
 *
 * Vercel attaches `x-vercel-ip-country` to every request at the edge.
 * We use it to short-circuit interaction logging for any traffic
 * originating in the GDPR / UK GDPR / Swiss FADP regions — these are
 * the regulatory regimes whose enforcement around logging user-pasted
 * content is most aggressive.
 *
 * Imperfect (VPN traffic looks like its exit country, etc.) but the
 * standard industry compromise: country-level good-faith geofencing
 * at the edge.
 */

const GDPR_COUNTRIES = new Set<string>([
  // EU
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
  "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE",
  // EEA (non-EU members)
  "IS", "LI", "NO",
  // UK GDPR + Swiss FADP — same family
  "GB", "CH",
])

export function isGdprRegion(req: Request): boolean {
  const cc = req.headers.get("x-vercel-ip-country")?.toUpperCase()
  return cc !== undefined && cc !== null && GDPR_COUNTRIES.has(cc)
}
