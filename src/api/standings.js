// Pure shaping over the raw /standings records (see fetchLeagueStandings in
// mlb.js) into the league → division → team tree the standings page renders.
//
// Standings numbers (W/L, runs) ARE score-revealing, but — unlike the per-game
// reveal-only modules (linescore.js/derive.js/…) — a standings row is a
// LEAGUE-WIDE aggregate, not one game's line, so it isn't gated by a SealBox.
// Its spoiler-safety comes entirely from the `date` the CALLER requests: the
// standings page defaults to "entering today" (yesterday) and makes today's
// live standings an explicit opt-in tap. This is the same date-gated stance the
// team page's standings section already relies on — no seal, just don't ask the
// API to fold in a day the user may still be scoring.

const DASH = '—'

// East → Central → West within a league. Division ids are stable MLB constants
// (AL: 201/202/200, NL: 204/205/203) and the raw records come back id-ordered
// (so West sorts before Central), hence an explicit order rather than trusting
// the array.
const DIVISION_ORDER = { 201: 0, 202: 1, 200: 2, 204: 0, 205: 1, 203: 2 }

// AL before NL, matching how a printed standings page reads.
const LEAGUE_ORDER = { 103: 0, 104: 1 }
const LEAGUE_NAME = { 103: 'American League', 104: 'National League' }

// "American League East" → "East": under a league heading the loop name is
// redundant, so a division reads as just its region.
function shortDivisionName(fullName, leagueName) {
  const full = fullName || ''
  if (leagueName && full.startsWith(`${leagueName} `)) {
    return full.slice(leagueName.length + 1)
  }
  // Fallback: last word ("… West" → "West").
  return full.split(/\s+/).slice(-1)[0] || full || DASH
}

// A split record ('home' / 'away' / 'lastTen') as a "W-L" string, or DASH when
// the split is absent (thin/early feeds).
function splitWL(rec, type) {
  const s = (rec.records?.splitRecords ?? []).find((x) => x.type === type)
  return s ? `${s.wins}-${s.losses}` : DASH
}

function signed(n) {
  if (!Number.isFinite(n)) return DASH
  return n > 0 ? `+${n}` : `${n}`
}
function diffTone(n) {
  if (!Number.isFinite(n) || n === 0) return ''
  return n > 0 ? 'is-positive' : 'is-negative'
}

function shapeTeam(t, pinnedTeamId) {
  const diff = t.runDifferential
  return {
    id: t.team?.id,
    name: t.team?.name || DASH, // already the disambiguated club nickname
    rank: t.divisionRank,
    w: t.wins ?? DASH,
    l: t.losses ?? DASH,
    pct: t.winningPercentage ?? DASH,
    gb: t.gamesBack ?? DASH,
    wcgb: t.wildCardGamesBack ?? DASH,
    home: splitWL(t, 'home'),
    away: splitWL(t, 'away'),
    rs: Number.isFinite(t.runsScored) ? t.runsScored : DASH,
    ra: Number.isFinite(t.runsAllowed) ? t.runsAllowed : DASH,
    diff: signed(diff),
    diffTone: diffTone(diff),
    streak: t.streak?.streakCode ?? DASH,
    l10: splitWL(t, 'lastTen'),
    pinned: pinnedTeamId != null && t.team?.id === pinnedTeamId,
  }
}

