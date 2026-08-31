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

export const UMPIRE_SORTS = [
  { key: 'rate', label: 'Overturned most', lowIsBest: false },
  { key: 'rateLow', label: 'Overturned least', lowIsBest: true, field: 'rate' },
  { key: 'perGame', label: 'Challenges drawn', lowIsBest: false },
]

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
  const field = sort.field ?? sort.key
  const rows = (summary?.byUmpire ?? []).filter((u) => u.games >= minGames && u.n > 0)
  return sortOn(ranked(rows, field, sort), field, sort.lowIsBest)
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

// Percentage of the season's challenges that fell in each distance band, so
// the page can draw the shape of the distribution rather than five raw counts.
export function missBands(summary) {
  const bands = summary?.byMiss ?? []
  const total = bands.reduce((n, b) => n + b.n, 0)
  return bands.map((b) => ({ ...b, share: total > 0 ? b.n / total : null }))
}
