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

export const DASH = '—'

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

// Expected W-L as of THIS cutoff (not a 162-game projection — contrast
// gen-season-score.mjs's pythagoreanPace, which scales to a full season for
// its own pace-badge use case). Prefers MLB's own xWinLoss expected record
// (nested at `records.expectedRecords`, NOT top-level — verified live against
// a 2026 standings pull); falls back to the same Pythagorean-exponent formula
// split over games played so far when the feed omits it (thin/early feeds).
export function expectedPace(t) {
  const gamesPlayed = (t.wins ?? 0) + (t.losses ?? 0)
  const expected = (t.records?.expectedRecords ?? []).find((r) => r.type === 'xWinLoss')
  const xGames = (expected?.wins ?? 0) + (expected?.losses ?? 0)
  if (xGames > 0) return `${expected.wins}-${expected.losses}`
  const rs = t.runsScored ?? 0
  const ra = t.runsAllowed ?? 0
  if (gamesPlayed <= 0 || rs + ra <= 0) return DASH
  const exponent = ((rs + ra) / gamesPlayed) ** 0.287
  const pct = rs ** exponent / (rs ** exponent + ra ** exponent)
  if (!Number.isFinite(pct)) return DASH
  const xWins = Math.round(pct * gamesPlayed)
  return `${xWins}-${gamesPlayed - xWins}`
}

// Division-leader-only "Magic#": MLB's own clinch math straight off the same
// dated record — no games-remaining assumption to get wrong. Every OTHER team
// in the division carries `eliminationNumberDivision` instead of `magicNumber`
// (the two keys are mutually exclusive on the feed), so DASH is also the
// correct answer for a non-leader here without any rank check needed.
export function formatMagicNumber(t) {
  if (t.clinched === true) return 'Clinched'
  if (t.magicNumber != null && t.magicNumber !== '') return `${t.magicNumber}`
  return DASH
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
    pace: expectedPace(t),
    magic: formatMagicNumber(t),
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

// Walks either shaped tree — Division (`lg.divisions[].teams`) or Wild Card
// (`lg.leaders` + `lg.wildcard`) — calling `fn` on every team row. The one
// place that knows both tree shapes, so cross-source merges below don't have
// to.
function eachTeam(leagues, fn) {
  for (const lg of leagues ?? []) {
    if (lg.divisions) {
      for (const div of lg.divisions) {
        for (const t of div.teams ?? []) fn(t)
      }
    } else {
      for (const t of lg.leaders ?? []) fn(t)
      for (const t of lg.wildcard ?? []) fn(t)
    }
  }
  return leagues
}

// Stamps a value from a SECOND data source (e.g. Season Grade, keyed by team
// id) onto an already-shaped standings tree, mutating in place. Kept
// source-agnostic on purpose: this file only knows ONE fetch (the raw
// /standings records), so a caller merging in a different static file's data
// builds the `teamId -> value` map itself and just hands it here.
export function attachTeamField(leagues, valueByTeamId, field) {
  return eachTeam(leagues, (t) => {
    t[field] = valueByTeamId?.get(t.id) ?? null
  })
}

// A team's rank in whichever board is currently shown — division rank
// (`t.rank`) or the pooled Wild Card ranking (`t.wcRank`, only present on
// `lg.wildcard` rows; a division leader has no pooled rank to compare, so it's
// simply skipped rather than defaulting to a misleading 0).
export function extractRanks(leagues, boardMode) {
  const ranks = new Map()
  eachTeam(leagues, (t) => {
    const rank = boardMode === 'wildcard' ? t.wcRank : Number(t.rank)
    if (t.id != null && Number.isFinite(rank)) ranks.set(t.id, rank)
  })
  return ranks
}

// Lower rank is better (1st beats 2nd), so a SMALLER current rank than
// previous means the team trended up. Null when either side is missing
// (team not in one of the two snapshots, or never ranked in this board mode).
export function rankTrend(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (current < previous) return 'up'
  if (current > previous) return 'down'
  return 'flat'
}

export function attachRankTrend(leagues, boardMode, prevRankByTeamId) {
  const currentRanks = extractRanks(leagues, boardMode)
  return eachTeam(leagues, (t) => {
    t.trend = rankTrend(currentRanks.get(t.id), prevRankByTeamId?.get(t.id))
  })
}
