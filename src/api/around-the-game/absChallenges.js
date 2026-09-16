// The reader behind /abs-challenges — the season board for MLB's ABS
// (Automated Ball-Strike) Challenge System, from the static file
// scripts/gen-abs-challenges.mjs sweeps each night.
//
// SPOILER-FREE. A challenge is a ball-strike judgment, not a run: it says a
// pitch was on the other side of the line, never who scored or who won. The
// season figures cover Final games only, so nothing here can leak tonight's
// result — the same footing as umpires.js's accuracy aggregates and
// comebackWins.js's season buckets, both of which read the same kind of file
// with no SealBox. The LIVE per-game challenge state, which CAN flip a called
// third strike, is a different module and stays reveal-only (api/challenges.js).
//
// THE FILE SHIPS FACTS; THE COMPARISON LIVES HERE. abs-challenges.json holds
// each club's, umpire's and player's own totals per level. Ranking them against
// each other, and the minimum-sample floors that decide who reaches a board at
// all, are derived here — pure and unit-tested (test/abs-challenges.test.js),
// and changeable without regenerating the file. Same split gate.js keeps with
// gen-gate.mjs.

import { staticJson } from '../staticJson.js'

export const fetchAbsChallenges = staticJson('/data/abs-challenges.json')

// The levels the system runs at, in the order the page offers them. MLB is
// 2026's debut; Triple-A has run it for several seasons, which is why its
// numbers are worth reading beside MLB's rather than folded into them — two
// different leagues of hitters, catchers and umpires, each with its own habits.
export const LEVELS = [
  { key: 'MLB', label: 'MLB' },
  { key: 'AAA', label: 'Triple-A' },
]

// MINIMUM SAMPLES. A club plays whole seasons, so its board needs no floor;
// a player who challenged twice and won both would otherwise top a rate board
// at 100%, and an umpire who worked four games would swing thirty points on
// one call. Both floors are stated on the page rather than applied silently.
export const MIN_PLAYER_CHALLENGES = 5
export const MIN_UMPIRE_GAMES = 15

// Which levels the file actually carries, in LEVELS order. A level with no
// swept games is left out rather than offered as an empty board.
export function levelsIn(data) {
  return LEVELS.filter((l) => (data?.levels?.[l.key]?.games ?? 0) > 0)
}

export function summaryFor(data, level) {
  return data?.levels?.[level] ?? null
}

// Rank a board on one field, ties sharing the best rank — 1 + the number of
// rows strictly ahead. Mirrors gate.js's own `ranked` exactly, kept as a local
// copy for the same reason that file keeps its venueKey local: it is eight
// lines, and exporting it would widen a module's surface for one caller.
function ranked(rows, field, { lowIsBest = false } = {}) {
  const usable = rows.filter((r) => r[field] != null)
  return rows.map((r) => {
    if (r[field] == null) return { ...r, rank: null, tied: false }
    const ahead = usable.filter((o) => (lowIsBest ? o[field] < r[field] : o[field] > r[field])).length
    const tied = usable.filter((o) => o[field] === r[field]).length > 1
    return { ...r, rank: ahead + 1, tied }
  })
}

function sortOn(rows, field, lowIsBest) {
  return [...rows].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (av == null) return 1
    if (bv == null) return -1
    return lowIsBest ? av - bv : bv - av
  })
}

// The club board's columns. `rate` leads because the interesting question is
// judgment, not appetite: a club that challenges twice a game and wins a third
// of them is telling on itself, and the raw count alone would put it top.
export const TEAM_SORTS = [
  { key: 'rate', label: 'Success rate', lowIsBest: false },
  { key: 'n', label: 'Challenges', lowIsBest: false },
  { key: 'perGame', label: 'Per game', lowIsBest: false },
  { key: 'success', label: 'Overturns', lowIsBest: false },
  // "Ran out" is games in which the club EMPTIED its bank, not games it
  // finished unable to argue. In a game that goes to extras those are
  // different facts: a club that ran out in the fifth is armed again in the
  // tenth, and the cost it paid — four innings unable to argue — is what the
  // column is for. The rule and the evidence are in scripts/lib/abs/bank.mjs.
  { key: 'ranOut', label: 'Games run out', lowIsBest: false },
]

// Every club that played a swept game, ranked on one column. A club with no
// challenges at all still appears — it is a real and interesting row, and a
// board that dropped it would report a league of twenty-nine clubs.
export function teamBoard(summary, sortBy = 'rate') {
  const sort = TEAM_SORTS.find((s) => s.key === sortBy) ?? TEAM_SORTS[0]
  const rows = (summary?.byTeam ?? []).map((r) => ({ ...r }))
  return sortOn(ranked(rows, sort.key, sort), sort.key, sort.lowIsBest)
}

