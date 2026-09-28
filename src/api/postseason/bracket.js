// The postseason bracket HEADING INTO a cutoff date (#1224, slice 3). Pure:
// the rows come from ./fetch.js, and nothing here fetches or stores.
//
// THE RULE. A game counts only when it went Final, with a winner, BEFORE the
// cutoff date. It went Final on its officialDate, or on its resumeGameDate
// when it was suspended. A game on the cutoff date never counts, Final or
// not, so the bracket shows all day what it showed that morning. Yesterday's
// results are not protected: that is a decision, not a gap (ADR-0087).
// Scores Unlocked does not apply. There is no seal.
//
// WHAT THE SKELETON MAY SAY, AND WHAT IT MAY NOT. The skeleton rows are the
// live schedule, so on the day a series ends they already name its winner in
// the next round, and they drop its unplayed "if necessary" games. So:
//   - A slot fed by an earlier series is filled from THAT series' derived
//     winner, never from the club the skeleton names there.
//   - A Division Series slot no Wild Card series feeds is a bye: that club is
//     in the skeleton from the first day.
//   - "If necessary" is worked out from the heading-in wins, never read off a
//     row (a future row's flag flips when it becomes necessary).
//   - When today's game can end a series, its later "if necessary" games
//     carry no date: their rows are the ones that vanish.
//
// WIRING, NEVER BY LETTER. NL Wild Card 'A' (PHI @ ATL) feeds NLDS 'B' in
// 2026, and the AL crosses the same way. A Division Series slot names its
// feeder as a placeholder pair ("ATL/PHI"), or, once that series ends, as the
// winner's club id. Both are matched against the Wild Card series' clubs.
//
// PLACEHOLDERS. Ids like 5528 ("HOU/CWS"), 5513 ("AL Higher Seed") and 2711
// ("Lower Seed League Champion") look like clubs. `isClub` keeps them out of
// every slot, so none can reach teamLogoUrl, TeamLink or a favorite-team sort.
//
// The returned shape is documented in docs/api/postseason.md.

const ROUND_BY_TYPE = { F: 'wildcard', D: 'division', L: 'lcs', W: 'worldseries' }
const ROUND_ORDER = ['wildcard', 'division', 'lcs', 'worldseries']
const DEFAULT_BEST_OF = { wildcard: 3, division: 5, lcs: 7, worldseries: 7 }
const LEAGUE_BY_ID = { 103: 'AL', 104: 'NL' }

// A real MLB club: franchise ids run 108-147, plus 158. A placeholder's id is
// far outside that range and its name holds a '/' or the word "Seed".
export function isClub(team) {
  const id = Number(team?.id)
  if (!Number.isInteger(id)) return false
  if (!((id >= 108 && id <= 147) || id === 158)) return false
  return !/\/|Seed/.test(`${team.name ?? ''} ${team.abbreviation ?? ''}`)
}

const clubOf = (team) => (isClub(team) ? { id: team.id, name: team.name, abbreviation: team.abbreviation } : null)

// The date a game went Final (or will): its resume date if it was suspended.
const finalDate = (row) => row.resumeGameDate ?? row.officialDate

// Sorting key for "the same series": round plus the two slot ids.
const groupKey = (row) => `${row.gameType}|${[row.away.id, row.home.id].sort((a, b) => a - b).join('-')}`

function leagueOf(rows, round) {
  if (round === 'worldseries') return null
  for (const r of rows) {
    const id = r.home.leagueId ?? r.away.leagueId
    if (LEAGUE_BY_ID[id]) return LEAGUE_BY_ID[id]
  }
  const prefix = rows[0]?.seriesDescription?.slice(0, 2)
  return prefix === 'AL' || prefix === 'NL' ? prefix : null
}

// "NLDS 'B' Game 1" -> "NLDS 'B'". A display label only; nothing wires by it.
const labelOf = (description) => (description ?? '').replace(/\s*Game\s+\d+.*$/i, '').trim()

// A placeholder names its feeder as "HOME/AWAY" abbreviations ("ATL/PHI").
function pairOf(team) {
  const parts = String(team?.abbreviation || team?.name || '').split('/')
  return parts.length === 2 ? new Set(parts.map((p) => p.trim())) : null
}

