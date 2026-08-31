// The reader behind /run-value — a season's RUN VALUE, the one scale that puts
// batting, fielding, baserunning and pitching in the same units. Read from the
// static file scripts/gen-run-value.mjs sweeps from Baseball Savant each night.
//
// WHAT THE NUMBER MEANS. Savant scores an event by how much it changed the runs
// an average team would go on to score from that base/out/count state. A season
// of those, summed, is runs above average — so +36 with the bat and +24 with
// the glove are the same +36 and +24, and adding them is a real sentence rather
// than an index. That is the whole reason this page exists: a centre fielder's
// glove and a starter's arm have never had a common scale in this app.
//
// CONTEXT NEUTRAL. Every event is scored off the generic run-expectancy table,
// never off the leverage of the game it happened in — see the generator's
// header. So this says how much a player DID, not how much it happened to be
// worth to his club's record on the night.
//
// SPOILER-FREE. A season aggregate over completed games, off a nightly file:
// the same footing as war.js, absChallenges.js and the rest of the open
// surfaces (ADR-0034). No per-game result can be read back out of a season
// total, and nothing here is fetched on a scoring surface.
//
// THE FILE SHIPS FACTS; EVERY COMPARISON LIVES HERE. run-value.json holds four
// numbers per player and nothing else — no total, no rank, no qualification
// floor. Totalling, ranking, the floors that decide who reaches a board, and
// the club roll-up are all derived below, pure and unit-tested
// (test/run-value.test.js), and changeable without regenerating the file. Same
// split gate.js keeps with gen-gate.mjs.

import { staticJson } from '../staticJson.js'

export const fetchRunValue = staticJson('/data/run-value.json', {
  fallback: { season: null, generatedAt: null, players: [] },
})

// The four components, in the order every surface prints them: what he did at
// the plate, in the field, on the bases, on the mound. That order is the
// baseball order — it walks a player through a game rather than sorting by how
// big the numbers tend to be — and holding it in one place is what stops the
// report board, the player card and the club card from each choosing their own.
//
// `short` is for a column head with no room, and the key under the board pairs
// it back with `label` so no column is available only as an abbreviation. There
// is no third field for a definition of the component: the page prints the key
// and nothing else now, and an `about`-style sentence that no surface renders is
// a comment claiming a consumer it does not have. If one is ever wanted again,
// it belongs in docs/ or in the surface that prints it.
//
// `inProse` is the same word mid-sentence, written out rather than lower-cased
// from `label` at the call site — the convention absChallenges.js's
// ROLE_IN_PROSE already sets, and the one check-name-casing.mjs exists to
// enforce (ADR-0017): a `.toLowerCase()` on rendered text is redundant with the
// CSS invariant and drifts from it on real Unicode.
export const COMPONENTS = [
  {
    key: 'bat',
    label: 'Batting',
    short: 'Bat',
    inProse: 'batting',
  },
  {
    key: 'fld',
    label: 'Defense',
    short: 'Def',
    inProse: 'defense',
  },
  {
    key: 'run',
    label: 'Running',
    short: 'Run',
    inProse: 'baserunning',
  },
  {
    key: 'pit',
    label: 'Pitching',
    short: 'Pit',
    inProse: 'pitching',
  },
]

// A player's four components added up. Kept as a function rather than stored in
// the file so the components and the total can never disagree: change a floor
// or a component here and the total follows.
export function total(p) {
  if (!p) return 0
  return (p.bat ?? 0) + (p.fld ?? 0) + (p.run ?? 0) + (p.pit ?? 0)
}

// Whole runs, signed — how Savant's own player pages print it and how the
// figure is read aloud. "+0" for a component a player has none of is deliberate
// and not a gap: a designated hitter really did field zero runs' worth, and a
// dash there would read as missing data. `-0` is a real rounding outcome for a
// small negative and is printed as `0`, since a reader is being told "nothing",
// not "very slightly below nothing".
export function signed(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const r = Math.round(n)
  if (r === 0) return '0'
  return r > 0 ? `+${r}` : String(r)
}