// ONE CHIP PER QUESTION, AND IT NAMES A COLUMN RATHER THAN AN END OF ONE.
//
// The board used to sort one way at a time, so "Overturned most" and
// "Overturned least" were two different views and both were worth a chip. They
// stopped being two views the day the board grew a second tail: umpireTails
// shows the head AND the tail of whichever column is on, so the low chip
// returns the identical twelve men with the two ends swapped over. A control
// that promises a new view and re-prints the old one is worse than no control,
// because a reader who taps it concludes the data is broken.
//
// So the chip picks the COLUMN — the two ends of it come free — and the labels
// say so. Both ends of both questions are still reachable; nothing was
// removed from the board but the duplicate route to it.
export const UMPIRE_SORTS = [
  { key: 'rate', label: 'Overturn rate', lowIsBest: false },
  { key: 'perGame', label: 'Challenges drawn', lowIsBest: false },
]

// How many rows each end of the board shows.
export const UMPIRE_TAIL = 6

// BOTH TAILS ON ONE BOARD, and the count of everybody between them.
//
// The per-game column is drawn as a bar measured from the LEAGUE RATE rather
// than from zero, which is the only way 5.40 reads as "more" at a glance
// instead of as a number a reader has to hold the league average beside. A
// diverging bar earns that only if both sides of it are populated: a view that
// shows the loud end alone leaves the left half of every track permanently
// empty, and buys nothing over a plain bar.
//
// So the board shows the head and the tail of whichever sort is on, and says
// how many men are between them. THE MIDDLE IS NOT HIDDEN, IT IS COUNTED — and
// by construction it is the unremarkable part: an umpire near the league rate
// draws a stub either way, so a reader scrolling 75 of them learns nothing the
// count does not already say.
//
// A board too short to have two ends is returned whole, which is what the
// Triple-A level does on a thin sample.
//
// THE MIDDLE IS COUNTED, AND IT IS ALSO ONE TAP AWAY. The count alone was not
// enough: 75 of MLB's 87 qualifying umpires had no row, no rank and no link,
// and looking up the man working tonight's plate is the ordinary use of this
// board — a reader whose umpire is not in the twelve could not reach him at
// all. The page keeps the two-ended view as its default and offers the whole
// board behind a control under it (UmpireBoard.jsx), so the shape that makes
// the diverging bar readable is what a reader meets first, without walling off
// the other 75 men.
export function umpireTails(rows, tail = UMPIRE_TAIL) {
  const all = rows ?? []
  if (all.length <= tail * 2) return { head: all, tail: [], between: 0 }
  return { head: all.slice(0, tail), tail: all.slice(-tail), between: all.length - tail * 2 }
}

// The half-width the diverging bar is scaled to: the furthest any qualifying
// umpire sits from the league rate. Derived from the WHOLE qualifying board
// rather than from the rows on screen, so switching the sort re-orders the
// board without silently re-scaling every bar on it.
//
// Null when nothing qualifies or when every man sits exactly on the rate, in
// which case the caller draws no bar rather than dividing by zero.
export function umpireSpread(rows, league) {
  if (league == null) return null
  let widest = 0
  for (const r of rows ?? []) {
    if (r.perGame == null) continue
    const d = Math.abs(r.perGame - league)
    if (d > widest) widest = d
  }
  return widest > 0 ? widest : null
}

// Plate umpires who worked at least MIN_UMPIRE_GAMES swept games, ranked on
// the share of challenges against them that stood up.
//
// THIS IS NOT THE UMPIRE RANKINGS PAGE'S NUMBER, and the page says so twice:
// "challenged pitches only" under the column head, and the whole distinction in
// the source line at the foot (AbsChallengesPage.jsx). That
// board scores EVERY called pitch against the rule-book zone. This one scores
// only the pitches a player thought were wrong — a much smaller, self-selected
// set — so a man can rank well on one and poorly on the other without either
// being wrong.
export function umpireBoard(summary, sortBy = 'rate', minGames = MIN_UMPIRE_GAMES) {
  const sort = UMPIRE_SORTS.find((s) => s.key === sortBy) ?? UMPIRE_SORTS[0]
  const rows = (summary?.byUmpire ?? []).filter((u) => u.games >= minGames && u.n > 0)
  return sortOn(ranked(rows, sort.key, sort), sort.key, sort.lowIsBest)
}

