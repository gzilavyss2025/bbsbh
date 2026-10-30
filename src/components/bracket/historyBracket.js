// A finished postseason from postseason-history.json, in the live bracket's shape (api/postseason/bracket.js,
// docs/api/postseason.md), so the history page draws each season with the World Series home's FullBracket
// (Gary, 2026-10-30). Every format since 1903 fits it: two Wild Card series a league and two byes (2022 on),
// four best-of-three series (2020), one Wild Card game (2012–2019, 2021), the Division Series first (1995–2011,
// and 1981), the LCS first (1969–1993), and the World Series alone (1903–1968), where `leagues` is null. A
// season in no such shape answers null and keeps the history page's own bracket.
// A finished series carries no score here; `winnerId` per game comes from the file's own scores.
import { teamAbbr, teamFullName } from '../../lib/teams.js'

const LEAGUE = { 103: 'AL', 104: 'NL' }
const BEST_OF = { wildcard: 3, division: 5, lcs: 7, worldseries: 7 }
// A club by the name it had that season (the file's `teams`), else today's.
let then = {}
const club = (id) => (id == null ? null : { id, name: then[id]?.name ?? teamFullName(id), abbreviation: then[id]?.abbreviation ?? teamAbbr({ id }) })

// The lengths that changed: the Wild Card was one game from 2012 through 2021 (save 2020's best of three), the
// LCS best of five through 1984, and the World Series best of nine in 1903 and 1919–1921.
function bestOfIn(round, year) {
  if (round === 'wildcard' && year >= 2012 && year <= 2021 && year !== 2020) return 1
  if (round === 'lcs' && year < 1985) return 5
  if (round === 'worldseries' && (year === 1903 || (year >= 1919 && year <= 1921))) return 9
  return BEST_OF[round]
}

function series(raw, round, year) {
  const bestOf = bestOfIn(round, year)
  const ids = [raw.teamA.teamId, raw.teamB.teamId]
  const wins = { [raw.teamA.teamId]: raw.teamA.wins, [raw.teamB.teamId]: raw.teamB.wins }
  const loserId = ids.find((id) => id !== raw.winnerTeamId)
  const games = (raw.games ?? []).map((g) => ({
    gamePk: g.gamePk,
    gameNumber: g.gameNumber,
    date: g.date,
    winnerId: g.awayScore === g.homeScore ? null : g.awayScore > g.homeScore ? g.awayTeamId : g.homeTeamId, // a tie: 1907, 1912, 1922
  }))
  return {
    key: raw.id,
    id: raw.id,
    round,
    league: LEAGUE[raw.leagueId] ?? null,
    name: raw.label,
    label: raw.label,
    bestOf,
    winsNeeded: Math.floor(bestOf / 2) + 1,
    // Game 1's away club, then its home club; the feeders below re-order the later rounds.
    slots: ids.map((id) => ({ club: club(id), wins: wins[id] ?? 0, from: null, bye: false })),
    gamesPlayed: raw.gamesPlayed ?? games.length,
    decided: true,
    winner: club(raw.winnerTeamId),
    eliminated: club(loserId),
    playsOnCutoff: false,
    cutoffGame: null,
    feeds: null,
    games,
    upcoming: [],
  }
}

// Each slot of `next` names the series its club came from; a club no feeder sent is a bye.
function fedBy(next, feeders, byeAllowed) {
  next.slots = next.slots.map((slot) => {
    const from = feeders.find((f) => f.winner?.id === slot.club?.id)
    if (from) from.feeds = next.key
    return { ...slot, from: from?.key ?? null, bye: byeAllowed && !from }
  })
  // A later round lists its feeders' clubs in the feeders' order, as the live bracket does.
  if (!byeAllowed) next.slots.sort((a, b) => feeders.findIndex((f) => f.key === a.from) - feeders.findIndex((f) => f.key === b.from))
}

export function historyBracket(season) {
  then = season?.teams ?? {}
  const rounds = Object.fromEntries((season?.rounds ?? []).map((r) => [r.key, r.series ?? []]))
  const pick = (round, league) => (rounds[round] ?? []).filter((s) => league == null || LEAGUE[s.leagueId] === league).map((s) => series(s, round, season.year))
  const hasLcs = (rounds.lcs ?? []).length > 0
  const leagues = hasLcs ? {} : null
  for (const league of hasLcs ? ['AL', 'NL'] : []) {
    const wildcard = pick('wildcard', league)
    const division = pick('division', league)
    const lcs = pick('lcs', league)
    if (![0, 1, 2, 4].includes(wildcard.length) || ![0, 2].includes(division.length) || lcs.length !== 1) return null
    if (!division.length && wildcard.length) return null
    for (const ds of division) fedBy(ds, wildcard, wildcard.length > 0)
    // Each Wild Card series sits beside the Division Series it fed, in that series' slot order, as the live bracket orders them.
    const place = (w) => {
      const d = division.findIndex((x) => x.key === w.feeds)
      return d * 2 + (division[d]?.slots.findIndex((s) => s.from === w.key) ?? 0)
    }
    wildcard.sort((a, b) => place(a) - place(b))
    fedBy(lcs[0], division, false)
    const byes = division.flatMap((d) => d.slots.filter((s) => s.bye).map((s) => s.club))
    leagues[league] = { wildcard, division, lcs: lcs[0], byes }
  }
  const worldSeries = pick('worldseries')[0]
  if (!worldSeries) return null
  fedBy(worldSeries, leagues ? [leagues.AL.lcs, leagues.NL.lcs] : [], false)
  const all = [...(leagues ? ['AL', 'NL'] : []).flatMap((l) => [...leagues[l].wildcard, ...leagues[l].division, leagues[l].lcs]), worldSeries]
  const last = worldSeries.games.at(-1)?.date ?? `${season.year}-11-30`
  return {
    season: season.year,
    // The day after the last game: every series reads as decided, none as playing.
    cutoff: new Date(Date.parse(`${last}T12:00:00Z`) + 864e5).toISOString().slice(0, 10),
    leagues,
    worldSeries,
    champion: worldSeries.winner,
    series: all,
    gameIndex: Object.fromEntries(all.flatMap((s) => s.games.map((g) => [g.gamePk, { key: s.key, gameNumber: g.gameNumber }]))),
  }
}
