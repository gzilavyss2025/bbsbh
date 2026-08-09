import { shardKey100 } from '../lib/shardKey.js'
import { staticJson, staticJsonBy } from './staticJson.js'

// Rookie status, read from static same-origin files under public/data/rookies/
// rather than computed live. Those files are derived from the append-only
// master record public/data/rookies.json, which
// scripts/gen-rookies-backfill.mjs (one-time historical sweep) establishes and
// scripts/gen-rookies.mjs (nightly cron) keeps current — see
// .github/workflows/update-nightly-data.yml. Keyed by MLB Stats API personId.
//
// TWO FILES, SPLIT BY ROLE, because the two questions asked of this data have
// nothing in common. The master record carries {debutDate, rookieUntil} for
// every player who ever debuted (21,000+ rows, 1.2 MB) — and every game page
// downloaded and parsed the whole thing to draw a pill:
//
//   /data/rookies/status.json         { generatedAt, players: {id: 1 | 0} }
//   /data/rookies/records/{NN}.json   { players: {id: {debutDate, rookieUntil}} }
//
// `status.json` is the compact ANSWER the pills need — 1 = rookie window still
// open, 0 = closed — and nothing else, which is a ~5x smaller file (~260 KB).
// It carries every id, because both pills ask about arbitrary players: any
// personId on either club's roster (showRookiePill) or on a MiLB roster
// (hasDebuted). An id-keyed shard cannot serve that — a game's ~80 scattered
// ids would touch nearly every shard — so the split here is by ROLE, not by id.
//
// The DATES are only ever wanted one player at a time (the player page's
// timeline), so those keep the full record and ARE id-sharded, 100 buckets on
// `personId % 100` (~13 KB each) — see rookieShardKey / fetchRookieRecord.
//
// Every predicate below reads either shape, so a record shard and the status
// map are interchangeable inputs. Degrades to an empty map before the files
// exist or on any fetch failure — no pill/timeline row, not a broken page.
// Cached in-memory for the session since the files only change once a day.
export const fetchRookiesData = staticJson('/data/rookies/status.json', {
  fallback: { generatedAt: null, players: {} },
})

// Which record shard holds a personId. The generator writes the same buckets
// (scripts/lib/rookie-shards.mjs) by importing THIS function, so the two cannot
// disagree — see src/lib/shardKey.js.
export const rookieShardKey = shardKey100

const loadRecordShard = staticJsonBy((key) => `/data/rookies/records/${key}.json`)

// One player's full record — { debutDate, rookieUntil } — or null when he has
// none (undebuted, or off MLB entirely). One ~13 KB shard fetch, session-cached.
export async function fetchRookieRecord(personId) {
  return rookieRecordFor(await loadRecordShard(rookieShardKey(personId)), personId)
}

// 'open' | 'closed' | null (no record at all), reading EITHER shape: a full
// record ({rookieUntil} — null means still open) or status.json's compact
// 1 = open / 0 = closed.
function rookieStatus(data, personId) {
  const v = data?.players?.[personId]
  if (v === undefined || v === null) return null
  if (typeof v === 'object') return v.rookieUntil === null ? 'open' : 'closed'
  return v === 1 ? 'open' : 'closed'
}

// A player's rookie record — { debutDate, rookieUntil } — or null if he's
// never appeared in the file. Meaningful only over a RECORD map (a shard from
// fetchRookieRecord); over status.json it returns the compact 1/0 flag, which
// is what the predicates below read rather than this.
export function rookieRecordFor(data, personId) {
  return data?.players?.[personId] ?? null
}

// Still under the rookie limit (130 career at-bats / 50 innings pitched) as of
// the last generator run.
export function isActiveRookie(data, personId) {
  return rookieStatus(data, personId) === 'open'
}

// Any record at all — open or closed rookie window — means this personId has
// appeared in an MLB game before. The backfill (gen-rookies-backfill.mjs)
// established a debut record for essentially every MLB debut back to 1901,
// not just current rookie candidates, so this doubles as a general "has this
// player debuted" check. Used by DebutPill.
export function hasDebuted(data, personId) {
  return rookieStatus(data, personId) !== null
}

// The ROOKIE pill's actual visibility check. "Still under the rookie limit"
// only reads as meaningful on an MLB roster/lineup — the same debuted,
// still-under-limit player showing up in a MiLB game (rehab assignment,
// optioned veteran) gets DebutPill there instead (see DebutPill.jsx), not a
// second "rookie" claim about a level he's not filling a rookie's role on.
// isMlb is the caller's own MLB-vs-MiLB context flag (see TeamInfo.jsx's
// `isMlb`); the record itself (isActiveRookie) is level-agnostic.
export function showRookiePill(data, personId, isMlb) {
  return !!isMlb && isActiveRookie(data, personId)
}