function buildSeries(rows, season) {
  rows.sort((a, b) => (a.gameNumber ?? 99) - (b.gameNumber ?? 99) || a.officialDate.localeCompare(b.officialDate))
  const game1 = rows[0]
  const round = ROUND_BY_TYPE[game1.gameType]
  const bestOf = Math.max(0, ...rows.map((r) => r.gamesInSeries ?? 0)) || DEFAULT_BEST_OF[round]
  return {
    key: String(game1.gamePk),
    id: null,
    round,
    league: leagueOf(rows, round),
    name: game1.seriesDescription || '',
    label: labelOf(game1.description),
    bestOf,
    winsNeeded: Math.floor(bestOf / 2) + 1,
    slots: [],
    gamesPlayed: 0,
    decided: false,
    winner: null,
    eliminated: null,
    playsOnCutoff: false,
    cutoffGame: null,
    feeds: null,
    games: [],
    upcoming: [],
    // Working state, stripped before return.
    _rows: rows,
    _game1: game1,
    _season: season,
  }
}

const emptySlot = (from = null) => ({ club: null, wins: 0, from, bye: false })

// A Division Series slot: which Wild Card series feeds it, by the
// placeholder's club pair, then by club id.
function feederFor(team, wildcards) {
  const pair = pairOf(team)
  return wildcards.find((wc) => {
    const clubs = [wc._game1.away, wc._game1.home]
    if (pair && clubs.every((c) => pair.has(c.abbreviation))) return true
    return isClub(team) && clubs.some((c) => c.id === team.id)
  })
}

function settle(series, counted, cutoff) {
  const ids = series.slots.map((s) => s.club?.id ?? null)
  series.games = series._rows
    .filter((r) => counted.has(r.gamePk))
    .map((r) => ({ gamePk: r.gamePk, gameNumber: r.gameNumber, date: finalDate(r), winnerId: counted.get(r.gamePk) }))
  // Only a win by a club the bracket placed in this series counts.
  series.games = series.games.filter((g) => ids.includes(g.winnerId))
  series.gamesPlayed = series.games.length
  for (const slot of series.slots) {
    slot.wins = slot.club ? series.games.filter((g) => g.winnerId === slot.club.id).length : 0
  }
  const winIdx = series.slots.findIndex((s) => s.club && s.wins >= series.winsNeeded)
  if (winIdx !== -1) {
    series.decided = true
    series.winner = series.slots[winIdx].club
    series.eliminated = series.slots[1 - winIdx].club
  }

  if (!series.decided) {
    const today = series._rows.find((r) => r.officialDate === cutoff || r.resumeGameDate === cutoff)
    if (today && !counted.has(today.gamePk)) {
      series.playsOnCutoff = true
      series.cutoffGame = { gamePk: today.gamePk, gameNumber: today.gameNumber }
    }
  }

  // The series id, the history generator's way: Game 1's away and home ids.
  // Only when the bracket itself knows both clubs, and Game 1's row agrees.
  const [a, b] = ids
  const g1 = series._game1
  if (a && b && [g1.away.id, g1.home.id].sort().join() === [a, b].sort().join()) {
    series.id = `${series._season}-${series.round}-${g1.away.id}-${g1.home.id}`
  }

  series.upcoming = upcomingGames(series)
}

function upcomingGames(series) {
  if (series.decided) return []
  const lead = Math.max(...series.slots.map((s) => s.wins))
  const certainThrough = series.gamesPlayed + (series.winsNeeded - lead)
  const canEndToday = series.playsOnCutoff && lead === series.winsNeeded - 1
  const out = []
  for (let n = series.gamesPlayed + 1; n <= series.bestOf; n++) {
    const row = series._rows.find((r) => r.gameNumber === n)
    const ifNecessary = n > certainThrough
    const hide = !row || (canEndToday && ifNecessary && n > series.cutoffGame.gameNumber)
    out.push({
      gameNumber: n,
      gamePk: hide ? null : row.gamePk,
      date: hide ? null : finalDate(row),
      ifNecessary,
    })
  }
  return out
}

// DS order: the schedule's own order ('A' before 'B'), then Game 1's gamePk.
// A display order only — the wiring above never reads it.
const byLabel = (a, b) => a.label.localeCompare(b.label) || Number(a.key) - Number(b.key)

