import { contextNeutralPoints } from './performanceScore.js'

// The Logbook retrospective's ported First Scorebook sections — best
// individual performances, most memorable moments, combined leaders, and the
// rotation/bullpen split (ADR-0035, the game-stamps PRD §6).
//
// ===========================================================================
// PURE. Same discipline as logbookStats.js — read that file's header first.
// ===========================================================================
// `(stamps, gameFacts, boxscores, moments) -> numbers`, kept out of
// LogbookStatsPage.jsx's useMemos so this math lands in the CI-gated unit
// suite instead of being verifiable only by eye. A sibling of logbookStats.js
// rather than an addition to it, to leave that file's existing Tier 1 numbers
// (clubs/streaks/matchups) alone and keep both files well under the 600-line
// file-size cap.
//
// ===========================================================================
// REVEAL-ONLY BY CLASSIFICATION — ADR-0001 applies
// ===========================================================================
// Every number here comes from a box-score line or a play description, so
// this module is reveal-only exactly like logbookStats.js. There is no
// SealBox to sit inside, so the discipline is the INPUT: only ever pass this
// the user's own stamps and the facts/boxscores/moments resolved for those
// exact gamePks — never an arbitrary game list.
//
// ===========================================================================
// The four inputs
// ===========================================================================
//   `stamps`     — live stamp records, as computeLogbookStats takes them.
//   `gameFacts`  — `{ [gamePk]: facts }` from api/logbook.js's
//                  fetchStampGames — used here only for `date` and
//                  `winnerId` (rotation/bullpen "team record" needs to know
//                  which side won).
//   `boxscores`  — `{ [gamePk]: { away, home } }` from
//                  api/logbookGameDetail.js's fetchStampBoxscores.
//   `moments`    — `{ [gamePk]: [...] }` from that same module's
//                  fetchStampMoments.
// A stamp missing its boxscore or moments entry (still resolving, or that
// fetch failed) is simply left out of these sections — the same graceful
// degradation as a stamp missing its schedule facts in logbookStats.js.

const ipString = (outs) => `${Math.floor(outs / 3)}.${outs % 3}`
const era = (er, outs) => (outs ? (er * 9) / (outs / 3) : 0)
const whip = (bb, h, outs) => (outs ? (bb + h) / (outs / 3) : 0)

function lineForBatter(b) {
  const extras = []
  if (b.homeRuns) extras.push(`${b.homeRuns} HR`)
  if (b.doubles) extras.push(`${b.doubles} 2B`)
  if (b.triples) extras.push(`${b.triples} 3B`)
  if (b.rbi) extras.push(`${b.rbi} RBI`)
  if (b.runs) extras.push(`${b.runs} R`)
  if (b.stolenBases) extras.push(`${b.stolenBases} SB`)
  return `${b.hits ?? 0}-for-${b.atBats ?? 0}${extras.length ? `, ${extras.join(', ')}` : ''}`
}

function lineForPitcher(s) {
  return `${s.inningsPitched ?? '0.0'} IP, ${s.hits ?? 0} H, ${s.runs ?? 0} R, ${s.baseOnBalls ?? 0} BB, ${s.strikeOuts ?? 0} K`
}

// Every appeared player row across the user's stamped, boxscore-resolved
// games, each tagged with its own game's date and winnerId — the flat list
// every section below folds over.
function appearances(stamps, gameFacts, boxscores) {
  const out = []
  for (const stamp of stamps ?? []) {
    const gamePk = stamp?.gamePk
    const box = boxscores?.[gamePk]
    if (!box) continue
    const facts = gameFacts?.[gamePk]
    const date = facts?.date ?? stamp.date ?? ''
    const winnerId = facts?.winnerId ?? null
    for (const side of ['away', 'home']) {
      for (const player of box[side]?.players ?? []) {
        out.push({ ...player, gamePk, date, winnerId })
      }
    }
  }
  return out
}

