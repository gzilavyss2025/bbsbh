// What each club actually wore in a given game, read from a static
// same-origin file (public/data/jerseys.json) rather than the live uniforms
// endpoint. That file is regenerated nightly by scripts/gen-jerseys.mjs (see
// .github/workflows/update-nightly-data.yml) — this module just reads it.
// Keyed `${gamePk}:${teamId}` -> 'alternate' | 'city-connect'; a standard
// home/away jersey or a game whose assignment hasn't posted yet simply has no
// key. Degrades to an empty object before the file exists or on any fetch
// failure — a missed logo swap, never a broken page. Cached in-memory for the
// session since the file only changes once a day.
let cached = null

export async function fetchJerseysData() {
  if (cached) return cached
  try {
    const res = await fetch('/data/jerseys.json')
    if (!res.ok) throw new Error(`jerseys.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = {}
  }
  return cached
}

// 'alternate' | 'city-connect' | null — null covers a standard jersey, an
// unposted assignment, and a missing/failed fetch alike, so callers can treat
// it as "just show the base logo" without distinguishing why.
export function jerseyTreatmentFor(data, gamePk, teamId) {
  if (!gamePk || !teamId) return null
  return data?.[`${gamePk}:${teamId}`] ?? null
}
