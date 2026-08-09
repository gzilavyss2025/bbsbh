import { shardKey100 } from '../lib/shardKey.js'

// Season WAR, read from a static same-origin file (public/data/war.json)
// rather than fetched live from FanGraphs. That file is regenerated nightly
// by scripts/gen-war.mjs (see .github/workflows/update-nightly-data.yml) — this module
// just reads it. Keyed by MLB Stats API personId (FanGraphs' xMLBAMID is the
// same id), so callers can index straight off a roster entry's person.id. Also
// carries parallel `pa` (hitter plate appearances), `wrc` (wRC+) and `fld`
// (season fielding runs) maps, which nothing reads today — they were the Lineup
// Strength grade's inputs and were kept when it was removed because they ride
// along on the one FanGraphs request WAR itself needs
// (`.scratch/lineup-strength/README.md`).
// Degrades to empty maps before the file exists or on any fetch failure — a
// missing WAR badge, not a broken page. Cached in-memory for the session
// since the file only changes once a day.
let cached = null

export async function fetchWarData() {
  if (cached) return cached
  try {
    const res = await fetch('/data/war.json')
    if (!res.ok) throw new Error(`war.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = { season: null, bat: {}, pit: {}, pa: {} }
  }
  return cached
}

// Season WAR for COMPLETED seasons — the multi-year companion to war.json above,
// keyed by PLAYER: { bat: { [personId]: {season: war} }, pit }.
// Hand-generated (scripts/gen-war-history.mjs), not on the nightly cron, since a
// finished season's WAR never changes. Degrades to empty like the current-season
// file.
//
// Sharded on `personId % 100`, the same bucketing rookies.js uses (and for the
// same reason — see src/lib/shardKey.js): a player page wants ONE career's
// worth, at most a couple of dozen numbers, out of 416 KB of league-seasons.
export const warShardKey = shardKey100

const historyShards = new Map() // shard key -> { bat, pit }

export async function fetchWarHistory(personId) {
  const key = warShardKey(personId)
  if (!historyShards.has(key)) {
    historyShards.set(
      key,
      fetch(`/data/war-history/${key}.json`)
        .then((r) => (r.ok ? r.json() : { bat: {}, pit: {} }))
        .catch(() => ({ bat: {}, pit: {} })),
    )
  }
  return historyShards.get(key)
}

// A single player's WAR by season for one group — a { [season]: number } map
// unioning the live-season file (current, still-moving season) with his history
// shard (every completed season). The live file wins for its own season. Group
// picks bat vs pit WAR (a two-way player has both). MLB-only at the source, so a
// season the player spent entirely in the minors simply won't have a key.
export function warByYearFor(personId, group, current, history) {
  const key = group === 'pitching' ? 'pit' : 'bat'
  const out = { ...(history?.[key]?.[personId] ?? {}) }
  if (current?.season != null) {
    const w = current[key]?.[personId]
    if (w != null) out[current.season] = w
  }
  return out
}
