// Rookie status, read from a static same-origin file (public/data/rookies.json)
// rather than computed live. That file is maintained by
// scripts/gen-rookies-backfill.mjs (one-time historical sweep) and kept current
// by scripts/gen-rookies.mjs (nightly cron, appends/closes entries only — see
// .github/workflows/update-nightly-data.yml). This module just reads it. Keyed
// by MLB Stats API personId. Degrades to an empty map before the file exists
// or on any fetch failure — no pill/timeline row, not a broken page. Cached
// in-memory for the session since the file only changes once a day.
let cached = null

export async function fetchRookiesData() {
  if (cached) return cached
  try {
    const res = await fetch('/data/rookies.json')
    if (!res.ok) throw new Error(`rookies.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = { generatedAt: null, players: {} }
  }
  return cached
}

// A player's rookie record — { debutDate, rookieUntil } — or null if he's
// never appeared in the file (undebuted, or off MLB entirely).
export function rookieRecordFor(data, personId) {
  return data?.players?.[personId] ?? null
}

// Still under the rookie limit (130 career at-bats / 50 innings pitched) as of
// the last generator run — `rookieUntil: null` means the record is still open.
export function isActiveRookie(data, personId) {
  return rookieRecordFor(data, personId)?.rookieUntil === null
}
