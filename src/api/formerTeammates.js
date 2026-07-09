// The lineup page's FORMER TEAMMATES card data — for each upcoming MLB matchup,
// the pairs of players on the two OPPOSING clubs who were once teammates (majors
// or minors) — read from a static same-origin file (public/data/former-teammates.json)
// rather than computed live.
//
// Building it is expensive and can't be done spoiler-cheaply on a page load:
// reducing each player's career to its (teamId, season) set needs year-by-year
// stats across MLB and every MiLB level (one request per level), so a single
// matchup is hundreds of requests. Past-season career history is immutable, so
// scripts/gen-former-teammates.mjs precomputes it on a cron (see
// .github/workflows/update-former-teammates.yml) and this module just reads it.
// Same build-time-fetch pattern as war.js / rehab.js (see docs/data-enrichment.md
// §5). Rosters and team-season history carry no score, so the file is
// spoiler-free like the rest of the lineup-page surfaces.
//
// Degrades to an empty map before the file exists or on any failure — the card
// simply doesn't render. Cached in-memory for the session since the file only
// changes once a day.
let cached = null

export async function loadFormerTeammates() {
  if (cached) return cached
  try {
    const res = await fetch('/data/former-teammates.json')
    if (!res.ok) throw new Error(`former-teammates.json ${res.status}`)
    const data = await res.json()
    cached = { matchups: data.matchups ?? {}, generatedAt: data.generatedAt ?? null }
  } catch {
    cached = { matchups: {}, generatedAt: null }
  }
  return cached
}

// The former-teammate ties for a matchup, as one card per PAIR of players (one
// from each club) — order-independent (`teamIdA`/`teamIdB` in either order
// return the same list), so a shared matchup renders identically no matter
// which side's page asks for it. That symmetry is what keeps the wide spread
// layout (both clubs' pages open at once) from showing the same tie twice
// under two different framings — see TeamInfo.jsx's single, full-width card
// grid.
//
// Sorted by `score` (highest first) — how INTERESTING the connection is, not
// just whether one exists. See scripts/gen-former-teammates.mjs's header for
// the formula (level × recency × games-overlap, corroborating stints, peak
// WAR, a reunion bonus); this module trusts the precomputed number rather than
// re-deriving it, since re-deriving it here would need the same games-played
// and peak-WAR data that's expensive enough to justify the nightly build in
// the first place.
//
// Returns [] when the matchup isn't in the file (MiLB game, or outside the
// build's day window). Each entry:
//   { a: {id, name}, b: {id, name},                      // the two players
//     clubs: [{teamId, teamName, level, seasons:[…]}],    // shared club(s)
//     score: number }
export function formerTeammatePairs(data, teamIdA, teamIdB) {
  if (!teamIdA || !teamIdB) return []
  const key = teamIdA < teamIdB ? `${teamIdA}-${teamIdB}` : `${teamIdB}-${teamIdA}`
  const entry = data?.matchups?.[key]
  const rows = entry?.rows
  if (!Array.isArray(rows)) return []

  // Defensive de-dupe: the generator already emits one row per unique pair,
  // but a pair key guards against the file ever carrying a duplicate.
  const seen = new Set()
  const pairs = []
  for (const row of rows) {
    if (!row.a?.id || !row.b?.id) continue
    const pairKey = row.a.id < row.b.id ? `${row.a.id}-${row.b.id}` : `${row.b.id}-${row.a.id}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)
    const clubs = [...(row.shared ?? [])].sort(
      (x, y) =>
        LEVEL_RANK(y.level) - LEVEL_RANK(x.level) ||
        Math.max(...y.seasons) - Math.max(...x.seasons),
    )
    pairs.push({ a: row.a, b: row.b, clubs, score: row.score ?? 0 })
  }

  return pairs.sort((x, y) => y.score - x.score)
}

const LEVEL_ORDER = { MLB: 5, AAA: 4, AA: 3, 'A+': 2, A: 1 }
const LEVEL_RANK = (label) => LEVEL_ORDER[label] ?? 0

// A cluster of pairs is worth collapsing into one "hub and spokes" card only
// when it's a REAL reunion, not the kind of incidental overlap that blew up
// the first attempt at this (a single low-level stint chaining dozens of
// unrelated players together). Three independent gates, all required:
//   - level floor: only an AA-or-better stint can anchor a group (kills the
//     Rookie/A-ball chains outright — that's where the explosion came from)
//   - a real hub: one specific player ties to ≥3 others via that SAME
//     (team, season) — hub-and-spokes only, never a many-to-many blob
//   - a per-pair floor: every spoke must individually clear a minimum score,
//     so a weak/incidental tie doesn't ride along just because it shares the
//     cluster key
const GROUP_LEVEL_FLOOR = LEVEL_RANK('AA')
const GROUP_MIN_SPOKES = 3
const GROUP_SCORE_FLOOR = 25

// Collapses formerTeammatePairs() output into display cards: a plain 1-vs-1
// PAIR card normally, or a GROUP card when a real hub-and-spokes reunion
// clears all three gates above (see GROUP_* constants). Returns cards sorted
// by score (a group's score is its best spoke's score plus a small per-extra-
// member bump, so a big reunion can outrank a merely-good single pair without
// letting group size alone dominate).
//   { kind: 'pair', a, b, clubs, score }
//   { kind: 'group', anchor, mates: [...], club, seasons: [...], score }
export function groupTeammateCards(pairs) {
  if (!pairs || pairs.length === 0) return []

  const byKey = new Map()
  pairs.forEach((p, idx) => {
    const club = p.clubs[0]
    if (!club || LEVEL_RANK(club.level) < GROUP_LEVEL_FLOOR) return
    if (p.score < GROUP_SCORE_FLOOR) return
    for (const [me, other] of [
      [p.a, p.b],
      [p.b, p.a],
    ]) {
      const key = `${me.id}|${club.teamId}`
      if (!byKey.has(key)) {
        byKey.set(key, { anchor: me, club, seasons: new Set(), members: [] })
      }
      const g = byKey.get(key)
      g.members.push({ other, idx, score: p.score })
      for (const s of club.seasons) g.seasons.add(s)
    }
  })

  // Largest clusters claim their pairs first, so a real reunion wins over a
  // smaller/coincidental grouping that shares one of its pairs.
  const candidates = [...byKey.values()].sort((x, y) => y.members.length - x.members.length)
  const consumed = new Set()
  const groupAtIndex = new Map()
  for (const g of candidates) {
    const available = g.members.filter((m) => !consumed.has(m.idx))
    if (available.length < GROUP_MIN_SPOKES) continue
    available.forEach((m) => consumed.add(m.idx))
    groupAtIndex.set(Math.min(...available.map((m) => m.idx)), {
      kind: 'group',
      anchor: g.anchor,
      mates: available.map((m) => m.other),
      club: g.club,
      seasons: [...g.seasons].sort((x, y) => x - y),
      score: Math.max(...available.map((m) => m.score)) + 5 * (available.length - 1),
    })
  }

  const cards = []
  pairs.forEach((p, idx) => {
    if (groupAtIndex.has(idx)) cards.push(groupAtIndex.get(idx))
    else if (!consumed.has(idx)) cards.push({ kind: 'pair', ...p })
  })
  return cards.sort((x, y) => y.score - x.score)
}