function performances(rows) {
  const out = []
  for (const p of rows) {
    if (!p.battingAppeared && !p.pitchingAppeared) continue
    const score = contextNeutralPoints({ batting: p.batting, pitching: p.pitching })
    const base = {
      score,
      gamePk: p.gamePk,
      date: p.date,
      name: p.name,
      playerId: p.id,
      team: p.teamAbbr,
      teamId: p.teamId,
    }
    if (p.battingAppeared) out.push({ ...base, type: 'batting', line: lineForBatter(p.batting) })
    if (p.pitchingAppeared) out.push({ ...base, type: 'pitching', line: lineForPitcher(p.pitching) })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 16)
}

// Every stamped game's flagged win-probability swings, each carrying its own
// game's date, ranked and capped to the handful First Scorebook renders.
function moments(stamps, gameFacts, momentsByGame) {
  const out = []
  for (const stamp of stamps ?? []) {
    const gamePk = stamp?.gamePk
    const entries = momentsByGame?.[gamePk]
    if (!entries?.length) continue
    const date = gameFacts?.[gamePk]?.date ?? stamp.date ?? ''
    for (const entry of entries) {
      if (!entry.description) continue
      out.push({ ...entry, gamePk, date })
    }
  }
  return out.sort((a, b) => b.swing - a.swing).slice(0, 12)
}

// Batting/pitching totals across every stamped, boxscore-resolved game — the
// book read as its own miniature season, same framing as First Scorebook's
// combined leaders.
function leaders(rows) {
  const batters = new Map()
  const pitchers = new Map()
  for (const p of rows) {
    if (p.battingAppeared) {
      const row =
        batters.get(p.id) ??
        { id: p.id, name: p.name, teamId: p.teamId, team: p.teamAbbr, games: 0, b: emptyBatting() }
      row.games += 1
      row.teamId = p.teamId
      row.team = p.teamAbbr
      addBatting(row.b, p.batting)
      batters.set(p.id, row)
    }
    if (p.pitchingAppeared) {
      const row =
        pitchers.get(p.id) ??
        { id: p.id, name: p.name, teamId: p.teamId, team: p.teamAbbr, games: 0, outs: 0, s: emptyPitching() }
      row.games += 1
      row.teamId = p.teamId
      row.team = p.teamAbbr
      row.outs += p.pitching.outs
      addPitching(row.s, p.pitching)
      pitchers.set(p.id, row)
    }
  }

  const battingLeaders = [...batters.values()]
    .map((row) => ({
      id: row.id,
      name: row.name,
      teamId: row.teamId,
      team: row.team,
      games: row.games,
      batting: row.b,
      average: row.b.atBats ? row.b.hits / row.b.atBats : 0,
    }))
    .sort((a, b) => b.batting.hits - a.batting.hits || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, 12)

  const pitchingLeaders = [...pitchers.values()]
    .map((row) => ({
      id: row.id,
      name: row.name,
      teamId: row.teamId,
      team: row.team,
      games: row.games,
      pitching: { ...row.s, inningsPitched: ipString(row.outs) },
      whip: whip(row.s.baseOnBalls, row.s.hits, row.outs),
    }))
    .sort(
      (a, b) =>
        b.pitching.strikeOuts - a.pitching.strikeOuts || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    )
    .slice(0, 12)

  return { battingLeaders, pitchingLeaders }
}

function emptyBatting() {
  return { atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, rbi: 0, runs: 0, stolenBases: 0, baseOnBalls: 0 }
}
function addBatting(into, b) {
  into.atBats += b.atBats
  into.hits += b.hits
  into.doubles += b.doubles
  into.triples += b.triples
  into.homeRuns += b.homeRuns
  into.rbi += b.rbi
  into.runs += b.runs
  into.stolenBases += b.stolenBases
  into.baseOnBalls += b.baseOnBalls
}
function emptyPitching() {
  return { hits: 0, runs: 0, earnedRuns: 0, baseOnBalls: 0, strikeOuts: 0, numberOfPitches: 0 }
}
function addPitching(into, s) {
  into.hits += s.hits
  into.runs += s.runs
  into.earnedRuns += s.earnedRuns
  into.baseOnBalls += s.baseOnBalls
  into.strikeOuts += s.strikeOuts
  into.numberOfPitches += s.numberOfPitches
}

