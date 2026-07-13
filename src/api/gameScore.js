// Game Score — the 0.0-10.0 "how exciting was this game" rating, read from a
// static same-origin file (public/data/game-score.json) regenerated every 10
// minutes by scripts/gen-game-score.mjs (see
// .github/workflows/update-game-score.yml) — this module just reads it. Keyed
// by gamePk. See docs/game-score.md for the formula and ADR-0015 for why this
// one number is allowed to render outside a SealBox. Degrades to an empty map
// before the file exists or on any fetch failure — a missing badge, not a
// broken slate. Cached in-memory for the session; the file only grows a
// little every ~10 minutes, so a stale in-session read just means a
// just-Finaled game's score shows up on the next full page load.
let cached = null

export async function fetchGameScores() {
  if (cached) return cached
  try {
    const res = await fetch('/data/game-score.json')
    if (!res.ok) throw new Error(`game-score.json ${res.status}`)
    const json = await res.json()
    cached = json.scores ?? {}
  } catch {
    cached = {}
  }
  return cached
}

// A single game's score, formatted to one decimal ("7.5"), or null when this
// gamePk hasn't been scored yet (too recent, or never had a live feed).
export function gameScoreFor(scores, gamePk) {
  const v = scores?.[gamePk]
  return typeof v === 'number' ? v.toFixed(1) : null
}
