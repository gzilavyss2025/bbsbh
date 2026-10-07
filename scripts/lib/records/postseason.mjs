// The postseason-only half of scripts/gen-postseason-records.mjs: which games
// to ingest, the facts a postseason row carries beyond a regular-season one, and
// how a season's rows become the one file the app reads. Nothing here reaches
// the network, so test/postseason-records.test.js can drive all of it.
//
// A postseason row is a regular-season row (scripts/lib/records/ingest.mjs's
// `shipRow`) so the app's situational-record predicates read both unchanged.
// Three things differ, and each has a reason:
//
//   1. SERIES are tagged from the games actually played, not from the
//      schedule's `gamesInSeries`. That number is the best-of-N the series was
//      SCHEDULED for; a sweep in a best-of-seven leaves it describing games that
//      never happened. A series here is one club's games against one opponent in
//      one round, so its length is how many were played and its finale is the
//      game that ended it.
//   2. No getaway day and no division rank. Both are regular-season ideas
//      (a club "leaves" a park; a division race has days) and neither means
//      anything across a short series.
//   3. A game's `pk` (its gamePk) and `gt` (the round: F, D, L, W), so a game
//      list can name the exact game, and a per-season `abbrs` map (club id to
//      the abbreviation the schedule gave it THAT season), so the list can
//      spell the box-score address the way the schedule of that date does —
//      FLA, not today's MIA, for a 2003 game. Today's teams.json would not.
//   4. An `il` flag — the opponent sat in the other league, which is the World
//      Series and nothing else. Read off the league each club belonged to THAT
//      season (the schedule's own `team.league`), because a club can change
//      leagues (Houston, 2013) and today's teams.json would call 2005 wrong.
import { isPlayedFinal } from '../team-records.mjs'
import { shipRow } from './ingest.mjs'

// The round list and `scopeOfGameType` live in game-types.mjs (see its header).
export { POSTSEASON_GAME_TYPES, scopeOfGameType } from './game-types.mjs'
// The Wild Card era. Earlier postseasons have no Division Series and thinner
// box scores; the page's depth is a decision (see the PR), not a data limit.
export const FIRST_SEASON = 1995

// `--seasons=2026`, `--seasons=1995-2025`, or a comma list of either.
export function parseSeasons(value, fallback) {
  if (value == null || value === true) return [fallback]
  const out = new Set()
  for (const part of String(value).split(',')) {
    const m = /^(\d{4})(?:-(\d{4}))?$/.exec(part.trim())
    if (!m) throw new Error(`--seasons: cannot read "${part}" (use 2026, 1995-2025, or a comma list)`)
    const from = Number(m[1])
    const to = Number(m[2] ?? m[1])
    if (to < from || from < FIRST_SEASON) {
      throw new Error(`--seasons: ${part} is outside ${FIRST_SEASON} and later`)
    }
    for (let y = from; y <= to; y++) out.add(y)
  }
  return [...out].sort((a, b) => a - b)
}

// The played, not-yet-ingested games on one season's schedule. A rained-out
// game reads "Final" too and carries no linescore, so isPlayedFinal drops it.
export function postseasonCandidates(slate, existing) {
  const out = []
  for (const g of (slate?.dates ?? []).flatMap((d) => d.games ?? [])) {
    if (!isPlayedFinal(g)) continue
    if (existing.has(String(g.gamePk))) continue
    if (!g.teams?.away?.team?.id || !g.teams?.home?.team?.id) continue
    out.push({ game: g, sportId: 1, date: g.officialDate ?? (g.gameDate ?? '').slice(0, 10) })
  }
  return out
}

// The facts a postseason row adds to the two rows `rowsForGame` built. Facts,
// not flags: the series tags and `il` are derived at export, from these.
export function addPostseasonFacts(rows, game) {
  const leagueOf = (side) => game.teams?.[side]?.team?.league?.id ?? null
  const abbrOf = (side) => game.teams?.[side]?.team?.abbreviation ?? null
  const [away, home] = rows
  const shared = {
    gameType: game.gameType ?? null,
    seriesGameNumber: Number(game.seriesGameNumber) || null,
  }
  Object.assign(away.payload, shared, {
    leagueId: leagueOf('away'), oppLeagueId: leagueOf('home'), abbr: abbrOf('away'), oppAbbr: abbrOf('home'),
  })
  Object.assign(home.payload, shared, {
    leagueId: leagueOf('home'), oppLeagueId: leagueOf('away'), abbr: abbrOf('home'), oppAbbr: abbrOf('away'),
  })
  return rows
}

// Tags one club's date-ordered rows with the series each belongs to. Mutates
// nothing; returns new rows carrying the keys `shipRow` reads
// (seriesGame / seriesLength / seriesOpener / seriesFinale).
export function tagPostseasonSeries(rows) {
  const keyOf = (r) => `${r.opp_id}:${r.payload.gameType ?? ''}`
  const played = new Map()
  const order = new Map()
  const seriesGame = rows.map((r) => {
    const key = keyOf(r)
    const n = (order.get(key) ?? 0) + 1
    order.set(key, n)
    // The feed's own game number wins; the running count covers a feed without
    // one. Either way it is the game's place in the series, 1-based.
    const game = r.payload.seriesGameNumber ?? n
    played.set(key, Math.max(played.get(key) ?? 0, game))
    return game
  })
  return rows.map((r, i) => {
    const length = played.get(keyOf(r))
    return {
      ...r,
      seriesGame: seriesGame[i],
      seriesLength: length,
      seriesOpener: seriesGame[i] === 1,
      seriesFinale: seriesGame[i] === length,
    }
  })
}

// One shipped postseason row: the regular-season row plus `pk`, `gt` and `il`.
export function shipPostseasonRow(r, roles) {
  const row = shipRow(r, false, roles)
  row.pk = r.game_pk
  if (r.payload.gameType) row.gt = r.payload.gameType
  const { leagueId, oppLeagueId } = r.payload
  if (leagueId != null && oppLeagueId != null && leagueId !== oppLeagueId) row.il = 1
  return row
}

// A season's file:
// `{ season, abbrs: { [teamId]: abbr }, clubs: { [teamId]: { teamId, leagueId, games } } }`.
// `raw` is the season's stored rows, `roles` the `storedRoleFacts` map. Clubs
// and games come out in a fixed order so an unchanged season re-exports
// byte-identical.
export function buildSeasonFile(season, raw, roles) {
  const byTeam = new Map()
  for (const r of raw) {
    const row = { ...r, payload: JSON.parse(r.payload_json) }
    if (!byTeam.has(row.team_id)) byTeam.set(row.team_id, [])
    byTeam.get(row.team_id).push(row)
  }
  const clubs = {}
  const abbrs = {}
  for (const teamId of [...byTeam.keys()].sort((a, b) => a - b)) {
    const rows = byTeam.get(teamId).sort(
      (a, b) =>
        (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
        (a.payload.gameNumber ?? 1) - (b.payload.gameNumber ?? 1),
    )
    for (const r of rows) {
      if (r.payload.abbr) abbrs[teamId] = r.payload.abbr
      if (r.payload.oppAbbr && abbrs[r.opp_id] == null) abbrs[r.opp_id] = r.payload.oppAbbr
    }
    clubs[teamId] = {
      teamId,
      leagueId: rows[0].payload.leagueId ?? null,
      games: tagPostseasonSeries(rows).map((t) => shipPostseasonRow(t, roles)),
    }
  }
  return { season, abbrs, clubs }
}