export function deriveBracket(skeletonRows, resultRows, cutoffDate) {
  const rows = (skeletonRows ?? []).filter((r) => ROUND_BY_TYPE[r.gameType])
  if (!rows.length || !cutoffDate) return null
  const season = Number(rows[0].officialDate.slice(0, 4))

  // The results that count: Final, a winner, gone Final before the cutoff.
  const counted = new Map()
  for (const r of resultRows ?? []) {
    if (r.final && r.winnerId && finalDate(r) < cutoffDate) counted.set(r.gamePk, r.winnerId)
  }

  const groups = new Map()
  for (const r of rows) {
    const k = groupKey(r)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  const all = [...groups.values()].map((g) => buildSeries(g, season))
  const pick = (round, league) => all.filter((s) => s.round === round && (league === undefined || s.league === league))

  const leagues = {}
  for (const league of ['AL', 'NL']) {
    const wildcard = pick('wildcard', league)
    const division = pick('division', league).sort(byLabel)
    const lcs = pick('lcs', league)[0] ?? null

    for (const wc of wildcard) {
      wc.slots = [emptySlot(), emptySlot()]
      wc.slots[0].club = clubOf(wc._game1.away)
      wc.slots[1].club = clubOf(wc._game1.home)
      settle(wc, counted, cutoffDate)
    }
    for (const ds of division) {
      ds.slots = [ds._game1.away, ds._game1.home].map((team) => {
        const feeder = feederFor(team, wildcard)
        if (feeder) {
          feeder.feeds = ds.key
          return { ...emptySlot(feeder.key), club: feeder.winner }
        }
        return { ...emptySlot(), club: clubOf(team), bye: wildcard.length > 0 && isClub(team) }
      })
      settle(ds, counted, cutoffDate)
    }
    // A Wild Card series no Division Series names still takes its place.
    wildcard.sort((a, b) => {
      const ia = division.findIndex((d) => d.key === a.feeds)
      const ib = division.findIndex((d) => d.key === b.feeds)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || Number(a.key) - Number(b.key)
    })
    if (lcs) fedBy(lcs, division, counted, cutoffDate)

    leagues[league] = {
      wildcard,
      division,
      lcs,
      byes: division.flatMap((d) => d.slots.filter((s) => s.bye && s.club).map((s) => s.club)),
    }
  }

  const worldSeries = pick('worldseries')[0] ?? null
  if (worldSeries) fedBy(worldSeries, [leagues.AL.lcs, leagues.NL.lcs].filter(Boolean), counted, cutoffDate)

  const ordered = []
  for (const league of ['AL', 'NL']) {
    const l = leagues[league]
    ordered.push(...l.wildcard, ...l.division, ...(l.lcs ? [l.lcs] : []))
  }
  if (worldSeries) ordered.push(worldSeries)

  // gamePk -> its series, for the slate cards. Only games dated on or before
  // the cutoff: a later row is one today's result can remove.
  const gameIndex = {}
  for (const s of ordered) {
    for (const r of s._rows) {
      if (r.officialDate <= cutoffDate || (r.resumeGameDate && r.resumeGameDate <= cutoffDate)) {
        gameIndex[r.gamePk] = { key: s.key, gameNumber: r.gameNumber }
      }
    }
  }
  for (const s of ordered) {
    delete s._rows
    delete s._game1
    delete s._season
  }
  ordered.sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round) || leagueRank(a) - leagueRank(b))

  return {
    season,
    cutoff: cutoffDate,
    leagues,
    worldSeries,
    champion: worldSeries?.decided ? worldSeries.winner : null,
    series: ordered,
    gameIndex,
  }
}

const leagueRank = (s) => (s.league === 'AL' ? 0 : s.league === 'NL' ? 1 : 2)

// An LCS or the World Series: one slot per feeder, in feeder order, filled
// with that feeder's winner once it is decided. With no feeders (a format
// with no round before this one), the skeleton's real clubs stand.
function fedBy(series, feeders, counted, cutoff) {
  if (feeders.length === 2) {
    series.slots = feeders.map((f) => {
      f.feeds = series.key
      return { ...emptySlot(f.key), club: f.winner }
    })
  } else {
    series.slots = [series._game1.away, series._game1.home].map((t) => ({ ...emptySlot(), club: clubOf(t) }))
  }
  settle(series, counted, cutoff)
}

// The series a slate game belongs to, and that game's number in it.
export function seriesForGame(bracket, gamePk) {
  const hit = bracket?.gameIndex?.[gamePk]
  if (!hit) return null
  const series = bracket.series.find((s) => s.key === hit.key)
  return series ? { series, gameNumber: hit.gameNumber } : null
}