// records[] → [{ id, name, divisions: [{ id, name, fullName, teams: [...] }] }],
// leagues AL→NL and divisions East→Central→West, teams by division rank.
export function shapeStandings(records, pinnedTeamId = null) {
  const byLeague = new Map()
  for (const rec of records ?? []) {
    const leagueId = rec.league?.id
    if (leagueId == null) continue
    if (!byLeague.has(leagueId)) {
      byLeague.set(leagueId, {
        id: leagueId,
        name: LEAGUE_NAME[leagueId] || rec.league?.name || DASH,
        divisions: [],
      })
    }
    const leagueName = LEAGUE_NAME[leagueId] || rec.league?.name || ''
    byLeague.get(leagueId).divisions.push({
      id: rec.division?.id,
      name: shortDivisionName(rec.division?.name, leagueName),
      fullName: rec.division?.name || DASH,
      teams: (rec.teamRecords ?? [])
        .map((t) => shapeTeam(t, pinnedTeamId))
        .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    })
  }

  const leagues = [...byLeague.values()].sort(
    (a, b) => (LEAGUE_ORDER[a.id] ?? 9) - (LEAGUE_ORDER[b.id] ?? 9),
  )
  for (const lg of leagues) {
    lg.divisions.sort(
      (a, b) => (DIVISION_ORDER[a.id] ?? 9) - (DIVISION_ORDER[b.id] ?? 9),
    )
  }
  return leagues
}

// Competition ("1224") ranking by winning pct, same tie convention as
// TeamLeaders' displayRanks: entries sharing a pct all get the SAME rank, and
// the next distinct pct skips ahead by the tie's size (two teams tied at
// .500 are both "rank 1"; the next team is rank 3). Mutates each entry with a
// `wcRank`, and returns the index of the LAST entry at rank <= 3 — the row the
// cutoff divider draws under — so a tie for the final wild-card spot keeps
// every tied team above the line together, matching mlb.com's own standings
// page rather than an arbitrary top-3-by-array-position cut.
function rankWildCardField(teams) {
  const sorted = [...teams].sort((a, b) => b.pctNum - a.pctNum)
  sorted.forEach((t, i) => {
    let first = i
    while (first > 0 && sorted[first - 1].pctNum === t.pctNum) first -= 1
    t.wcRank = first + 1
    t.inWildCard = t.wcRank <= 3
  })
  let cutoffIndex = -1
  sorted.forEach((t, i) => {
    if (t.inWildCard) cutoffIndex = i
  })
  sorted.forEach((t, i) => {
    t.wcCutoff = i === cutoffIndex
  })
  return sorted
}

// records[] → per-league { id, name, leaders: [3 division leaders, best
// record first], wildcard: [every other team, ranked for the wild card] }.
// Unlike shapeStandings' division-grouped tree, mlb.com's Wild Card board
// pools every team in the league into one ranking — a division's 2nd-5th
// place teams compete against every OTHER division's non-leaders, not just
// their own — so this flattens `records` across divisions before ranking.
export function shapeWildCard(records, pinnedTeamId = null) {
  const byLeague = new Map()
  for (const rec of records ?? []) {
    const leagueId = rec.league?.id
    if (leagueId == null) continue
    if (!byLeague.has(leagueId)) {
      byLeague.set(leagueId, {
        id: leagueId,
        name: LEAGUE_NAME[leagueId] || rec.league?.name || DASH,
        leaders: [],
        wildcard: [],
      })
    }
    const leagueName = LEAGUE_NAME[leagueId] || rec.league?.name || ''
    const divShort = shortDivisionName(rec.division?.name, leagueName)
    const lg = byLeague.get(leagueId)
    for (const t of rec.teamRecords ?? []) {
      const shaped = shapeTeam(t, pinnedTeamId)
      shaped.division = divShort
      shaped.pctNum = Number.parseFloat(t.winningPercentage) || 0
      if (t.divisionLeader) {
        lg.leaders.push(shaped)
      } else {
        lg.wildcard.push(shaped)
      }
    }
  }

  const leagues = [...byLeague.values()].sort(
    (a, b) => (LEAGUE_ORDER[a.id] ?? 9) - (LEAGUE_ORDER[b.id] ?? 9),
  )
  for (const lg of leagues) {
    lg.leaders.sort((a, b) => b.pctNum - a.pctNum)
    lg.wildcard = rankWildCardField(lg.wildcard)
  }
  return leagues
}
