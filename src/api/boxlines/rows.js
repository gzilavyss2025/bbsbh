// BOX LINES — the pure half. Turns a player's game-log splits plus the
// schedule records for those games into the rows the Box Lines sheet renders
// (components/boxlines/BoxLinesSheet.jsx): one row per game, newest first,
// each carrying his one-game line, the final score and the box-score path.
// fetch.js gathers and facets.js says which question is asked; this file
// decides what a row is and which rows may exist.
//
// THE CUTOFF GATE LIVES HERE, and only here (ADR-0069). The sheet opens from
// the lineup page — a SCORING surface — and every row carries a final score,
// so a row for a game on or after the day being scored may not exist at all.
// `boxLineRows` returns only games dated strictly BEFORE `cutoff` (a same-day
// doubleheader game 1 is on the cutoff day and is out) and only games the
// schedule reports Final AND scored (a live or suspended game has no row; a
// POSTPONED one calls itself Final and carries no score, so the gate asks for
// the score rather than for the word). The component holds no date logic; it
// renders what it is handed. A FACET's `keep` predicate (facets.js) is applied
// AFTER both checks, never before, so narrowing is all a facet can do — the
// rows it never sees do not exist. `logRequestPlan` is the other half of the
// same gate, upstream of the fetch: the cutoff season is requested only through the day BEFORE the
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

// The game types a row may come from unless a facet asks for others. Regular
// season only, which is what every surface built on Box Lines so far shows;
// the postseason facet passes ['F', 'D', 'L', 'W'] (gameType 'P' is dead on
// statsapi — verified 2026-09-02).
export const REGULAR_SEASON = ['R']

// The splits a row may be built from: the right game types, dated, joinable by
// gamePk, and — when `opponentId` is given — against one club. `opponentId`
// null keeps every club, which is what every facet but 'club' wants; those
// filter over the finished rows instead, through `keep` below.
export function matchingSplits(splits, { opponentId = null, gameTypes = REGULAR_SEASON } = {}) {
  const types = new Set(gameTypes?.length ? gameTypes : REGULAR_SEASON)
  return (splits ?? []).filter(
    (s) =>
      types.has(s?.gameType) &&
      s.date &&
      s.game?.gamePk &&
      (opponentId == null || s.opponent?.id === opponentId),
  )
}

// The rows. `schedule` is the list of schedule game records for the splits'
// gamePks (any order, extras ignored). Shape of a row:
//   { season, date, gamePk, gameNumber, gameType, home, teamId, teamAbbr,
//     opponentId, opponentAbbr, started, line, won, runs, oppRuns, venueId,
//     venueName, dayNight, boxScorePath }
// `started` is null for hitters: the hitting game log carries no gamesStarted.
//
// `keep` is a facet's row predicate (api/boxlines/facets.js) and is applied
// AFTER the gate, never before, so no facet can widen what the gate allows:
// a row the cutoff or the Final check dropped is already gone by the time
// `keep` is asked about anything. It narrows, or it does nothing.
export function boxLineRows({
  splits,
  schedule,
  group,
  cutoff = null,
  gameTypes = REGULAR_SEASON,
  keep = null,
}) {
  const byPk = new Map((schedule ?? []).filter((g) => g?.gamePk).map((g) => [g.gamePk, g]))
  const rows = []
  for (const s of matchingSplits(splits, { gameTypes })) {
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
    // AND A REAL SCORE. "Final" is not enough: a POSTPONED game reports
    // `abstractGameState: 'Final'` with `detailedState: 'Postponed'` and no
    // scores at all (verified 2026-09-02 — gamePks 776691, 777459, 632997 all
    // reached the sheet as scoreless rows for games never played). Every row
    // here is a game the player played and a score he may be shown, so the
    // last check is for the score itself rather than for one more spelling of
    // a status.
    if (runs == null || oppRuns == null) continue
    rows.push({
      season: Number(s.date.slice(0, 4)),
      date: s.date,
      gamePk: s.game.gamePk,
      gameNumber: g.gameNumber ?? s.game.gameNumber ?? 1,
      gameType: s.gameType,
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
  // The facet, last. Everything it can see already passed the gate.
  return keep ? rows.filter(keep) : rows
}
