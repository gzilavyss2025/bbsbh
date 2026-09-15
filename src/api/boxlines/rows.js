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
// schedule reports Final AND scored (a live or suspended game has no row, and
// the gate asks for the score rather than for the word Final, because a
// postponed game calls itself Final too). The component holds no date logic; it
// renders what it is handed. A FACET's `keep` predicate (facets.js) is applied
// AFTER both checks, never before, so narrowing is all a facet can do — the
// rows it never sees do not exist. `logRequestPlan` is the other half of the
// same gate, upstream of the fetch: the cutoff season is requested only through the day BEFORE the
// cutoff (`endDate`, honoured inclusively by statsapi — verified 2026-09-02),
// so the game being scored is never fetched, never mind dropped.
//
// AND THE SCORE MAY BE RECOVERED, WITHOUT LOOSENING THE GATE (#1031). Some
// games MLB left stuck at `Postponed` were PLAYED — rained out, replayed the
// same day under the same gamePk, and the schedule row never updated. The gate
// dropped them, so a door counted them and the sheet did not. `scorelessGamePks`
// names exactly the games the gate turned away FOR WANT OF A SCORE, fetch.js
// reads each one's own linescore, and `recoveredScores` hands the answer back
// here. The gate itself is unchanged: a game with no score on either source
// still has no row, and a game that failed the cutoff or the Final check is
// never asked about. See ADR-0069's 2026-09-15 amendment for the measurement.
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
// season only, which is what most surfaces built on Box Lines show.
export const REGULAR_SEASON = ['R']

// The postseason, spelled out as its four rounds — never the umbrella 'P'
// (#1006). Both spellings SELECT the same games, so this list is not about
// which rows come back; it is about what those rows say they are:
//
//   Ohtani 2025, the same games, one call apart (verified 2026-09-10)
//     group=pitching&gameType=P         -> every row's gameType is "P"
//     group=pitching&gameType=F,D,L,W   -> "D", "L", "W"
//     group=hitting &gameType=P         -> "F", "D", "L", "W"  (honest either way)
//
// The PITCHING game log echoes the type that was ASKED FOR into every row it
// returns; the hitting log reports the game's own. So 'P' would cost a pitcher
// two things at once: `seriesAbbr` below could not name his round, and
// `matchingSplits` — which keeps only rows whose type is in the requested set
// — would drop all of them. A full sheet for a hitter and an empty one for a
// pitcher, off the same door. Ask for the rounds.
export const POSTSEASON = ['F', 'D', 'L', 'W']

// The game types a facet actually gets to ask for. Only one thing is
// normalized: the umbrella 'P' becomes the four rounds. It is not a different
// QUESTION — both spellings select the same games — but only one of them
// survives the round trip through a pitching game log, and a facet that asked
// with 'P' would otherwise get a full sheet for a hitter and an empty one for
// a pitcher, with nothing on either to say why. Everything else passes
// through: an unknown type is left alone and simply matches no row.
export function askableGameTypes(types) {
  const list = types?.length ? types : REGULAR_SEASON
  return [...new Set(list.flatMap((t) => (t === 'P' ? POSTSEASON : [t])))]
}

// The pill a postseason row wears, from the game's own type. '' for the
// regular season, which is every row on every other facet, so the pill is
// absent there rather than empty. 'P' deliberately has no abbreviation: a row
// that still says 'P' came from a call that asked the wrong question (above),
// and a blank pill is the visible end of that, not a confident wrong answer.
// The park's surface that season, from the schedule record's own
// `venue.fieldInfo.turfType` (`hydrate=venue(fieldInfo)`): 'grass', 'turf', or
// '' when the record does not carry one. MLB spells it "Grass" or "Artificial
// Turf"; anything else that is not grass is turf, so a future spelling lands
// on the right side rather than vanishing.
//
// IT IS SEASON-CORRECT, which is the whole reason this is read off the game
// rather than off a table of parks: Chase Field comes back Grass for 2016 and
// 2018 and Artificial Turf from 2019 (verified 2026-09-15), which is when it
// was relaid. A static map of today's surfaces would have called eighty-one
// 2016 games turf.
export function surfaceOf(turfType) {
  const t = String(turfType ?? '').trim().toLowerCase()
  if (!t) return ''
  return t.includes('grass') ? 'grass' : 'turf'
}

export function seriesAbbr(gameType) {
  return { F: 'WC', D: 'DS', L: 'LCS', W: 'WS' }[gameType] ?? ''
}

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

// THE GATE's first two checks, shared by its two readers. A split reaches here
// only if it is dated strictly before the cutoff — a same-day doubleheader game
// 1 shares the date and is out — and matches a schedule record the endpoint
// reports Final. The SCORE check is deliberately not here: it is the one
// question the two readers answer differently. `boxLineRows` needs a score to
// build a row; `scorelessGamePks` wants exactly the games that have none.
function* gatedPairs({ splits, schedule, cutoff, gameTypes }) {
  const byPk = new Map((schedule ?? []).filter((g) => g?.gamePk).map((g) => [g.gamePk, g]))
  for (const s of matchingSplits(splits, { gameTypes })) {
    if (cutoff && !(s.date < cutoff)) continue
    const g = byPk.get(s.game.gamePk)
    if (!g || g.status?.abstractGameState !== 'Final') continue
    yield [s, g]
  }
}