// Every pitcher who started (rotation) or relieved (bullpen) in a stamped
// game, grouped by person — NOT by club, unlike First Scorebook's Brewers-
// only rotation. Role is decided per APPEARANCE (`pitchingAppeared &&
// gamesStarted`), so a pitcher who both started one stamped game and
// relieved in another correctly appears in both tables.
function pitchingRoles(rows) {
  const starts = new Map()
  const relief = new Map()

  for (const p of rows) {
    if (!p.pitchingAppeared) continue
    const bucket = p.pitching.gamesStarted ? starts : relief
    const row =
      bucket.get(p.id) ??
      {
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        team: p.teamAbbr,
        games: 0,
        wins: 0,
        losses: 0,
        teamWins: 0,
        teamLosses: 0,
        saves: 0,
        holds: 0,
        outs: 0,
        pitches: 0,
        s: emptyPitching(),
      }
    row.games += 1
    row.teamId = p.teamId
    row.team = p.teamAbbr
    row.outs += p.pitching.outs
    row.pitches += p.pitching.numberOfPitches
    row.saves += p.pitching.saves
    row.holds += p.pitching.holds
    if (p.pitching.decision === 'W') row.wins += 1
    if (p.pitching.decision === 'L') row.losses += 1
    const teamWon = p.winnerId != null && p.winnerId === p.teamId
    if (teamWon) row.teamWins += 1
    else if (p.winnerId != null) row.teamLosses += 1
    addPitching(row.s, p.pitching)
    bucket.set(p.id, row)
  }

  const rotation = [...starts.values()]
    .map((row) => ({
      id: row.id,
      name: row.name,
      teamId: row.teamId,
      team: row.team,
      gamesStarted: row.games,
      wins: row.wins,
      losses: row.losses,
      teamWins: row.teamWins,
      teamLosses: row.teamLosses,
      inningsPitched: ipString(row.outs),
      era: era(row.s.earnedRuns, row.outs),
      whip: whip(row.s.baseOnBalls, row.s.hits, row.outs),
      avgPitches: row.games ? row.pitches / row.games : 0,
      pitching: row.s,
    }))
    .sort((a, b) => b.gamesStarted - a.gamesStarted || a.era - b.era)

  const bullpen = [...relief.values()]
    .map((row) => ({
      id: row.id,
      name: row.name,
      teamId: row.teamId,
      team: row.team,
      appearances: row.games,
      saves: row.saves,
      holds: row.holds,
      inningsPitched: ipString(row.outs),
      era: era(row.s.earnedRuns, row.outs),
      whip: whip(row.s.baseOnBalls, row.s.hits, row.outs),
      pitching: row.s,
    }))
    .sort((a, b) => b.appearances - a.appearances || a.era - b.era)

  return { rotation, bullpen }
}

/**
 * The Logbook retrospective's ported First Scorebook sections.
 *
 * @param {Array} stamps        live stamp records (see the header)
 * @param {Object} gameFacts    `{ [gamePk]: facts }` (api/logbook.js)
 * @param {Object} boxscores    `{ [gamePk]: { away, home } }` (api/logbookGameDetail.js)
 * @param {Object} momentsByGame `{ [gamePk]: [...] }` (api/logbookGameDetail.js)
 */
export function computeLogbookRetrospective(stamps, gameFacts, boxscores, momentsByGame) {
  const rows = appearances(stamps, gameFacts, boxscores)
  const { battingLeaders, pitchingLeaders } = leaders(rows)
  const { rotation, bullpen } = pitchingRoles(rows)
  return {
    performances: performances(rows),
    moments: moments(stamps, gameFacts, momentsByGame),
    battingLeaders,
    pitchingLeaders,
    rotation,
    bullpen,
  }
}
