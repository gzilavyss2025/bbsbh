// The lineup page's FORMER TEAMMATES card data — for each upcoming matchup
// (MLB or MiLB), the pairs of players on the two OPPOSING clubs who were once
// teammates (majors or minors) — read from a static same-origin file
// (public/data/former-teammates/{teamA}-{teamB}.json, ids ascending) rather
// than computed live. ONE FILE PER MATCHUP: a game view wants exactly one, and
// the league-wide file it replaced was ~550 KB for the ~5 KB a game needs. When a
// matchup has no literal teammate pairs, the file instead carries an ORG TIES
// fallback (see orgTiesFor below) — a player whose career passes through the
// opponent's parent org, even without ever sharing a roster with tonight's
// players.
//
// Building it is expensive and can't be done spoiler-cheaply on a page load:
// reducing each player's career to its (teamId, season) set needs year-by-year
// stats across MLB and every MiLB level (one request per level), so a single
// matchup is hundreds of requests. Past-season career history is immutable, so
// scripts/gen-former-teammates.mjs precomputes it on a cron (see
// .github/workflows/update-nightly-data.yml) and this module just reads it.
// Same build-time-fetch pattern as war.js / rehab.js (see docs/data-enrichment.md
// §5). Rosters and team-season history carry no score, so the file is
// spoiler-free like the rest of the lineup-page surfaces.
//
// Degrades to an empty map before the file exists or on any failure — the card
// simply doesn't render, which is also what a matchup outside the build's day
// window does (no shard, a 404, an empty map). Cached in-memory per matchup for
// the session, since the files only change once a day.
const cached = new Map()

// The KEY a matchup is filed under: the two team ids, ascending. Order-
// independent, so both clubs' pages ask for the same file — the same symmetry
// the selectors below rely on.
export function matchupKey(teamIdA, teamIdB) {
  return teamIdA < teamIdB ? `${teamIdA}-${teamIdB}` : `${teamIdB}-${teamIdA}`
}

// Returns the same `{ matchups }` shape the league-wide file had, holding
// this one matchup — so formerTeammatePairs/orgTiesFor below are unchanged
// and still take (data, teamIdA, teamIdB). The run's stamp lives in the
// directory's index.json, not in a shard (#1145).
export async function loadFormerTeammates(teamIdA, teamIdB) {
  if (!teamIdA || !teamIdB) return { matchups: {} }
  const key = matchupKey(teamIdA, teamIdB)
  if (cached.has(key)) return cached.get(key)
  let data = { matchups: {} }
  try {
    const res = await fetch(`/data/former-teammates/${key}.json`)
    if (!res.ok) throw new Error(`former-teammates/${key}.json ${res.status}`)
    const shard = await res.json()
    data = { matchups: { [key]: shard.matchup ?? {} } }
  } catch {
    data = { matchups: {} }
  }
  cached.set(key, data)
  return data
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
// Returns [] when the matchup isn't in the file (outside the build's day
// window, or the matchup's only card is an orgTiesFor fallback). Each entry:
// Each player carries the `teamId` of the club he is on NOW, read from the
// shard's own teamA/teamB. Never infer it from tonight's away/home: the
// generator files a shard under the ascending-id key and its 3-day window lets
// a later game in the other park overwrite it, so `a` can be tonight's HOME
// player (a Division Series flips parks inside that window).
//   { a: {id, name, pos, teamId}, b: {id, name, pos, teamId}, // the two players
//     clubs: [{teamId, teamName, level, seasons:[…]}],    // shared club(s)
//     score: number }
export function formerTeammatePairs(data, teamIdA, teamIdB) {
  if (!teamIdA || !teamIdB) return []
  const entry = data?.matchups?.[matchupKey(teamIdA, teamIdB)]
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
    pairs.push({
      a: { ...row.a, teamId: entry.teamA ?? null },
      b: { ...row.b, teamId: entry.teamB ?? null },
      clubs,
      score: row.score ?? 0,
    })
  }

  return pairs.sort((x, y) => y.score - x.score)
}