// Which way a figure leans, for the ink. Zero is neither — a component a player
// never had is not a weakness.
export function tone(n) {
  const r = Math.round(n ?? 0)
  if (r > 0) return 'up'
  if (r < 0) return 'down'
  return 'flat'
}

// THE ROLE SPLIT, and why it is drawn on the numbers rather than on a position.
// A leaderboard of everyone is the honest one and is the default. But a reader
// who wants "the best season by a pitcher" is asking a real question, and
// `pos === 'P'` answers it badly: a two-way player is 'TWP', a reliever who has
// taken an at-bat is still 'P', and a position player who mopped up an inning
// is not a pitcher at all. What actually separates them is where the value came
// from — so a pitcher is a player whose mound work is the larger half of what
// he did, and a position player is everyone else. Ohtani lands in whichever
// half his own season puts him, which is the correct answer and the only one
// that stays correct as a season moves.
export const ROLES = [
  { key: 'all', label: 'Everyone', inProse: 'players' },
  { key: 'position', label: 'Position players', inProse: 'position players' },
  { key: 'pitchers', label: 'Pitchers', inProse: 'pitchers' },
]

export function isPitcher(p) {
  return Math.abs(p?.pit ?? 0) > Math.abs((p?.bat ?? 0) + (p?.fld ?? 0) + (p?.run ?? 0))
}

function inRole(p, role) {
  if (role === 'pitchers') return isPitcher(p)
  if (role === 'position') return !isPitcher(p)
  return true
}

// THE FLOOR. Without one the foot of the board fills with September call-ups
// who are a fraction of a run from average on twenty plate appearances — true,
// and not what anybody came to read. A run of ANY size in either direction is
// the cheapest honest filter: a player who has not moved a run yet has not yet
// done anything this board can rank. It is stated on the page, never applied
// silently.
export const MIN_ABS_RUNS = 1

function qualified(players) {
  return (players ?? []).filter((p) => Math.abs(total(p)) >= MIN_ABS_RUNS)
}

// Rank on one field, ties sharing the best rank — 1 + the number strictly
// ahead — returned best-first. Same contract as absChallenges.js's own
// `ranked`, kept local for the reason that file gives: it is a dozen lines, and
// exporting it would widen a module's surface for one caller.
//
// SORT-THEN-WALK, not the nested filter that file uses, and the difference
// matters here: this board is ~1,400 players against that one's thirty clubs,
// and the nested form is quadratic — several million comparisons on every
// render of a player page that wants one man's rank. Sorted, the rank of a row
// is its index unless the row above carries the same value, in which case it
// inherits that row's.
//
// TIES ARE ON THE RAW VALUE, not the whole runs the board prints. Two players
// both shown at +36 are 7th and 8th, not both 7th — which is how the figures
// are published, and the honest reading: they are not actually level, they are
// a tenth of a run apart.
function ranked(rows, valueOf) {
  const sorted = rows.map((row) => ({ row, value: valueOf(row) })).sort((a, b) => b.value - a.value)
  const out = []
  for (let i = 0; i < sorted.length; i++) {
    const { row, value } = sorted[i]
    const sameAsAbove = i > 0 && sorted[i - 1].value === value
    const sameAsBelow = i + 1 < sorted.length && sorted[i + 1].value === value
    out.push({
      ...row,
      value,
      rank: sameAsAbove ? out[i - 1].rank : i + 1,
      tied: sameAsAbove || sameAsBelow,
    })
  }
  return out
}

// THE MAIN BOARD. Every qualified player in one role, ranked by total, best
// first — or worst first when `direction` is 'asc', which is the same board
// read from the other end and is genuinely interesting: a season's worst run
// value is a harder thing to do than an average one.
//
// The rank is always computed best-first, so a row read from the bottom still
// announces where it stands in the league rather than how far up from last it
// is.
export function board(data, { role = 'all', teamId = null, direction = 'desc', limit = null } = {}) {
  let rows = qualified(data?.players).filter((p) => inRole(p, role))
  if (teamId != null) rows = rows.filter((p) => p.teamId === Number(teamId))
  const withRank = ranked(rows, total).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  const ordered = direction === 'asc' ? [...withRank].reverse() : withRank
  return limit == null ? ordered : ordered.slice(0, limit)
}

