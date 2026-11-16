import { staticJson } from '../staticJson.js'

// The weekly Top-100 rank history (#2970): public/data/top-prospects-history.json,
// one dated snapshot per ISO week from fetch-top-prospects.mjs
// (scripts/lib/milb/top100-history.mjs). Open surface: a ranking is not a score.

const fileRead = staticJson('/data/top-prospects-history.json', {
  shape: (d) => (d && Array.isArray(d.snapshots) ? d : null),
  fallback: null,
})

export function fetchTop100History() {
  return fileRead()
}

// A player's weekly ranks, newest first: [{ date, rank }]. Weeks he was off the
// list are left out. Pure.
export function weeklyRanks(history, playerId) {
  const out = []
  for (const s of history?.snapshots ?? []) {
    const rank = s?.ranks?.[playerId]
    if (Number.isFinite(rank)) out.push({ date: s.date, rank })
  }
  return out.reverse()
}