// Turns formerTeammatePairs() output into the card's ROWS: one row per shared
// club, the club in the middle and each of tonight's clubs' players on its own
// side (away left, home right). Two kinds:
//   - 'former': the club is one of tonight's two clubs, so the tie only says
//     "he used to play here". The row holds the players who LEFT it, on the
//     side of the club they are on now; the other side is just the count of
//     tonight's players he played with there (`mates`), not a wall of faces.
//   - 'elsewhere': the players met on a THIRD club. A pair that shares a
//     third club and one of tonight's clubs files under the third club only.
//     A pair that shares two third clubs files under its best one (clubs[0]).
// `startingIds` (a Set, optional) marks each starting player and pins a row
// that plays out tonight: an 'elsewhere' row with a PAIR who both start, or
// a 'former' row whose player starts. Each list is sorted pinned-first, then
// by the best pair score in the row.
//
// Returns { former: [...], elsewhere: [...] } of:
//   { kind, club: {teamId, teamName, level}, seasons: [...],
//     away: [player], home: [player],      // player = {id, name, pos, teamId, starting}
//     mates, score, tonight }
export function teammateCrossroads(pairs, awayTeamId, homeTeamId, startingIds) {
  const rows = new Map()
  const starts = (id) => Boolean(startingIds?.has(id))
  const sideOf = (player) =>
    player.teamId === awayTeamId ? 'away' : player.teamId === homeTeamId ? 'home' : null
  const rowFor = (kind, club) => {
    const key = `${kind}|${club.teamId}`
    if (!rows.has(key)) {
      rows.set(key, {
        kind,
        club: { teamId: club.teamId, teamName: club.teamName, level: club.level },
        seasons: new Set(),
        away: new Map(),
        home: new Map(),
        mates: new Set(),
        score: 0,
        tonight: false,
      })
    }
    return rows.get(key)
  }
  const place = (row, player, score) => {
    const side = sideOf(player)
    if (!side) return
    const held = row[side].get(player.id)
    if (!held || held.score < score) row[side].set(player.id, { ...player, starting: starts(player.id), score })
  }

  for (const p of pairs ?? []) {
    const isTonight = (c) => c.teamId === awayTeamId || c.teamId === homeTeamId
    const third = p.clubs.find((c) => !isTonight(c))
    if (third) {
      const row = rowFor('elsewhere', third)
      for (const s of third.seasons) row.seasons.add(s)
      place(row, p.a, p.score)
      place(row, p.b, p.score)
      row.score = Math.max(row.score, p.score)
      if (starts(p.a.id) && starts(p.b.id)) row.tonight = true
      continue
    }
    for (const club of p.clubs) {
      // The player NOT on that club now is the one who left it.
      const [left, stayed] = p.a.teamId === club.teamId ? [p.b, p.a] : [p.a, p.b]
      const row = rowFor('former', club)
      for (const s of club.seasons) row.seasons.add(s)
      place(row, left, p.score)
      row.mates.add(stayed.id)
      row.score = Math.max(row.score, p.score)
      if (starts(left.id)) row.tonight = true
    }
  }

  const bySideScore = (x, y) => Number(y.starting) - Number(x.starting) || y.score - x.score
  const finished = [...rows.values()]
    .map((r) => ({
      ...r,
      seasons: [...r.seasons].sort((x, y) => x - y),
      away: [...r.away.values()].sort(bySideScore),
      home: [...r.home.values()].sort(bySideScore),
      mates: r.mates.size,
    }))
    .filter((r) => r.away.length + r.home.length > 0)
    .sort((x, y) => Number(y.tonight) - Number(x.tonight) || y.score - x.score)
  return {
    former: finished.filter((r) => r.kind === 'former'),
    elsewhere: finished.filter((r) => r.kind === 'elsewhere'),
  }
}

const LEVEL_ORDER = { MLB: 5, AAA: 4, AA: 3, 'A+': 2, A: 1 }
const LEVEL_RANK = (label) => LEVEL_ORDER[label] ?? 0

// The ORG TIES fallback for a matchup — one-sided notes ("this player has a
// history in the org his tonight's opponent belongs to") for the common case
// where formerTeammatePairs() comes up empty. The generator only ever
// populates ONE of a matchup's `rows`/`orgTies` (see scripts/gen-former-
// teammates.mjs's header), so this and formerTeammatePairs are mutually
// exclusive for a given matchup — a caller renders whichever this returns
// something for, never both.
//
// Order-independent like formerTeammatePairs; each tie already carries its own
// `rosterTeamId`, so the caller doesn't need to know which side was originally
// "away" to attribute a tie to the right club.
//
// Returns [], sorted by `score`, of:
//   { player: {id, name, pos}, rosterTeamId,           // whose roster he's on
//     orgId, orgName,                                  // the OPPONENT's org he ties to
//     teamName, level, seasons: [...] }                // the stint that ties him to it
export function orgTiesFor(data, teamIdA, teamIdB) {
  if (!teamIdA || !teamIdB) return []
  const entry = data?.matchups?.[matchupKey(teamIdA, teamIdB)]
  if (entry?.kind !== 'orgties' || !Array.isArray(entry.orgTies)) return []
  return [...entry.orgTies].sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
}