// The games that cleared the cutoff and the Final check and were dropped ONLY
// because the schedule record carries no score — the stuck `Postponed` rows of
// #1031, and nothing else. fetch.js reads each one's own linescore and hands
// what it finds back to `boxLineRows` as `recoveredScores`.
//
// This is the narrowest possible list, and that is the point: it is built from
// the SAME gate, so a game at or after the cutoff and a game the schedule does
// not call Final are never named here, never mind fetched.
export function scorelessGamePks({
  splits,
  schedule,
  cutoff = null,
  gameTypes = REGULAR_SEASON,
} = {}) {
  const pks = new Set()
  for (const [s, g] of gatedPairs({ splits, schedule, cutoff, gameTypes })) {
    if (g.teams?.away?.score == null || g.teams?.home?.score == null) pks.add(s.game.gamePk)
  }
  return [...pks]
}

// The final score of one gated game, from the schedule record or — when that
// record is a stuck `Postponed` one — from the linescore fetch.js recovered for
// it. `??` and not `||`, so a shutout's 0 is a score and not a miss. Nulls when
// neither source has one, which is what keeps the gate closed.
function scoreOf(g, awayIsHis, recovered) {
  const away = g.teams?.away?.score ?? recovered?.away ?? null
  const home = g.teams?.home?.score ?? recovered?.home ?? null
  return awayIsHis ? { runs: away, oppRuns: home } : { runs: home, oppRuns: away }
}

// The rows. `schedule` is the list of schedule game records for the splits'
// gamePks (any order, extras ignored). Shape of a row:
//   { season, date, gamePk, gameNumber, gameType, series, home, teamId,
//     teamAbbr, opponentId, opponentAbbr, started, lineupStart, positions,
//     line, won, runs, oppRuns, venueId, venueName, surface, dayNight,
//     boxScorePath }
// `started` is null for hitters: the hitting game log carries no gamesStarted.
// `positions` is null for pitchers, for the same reason in reverse.
//
// `lineupStart` answers the same question for a HITTER — was he on the card —
// and it is null unless the caller handed over `lineupStarts`, the second,
// narrow schedule pass fetch.js makes only for the two doors that need it. A
// game the lineups could not answer for stays null and belongs to neither
// side of that facet, rather than being counted as a bench appearance.
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
  lineupStarts = null,
  recoveredScores = null,
}) {
  const rows = []
  // THE GATE, first two checks in `gatedPairs`: strictly before the cutoff — a
  // same-day game shares the date — and only a game the schedule says is over.
  for (const [s, g] of gatedPairs({ splits, schedule, cutoff, gameTypes })) {
    const teamId = s.team?.id ?? null
    const awayIsHis = g.teams?.away?.team?.id === teamId
    const mine = awayIsHis ? g.teams?.away : g.teams?.home
    const theirs = awayIsHis ? g.teams?.home : g.teams?.away
    const awayAbbr = g.teams?.away?.team?.abbreviation ?? ''
    const homeAbbr = g.teams?.home?.team?.abbreviation ?? ''
    const officialDate = g.officialDate ?? s.date
    const st = s.stat ?? {}
    // AND A REAL SCORE. "Final" is not enough: a POSTPONED game reports
    // `abstractGameState: 'Final'` with `detailedState: 'Postponed'` and no
    // scores at all (verified 2026-09-02 — gamePks 776691, 777459 and 632997
    // all reached the sheet as scoreless rows). Every row here is a game the
    // player played and a score he may be shown, so the last check is for the
    // score itself rather than for one more spelling of a status.
    //
    // A stuck row's score may have been RECOVERED off the game's own linescore
    // (#1031) and handed in through `recoveredScores`; a game neither source
    // scored still has no row, which is the same fail-closed answer as before.
    const { runs, oppRuns } = scoreOf(g, awayIsHis, recoveredScores?.get(s.game.gamePk))
    if (runs == null || oppRuns == null) continue
    rows.push({
      season: Number(s.date.slice(0, 4)),
      date: s.date,
      gamePk: s.game.gamePk,
      gameNumber: g.gameNumber ?? s.game.gameNumber ?? 1,
      gameType: s.gameType,
      series: seriesAbbr(s.gameType),
      home: !awayIsHis,
      teamId,
      teamAbbr: mine?.team?.abbreviation ?? '',
      opponentId: s.opponent?.id ?? null,
      opponentAbbr: theirs?.team?.abbreviation ?? '',
      started: group === 'pitching' ? Number(st.gamesStarted) > 0 : null,
      // THE POSITIONS HE PLAYED THAT DAY, in the order he played them —
      // ['PH'], ['PH', 'LF'], ['DH', 'LF'] — off the HITTING game log's own
      // `positionsPlayed`, which no other source in this app reads. Null for a
      // pitcher, whose log does not carry it. It answers the pinch-hit facet
      // for free, which is what made #1002's per-game boxscore read
      // unnecessary; facets.js has the measurement.
      positions:
        group === 'hitting'
          ? (s.positionsPlayed ?? []).map((p) => p?.abbreviation).filter(Boolean)
          : null,
      // WAS HE ON THE CARD? A Map gamePk -> boolean, built by fetch.js from
      // the schedule's `hydrate=lineups`, or null when no door on this sheet
      // asked. `has` rather than `get`, so a game the lineups did not cover is
      // null (unknown) and not false (came off the bench).
      lineupStart: lineupStarts?.has(s.game.gamePk) ? lineupStarts.get(s.game.gamePk) : null,
      line: group === 'pitching' ? pitcherLine(st) : hitterLine(st),
      won: runs != null && oppRuns != null ? runs > oppRuns : Boolean(s.isWin),
      runs,
      oppRuns,
      venueId: g.venue?.id ?? null,
      venueName: g.venue?.name ?? '',
      surface: surfaceOf(g.venue?.fieldInfo?.turfType),
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