// One component's own leaderboard — the best bat, the best glove, the best
// legs, the best arm. Ranked WITHIN the component, and against everyone rather
// than within a role: the best fielding season in baseball is the best fielding
// season in baseball, whoever it belongs to.
//
// No `qualified` here, on purpose. That floor asks whether a player has moved a
// run overall; this board asks about one skill, and a player whose total is
// under a run can still lead the league in fielding.
export function componentBoard(data, key, { limit = 5 } = {}) {
  const rows = (data?.players ?? []).filter((p) => Math.abs(p[key] ?? 0) >= MIN_ABS_RUNS)
  return ranked(rows, (p) => p[key] ?? 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, limit)
}

// ONE PLAYER, with his league standing — what the player page's card prints.
// The rank is against every qualified player of HIS role, not against the whole
// league: "31st among pitchers" is a sentence a reader can use, while "112th of
// everyone" mixes a reliever in with a shortstop's glove and says very little.
// Null when he is not in the file at all (a minor-leaguer, or a debut since
// last night's sweep), which the card degrades to not rendering.
export function playerRunValue(data, personId) {
  const id = Number(personId)
  const p = (data?.players ?? []).find((row) => row.id === id)
  if (!p) return null
  const role = isPitcher(p) ? 'pitchers' : 'position'
  const peers = board(data, { role })
  const seat = peers.find((row) => row.id === id)
  return {
    ...p,
    total: total(p),
    role,
    roleInProse: ROLES.find((r) => r.key === role)?.inProse ?? '',
    // A player under MIN_ABS_RUNS has no seat on the board and so no rank — the
    // card still prints his four components, which is the honest answer.
    rank: seat?.rank ?? null,
    tied: seat?.tied ?? false,
    of: peers.length,
  }
}

// A CLUB'S OWN LEDGER — its four component sums and its best few players, for
// the team hub. `players` is every man on the club in the file, ranked by
// total, so the caller can take as many as its card has room for.
//
// The club totals are summed over the FILE's rows, which means a player traded
// in July contributes to whichever club he is currently listed with, not to the
// two he split the season between. Savant's boards carry one current club per
// player and no split, so this is the only reading available; the card says
// "current roster" rather than claiming to be a club's season.
export function clubRunValue(data, teamId) {
  const id = Number(teamId)
  const rows = (data?.players ?? []).filter((p) => p.teamId === id)
  if (!rows.length) return null
  const sums = { bat: 0, fld: 0, run: 0, pit: 0 }
  for (const p of rows) for (const c of COMPONENTS) sums[c.key] += p[c.key] ?? 0
  return {
    teamId: id,
    ...sums,
    total: sums.bat + sums.fld + sums.run + sums.pit,
    players: rows
      .map((p) => ({ ...p, total: total(p) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
  }
}

// Every club that has a player in the file, ranked by club total — the report
// page's club rail, and the rank a club card prints beside its own figure.
export function clubBoard(data) {
  const byTeam = new Map()
  for (const p of data?.players ?? []) {
    if (p.teamId == null) continue
    if (!byTeam.has(p.teamId)) byTeam.set(p.teamId, { teamId: p.teamId, bat: 0, fld: 0, run: 0, pit: 0, n: 0 })
    const row = byTeam.get(p.teamId)
    for (const c of COMPONENTS) row[c.key] += p[c.key] ?? 0
    row.n++
  }
  const rows = [...byTeam.values()].map((r) => ({ ...r, total: r.bat + r.fld + r.run + r.pit }))
  return ranked(rows, (r) => r.total).sort((a, b) => b.value - a.value)
}