// The players who call for the most reviews, and the ones who are right most
// often. Two boards from one list rather than one sorted two ways, because
// they answer different questions and a reader wants both open at once.
export function playerBoards(summary, minChallenges = MIN_PLAYER_CHALLENGES) {
  const all = (summary?.byPlayer ?? []).map((p) => ({ ...p }))
  const qualified = all.filter((p) => p.n >= minChallenges)
  return {
    byCount: sortOn(ranked(all, 'success'), 'success', false).slice(0, 10),
    byRate: sortOn(ranked(qualified, 'rate'), 'rate', false).slice(0, 10),
    qualified: qualified.length,
    minChallenges,
  }
}

// The call a role can challenge. A batter is challenging a called STRIKE
// against him; a catcher or a pitcher is challenging a called BALL. The two
// are not independent — this is why the page shows one table and not two.
export const ROLE_CALL = { batter: 'strike', catcher: 'ball', pitcher: 'ball', other: null }

export const ROLE_LABEL = {
  batter: 'Batter',
  catcher: 'Catcher',
  pitcher: 'Pitcher',
  other: 'Someone else',
}

// The same four, written to sit mid-sentence. Held as their own table rather
// than lower-cased at render: a component that case-folds rendered text can
// drift from the CSS caps invariant and mangles real names (ADR-0017,
// scripts/check-name-casing.mjs).
export const ROLE_IN_PROSE = {
  batter: 'the batter',
  catcher: 'the catcher',
  pitcher: 'the pitcher',
  other: 'the club',
}

// The role split, with the roles nobody used dropped. `other` should stay at
// zero — it is the bucket for a challenger the box score put at no
// recognisable position — so it appears only if it ever fills.
export function roleRows(summary) {
  return (summary?.byRole ?? []).filter((r) => r.n > 0)
}

// Whether the call-type split says anything the role split has not. It should
// not: the two are the same fact read twice (see ROLE_CALL). This returns the
// rows that BREAK that, so the page can print them if the feed ever produces
// one rather than quietly asserting a rule that stopped holding.
//
// Each row carries `off`, the signed distance between what the call split holds
// and what the role rows predict. The row's own `n` is the WHOLE bucket, which
// is not what disagrees — see callSplitOffBy.
export function callSplitAnomalies(summary) {
  const roles = summary?.byRole ?? []
  const calls = summary?.byCall ?? []
  const expected = { strike: 0, ball: 0 }
  for (const r of roles) {
    const call = ROLE_CALL[r.role]
    if (call) expected[call] += r.n
  }
  return calls
    .map((c) => ({ ...c, off: c.n - (expected[c.callType] ?? 0) }))
    .filter((c) => c.off !== 0)
}

// HOW MANY CHALLENGES THE DISAGREEMENT IS WORTH, which is not the size of the
// rows that disagree. A bucket holding one challenge it should not hold still
// holds every challenge it should, so printing its `n` reports a whole season's
// worth of calls as broken — 4,813 for a single miscoded row on the Triple-A
// board, which is the sort of number that makes a reader distrust the page it
// was meant to keep honest.
//
// Neither is it the sum of the rows' `off`. ONE misfiled challenge moves two of
// them: it leaves the bucket it belonged in and lands in the one it did not, so
// adding counts it twice. The larger of the two sides is the smallest number of
// challenges that explains what the feed printed, and it stays right in the
// other case as well — a challenger at no recognisable position is predicted
// into no bucket at all, leaving the call split one row heavy and nothing light.
export function callSplitOffBy(anomalies) {
  let over = 0
  let under = 0
  for (const a of anomalies ?? []) {
    if (a.off > 0) over += a.off
    else under -= a.off
  }
  return Math.max(over, under)
}

// THE LAST INNING IN WHICH RUNNING OUT IS STILL "EARLY". A club is issued two
// challenges, so a second loss in the sixth is a club that enters the seventh
// unable to argue a pitch — which is the strategic cost the club board's
// `ranOutEarly` column counts.
//
// IT IS THE SAME NUMBER AS LAST_EARLY_INNING in scripts/lib/abs/export.mjs,
// held twice because the export half runs in Node and this half runs in the
// browser, and nothing can be imported across that line. The two are pinned
// together by a test rather than by a comment: every club's `ranOutEarly`
// added up equals the nights this constant admits, so the day one moves
// without the other, the suite says so (test/abs-challenges.test.js).
export const RAN_OUT_EARLY_THROUGH = 6

