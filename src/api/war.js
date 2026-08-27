import { shardKey100 } from '../lib/shardKey.js'
import { staticJson } from './staticJson.js'

// Season WAR — MLB Advanced Media's own `stats=sabermetrics` calculation, NOT
// FanGraphs' fWAR or Baseball-Reference's bWAR (see scripts/gen-war.mjs's header
// for how close it tracks fWAR and why it isn't labeled as one). Read from a
// static same-origin file (public/data/war.json), regenerated nightly by
// scripts/gen-war.mjs (see .github/workflows/update-nightly-data.yml) — this
// module just reads it. Keyed by MLB Stats API personId, so callers can index
// straight off a roster entry's person.id. Also carries parallel `wrc` (wRC+)
// and `fld` (season fielding runs) maps, which nothing reads today — they were
// the Lineup Strength grade's inputs and were kept when it was removed because
// they ride along on the one request WAR itself needs
// (`.scratch/lineup-strength/README.md`). `batByTeam`/`pitByTeam` carry that
// same season's WAR split by team stint (`personId -> [{ teamId, war }]`),
// present only for a player with more than one team this season — see
// `warByTeamFor` below.
// Degrades to empty maps before the file exists or on any fetch failure — a
// missing WAR badge, not a broken page. Cached in-memory for the session
// since the file only changes once a day.
export const fetchWarData = staticJson('/data/war.json', {
  fallback: { season: null, bat: {}, pit: {}, batByTeam: {}, pitByTeam: {} },
})

// A traded player's WAR split by team, `teamId -> war`, for THIS season only
// — war.json's `batByTeam`/`pitByTeam` carry no history, so a completed
// season's per-team split isn't available (warByYearFor's history shard has
// no equivalent). Returns null for a player who stayed on one team all
// season (nothing to split) or before the current-season file loads.
export function warByTeamFor(personId, group, current) {
  const key = group === 'pitching' ? 'pitByTeam' : 'batByTeam'
  const rows = current?.[key]?.[personId]
  if (!rows?.length) return null
  return Object.fromEntries(rows.map((r) => [r.teamId, r.war]))
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
