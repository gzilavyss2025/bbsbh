// BOX LINES — the pure half. Turns a player's game-log splits plus the
// schedule records for those games into the rows the Box Lines sheet renders
// (components/boxlines/BoxLinesSheet.jsx): one row per regular-season game,
// newest first, each carrying his one-game line, the final score and the
// box-score path. vsClub.js fetches; this file decides.
//
// THE CUTOFF GATE LIVES HERE, and only here (ADR-0069). The sheet opens from
// the lineup page — a SCORING surface — and every row carries a final score,
// so a row for a game on or after the day being scored may not exist at all.
// `boxLineRows` returns only games dated strictly BEFORE `cutoff` (a same-day
// doubleheader game 1 is on the cutoff day and is out) and only games the
// schedule reports Final (a live, suspended or postponed game has no row,
// cutoff or not). The component holds no date logic; it renders what it is
// handed. `logRequestPlan` is the other half of the same gate, upstream of the
// fetch: the cutoff season is requested only through the day BEFORE the
// cutoff (`endDate`, honoured inclusively by statsapi — verified 2026-09-02),
// so the game being scored is never fetched, never mind dropped.
//
// Class: cutoff-gated (spoiler-manifest.json), same footing as
// person/gameLog.js and vsTeamSplits.js — the safety is the date the caller
// asks for. The lineup page passes the scored game's officialDate; a `?d=`
// page passes that; neither means no cutoff, which is the open-surface case
// (ADR-0034) and the only one where an in-progress game can reach the
// schedule join — and the Final check drops it there.
//
// Field paths verified live on personId 656849 (2020–2026) and the schedule
// call for gamePks 745932 / 823770, 2026-09-02. The game log carries NO final
// score and NO venue; both come from the schedule record, joined on gamePk.
// Its `game.dayNight` is unreliable (reported "day" for two known night
// games), so day/night is read off the schedule record too.
import { gamePath } from '../../lib/route.js'
import { hitterLine, pitcherLine } from '../person/gameLog.js'

// "2024-09-29" -> "2024-09-28". Manual y/m/d, midday UTC, so a DST edge or a
// local-timezone offset can never move the answer by a day.
export function dayBefore(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d, 12))
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}

// Which seasons' game logs to fetch, and through which day. Seasons after the
// cutoff's year are never requested; the cutoff's own season is requested only
// through the day before the cutoff, and is dropped outright when that day
// falls in the prior year (a January 1 cutoff). No cutoff: every season, whole.
export function logRequestPlan(seasons, cutoff) {
  const plan = []
  const cutoffYear = cutoff ? Number(String(cutoff).slice(0, 4)) : null
  for (const season of [...new Set(seasons.map(Number).filter(Boolean))].sort((a, b) => a - b)) {
    if (cutoffYear === null || season < cutoffYear) {
      plan.push({ season, endDate: null })
    } else if (season === cutoffYear) {
      const endDate = dayBefore(cutoff)
      if (Number(endDate.slice(0, 4)) === season) plan.push({ season, endDate })
    }
  }
  return plan
}

// Regular-season splits against one club. `opponentId` null keeps every club
// (a future facet filters differently — see the framework map in ADR-0069).
export function matchingSplits(splits, { opponentId = null } = {}) {
  return (splits ?? []).filter(
    (s) =>
      s?.gameType === 'R' &&
      s.date &&
      s.game?.gamePk &&
      (opponentId == null || s.opponent?.id === opponentId),
  )
}

// The rows. `schedule` is the list of schedule game records for the splits'
// gamePks (any order, extras ignored). Shape of a row:
//   { season, date, gamePk, gameNumber, home, teamId, teamAbbr, opponentId,
//     opponentAbbr, started, line, won, runs, oppRuns, venueId, venueName,
//     dayNight, boxScorePath }
// `started` is null for hitters: the hitting game log carries no gamesStarted.
export function boxLineRows({ splits, schedule, group, cutoff = null }) {
  const byPk = new Map((schedule ?? []).filter((g) => g?.gamePk).map((g) => [g.gamePk, g]))
  const rows = []
  for (const s of matchingSplits(splits)) {
    // THE GATE. Strictly before the cutoff — a same-day game shares the date
    // — and only a game the schedule says is over. Both checks, always.
    if (cutoff && !(s.date < cutoff)) continue
    const g = byPk.get(s.game.gamePk)
    if (!g || g.status?.abstractGameState !== 'Final') continue
    const teamId = s.team?.id ?? null
    const awayIsHis = g.teams?.away?.team?.id === teamId
    const mine = awayIsHis ? g.teams?.away : g.teams?.home
    const theirs = awayIsHis ? g.teams?.home : g.teams?.away
    const awayAbbr = g.teams?.away?.team?.abbreviation ?? ''
    const homeAbbr = g.teams?.home?.team?.abbreviation ?? ''
    const officialDate = g.officialDate ?? s.date
    const st = s.stat ?? {}
    const runs = mine?.score ?? null
    const oppRuns = theirs?.score ?? null
    rows.push({
      season: Number(s.date.slice(0, 4)),
      date: s.date,
      gamePk: s.game.gamePk,
      gameNumber: g.gameNumber ?? s.game.gameNumber ?? 1,
      home: !awayIsHis,
      teamId,
      teamAbbr: mine?.team?.abbreviation ?? '',
      opponentId: s.opponent?.id ?? null,
      opponentAbbr: theirs?.team?.abbreviation ?? '',
      started: group === 'pitching' ? Number(st.gamesStarted) > 0 : null,
      line: group === 'pitching' ? pitcherLine(st) : hitterLine(st),
      won: runs != null && oppRuns != null ? runs > oppRuns : Boolean(s.isWin),
      runs,
      oppRuns,
      venueId: g.venue?.id ?? null,
      venueName: g.venue?.name ?? '',
      dayNight: g.dayNight ?? '',
      boxScorePath:
        awayAbbr && homeAbbr
          ? gamePath(officialDate, awayAbbr, homeAbbr, 'boxscore', g.gameNumber ?? 1)
          : null,
    })
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.gamePk - a.gamePk))
  return rows
}