// OUT OF CHALLENGES — the nights, read as the page shows them.
//
// The file ships the whole distribution of first emptyings and the rows of the
// earliest inning that has any (ranout.mjs). This turns that into shares, and
// splits the season into the clubs that emptied early and the ones that
// emptied late, which is the context the band needs: nine first-inning nights
// read as a scandal until you see that most clubs which run out do it in the
// eighth or the ninth, having spent their challenges on a game still in front
// of them.
//
// A BAND, NOT A TOP TEN, and the reason is in ranout.mjs: eighteen club-games
// tie for tenth. Nothing here re-cuts the band, because a cut applied twice is
// a cut nobody can find.
//
// Null when the level has no emptied club-game at all, which is what a page
// draws nothing for rather than an empty board.
export function ranOutNights(summary) {
  const src = summary?.ranOutNights
  if (!src || src.earliest == null) return null
  const emptied = src.emptied ?? 0
  const early = (src.byInning ?? [])
    .filter((b) => b.inning <= RAN_OUT_EARLY_THROUGH)
    .reduce((n, b) => n + b.n, 0)
  return {
    earliest: src.earliest,
    band: src.band ?? [],
    emptied,
    clubGames: src.clubGames ?? 0,
    share: src.clubGames > 0 ? emptied / src.clubGames : null,
    byInning: (src.byInning ?? []).map((b) => ({
      ...b,
      share: emptied > 0 ? b.n / emptied : null,
    })),
    early,
    late: emptied - early,
  }
}

// A RUN OF ONE IS NOT A RUN. Every man who ever won a challenge has a "run"
// of at least one, so a board whose longest is one is a list of everybody who
// was ever right, sorted by nothing. Two is the shortest thing worth printing,
// and a board that cannot reach it is not offered at all — which is what
// happens to the pitchers' in-game loss board, where the rulebook allows one
// loss per pitcher and no more.
export const STREAK_MIN_RUN = 2

// The roles a streak board can be grouped by, in the order the page offers
// them. `other` is the bucket for a challenger the box score put at no
// recognisable position and is expected to stay empty here; it is listed so
// that the day it fills, the board shows it rather than silently dropping men.
const STREAK_ROLE_ORDER = ['batter', 'catcher', 'pitcher', 'other']

// ONE STREAK BOARD — one outcome, one scope, one role.
//
// The file ships the twelve longest runs and the FULL distribution behind them
// (streaks.mjs), because the names below the cut cost a hundred kilobytes and
// the shape does not. So this reads the shape back: `tiedBelow` is how many men
// share the shortest run on screen without appearing, and `unshown` is
// everybody the board does not name. A reader looking at four men tied at three
// has to know whether forty more are tied with them.
//
// Null when the board cannot reach STREAK_MIN_RUN, which is a board with
// nothing to rank rather than an empty one to draw.
export function streakBoard(summary, key, role) {
  const board = summary?.streaks?.boards?.[key]?.[role]
  if (!board || (board.max ?? 0) < STREAK_MIN_RUN) return null
  const rows = board.rows ?? []
  const cut = rows.length ? rows[rows.length - 1].run : 0
  const shownAtCut = rows.filter((r) => r.run === cut).length
  const atCut = board.reached?.find((r) => r.run === cut)?.n ?? 0
  return {
    key,
    role,
    rows,
    max: board.max,
    cut,
    tiedBelow: Math.max(atCut - shownAtCut, 0),
    unshown: Math.max((board.players ?? 0) - rows.length, 0),
    reached: board.reached ?? [],
  }
}

// Which roles have a board worth drawing for this cut, in page order.
export function streakRoles(summary, key) {
  return STREAK_ROLE_ORDER.filter((role) => streakBoard(summary, key, role) !== null)
}

// HOW LONG A RUN OF LOSSES INSIDE ONE GAME CAN GET — read off the season, never
// stated as a rule.
//
// The rulebook looks like it settles this: a club is issued two challenges and
// loses one each time the call stands, so two in a row ends the night. That is
// true in regulation and false after it. A club that has run out is armed again
// in every extra inning, and Triple-A's rows carry catchers who lost three in a
// row because of it. A page that printed "two is the rule, not a record" would
// be wrong the moment its own level chip moved.
//
// So it returns what the season did: the longest such run, and how many men
// reached it.
export function inGameLossCap(summary) {
  const boards = summary?.streaks?.boards?.gameLoss ?? {}
  let max = 0
  for (const board of Object.values(boards)) {
    if ((board.max ?? 0) > max) max = board.max
  }
  if (max === 0) return null
  let players = 0
  for (const board of Object.values(boards)) {
    players += board.reached?.find((r) => r.run === max)?.n ?? 0
  }
  return { max, players }
}

// Percentage of the season's challenges that fell in each distance band, so
// the page can draw the shape of the distribution rather than five raw counts.
export function missBands(summary) {
  const bands = summary?.byMiss ?? []
  const total = bands.reduce((n, b) => n + b.n, 0)
  return bands.map((b) => ({ ...b, share: total > 0 ? b.n / total : null }))
}
