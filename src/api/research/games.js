// THE GAME MODE of /research (#3137, Gary 2026-11-16): plays grouped by game and by the
// batting club, then tested on that club's totals and on how its runs scored. One row is
// one club's batting half of one game ("club-game"). The Batting club picker names the
// batting side; the Pitching club picker names the side in the field, so "Pitching club:
// Brewers, runs 6" is a game the Brewers allowed 6. The URL is the play mode's plus
// `mode=game`, a range per total (`gr=6-6`, `ghr=2-`, `gso=-9`: either end may be blank)
// and `how` (the "How runs scored" card, every picked condition must hold).
//
// RUNS. A plate appearance's `runs` sums the store's per-pitch rs over all its pitches, so
// a wild pitch or a steal of home inside a PA still counts toward the total; its
// `eventRuns` are the runs on the play itself. "How runs scored" reads eventRuns: a run
// that scored between plays is on no play, so it breaks "all on home runs" and is no hit.
// A run that scored with no PA after it in the half (a pickoff ends the inning) is lost to
// the PA count; THE CHECK: a game whose two clubs' runs do not give its final margin (shard.js
// `finalMargin`, from the game's last pitch) is left out of every answer and counted (`leftOut`).
//
// SPOILER CLASSIFICATION: spoiler-free. Pure functions over the store (ADR-0034). A row
// carries the totals the query filtered on, never the final score.

import { FILTER_BY_KEY } from './filters.js'

const HITS = new Set(['single', 'double', 'triple', 'home_run'])
const WALKS = new Set(['walk', 'intent_walk'])
const STRIKEOUTS = new Set(['strikeout', 'strikeout_double_play'])

// The Totals cards: key (URL `g{key}`), the label from each side, and the club-game field.
export const TOTALS = [
  { key: 'r', label: 'Runs', allowed: 'Runs allowed', short: 'R' },
  { key: 'h', label: 'Hits', allowed: 'Hits allowed', short: 'H' },
  { key: 'hr', label: 'Home runs', allowed: 'Home runs allowed', short: 'HR' },
  { key: 'bb', label: 'Walks', allowed: 'Walks issued', short: 'BB' },
  { key: 'so', label: 'Strikeouts', allowed: 'Strikeouts (pitching)', short: 'SO' },
  { key: 'pi', label: 'Pitches seen', allowed: 'Pitches thrown', short: 'Pitches' },
]
const FIELD = { r: 'runs', h: 'hits', hr: 'hr', bb: 'bb', so: 'so', pi: 'pitches' }
export const totalOf = (g, key) => g[FIELD[key]]

// The "How runs scored" card. Each needs at least one run. `scoring` is the club-game's
// plays with a run on the play; `between` the runs that scored between plays.
export const HOW = [
  ['hr', 'All on home runs', (g) => !g.between && g.scoring.every((p) => p.event === 'home_run')],
  ['solo', 'All on solo home runs', (g) => !g.between && g.scoring.every((p) => p.event === 'home_run' && p.runners === 0)],
  ['nohit', 'None on a hit', (g) => g.scoring.every((p) => !HITS.has(p.event))],
  ['nohr', 'None on a home run', (g) => g.scoring.every((p) => p.event !== 'home_run')],
  ['oneinn', 'All in one inning', (g) => new Set(g.scoringPas.map((p) => p.inning)).size === 1],
  ['late', 'All after the 7th', (g) => g.scoringPas.every((p) => p.inning > 7)],
  ['twoout', 'All with two outs', (g) => g.scoringPas.every((p) => p.outs === 2)],
  ['err', 'Any on an error', (g) => g.scoring.some((p) => p.event === 'field_error')],
  ['onebat', 'All driven in by one batter', (g) => !g.between && new Set(g.scoring.map((p) => p.batter)).size === 1],
]
const HOW_BY_KEY = Object.fromEntries(HOW.map(([k, , t]) => [k, t]))
export const HOW_INFO = 'Reads the play each run scored on. A run that scored between plays, on a wild pitch, a balk or a steal of home, is on no play: it breaks “All on home runs”, “All on solo home runs” and “All driven in by one batter”. Any on an error: a batter who reached on an error, not the official earned-run call. Inning and outs are when the plate appearance began.'

// The card keys a game query keeps from the play mode: the ones that describe a whole game.
export const GAME_CHIPS = ['gt', 'mon', 'ha']

const RANGE = /^(\d{0,3})-(\d{0,3})$|^(\d{1,3})$/
function parseRange(v) {
  const m = RANGE.exec(v ?? '')
  if (!m) return null
  if (m[3]) return [Number(m[3]), Number(m[3])]
  const lo = m[1] === '' ? null : Number(m[1])
  const hi = m[2] === '' ? null : Number(m[2])
  return lo == null && hi == null ? null : [lo, hi]
}
const rangeText = ([lo, hi]) => `${lo ?? ''}-${hi ?? ''}`

// The game half of the query, or null when the URL is not in game mode.
export function parseGameQuery(search) {
  const p = new URLSearchParams(search)
  if (p.get('mode') !== 'game') return null
  const totals = {}
  for (const t of TOTALS) {
    const r = parseRange(p.get(`g${t.key}`))
    if (r) totals[t.key] = r
  }
  const how = (p.get('how') ?? '').split('.').filter((k) => HOW_BY_KEY[k])
  return { totals, how }
}

// The game params (without `mode`), in TOTALS order, for buildQuery.
export function buildGameParams(g) {
  const p = new URLSearchParams()
  for (const t of TOTALS) if (g.totals[t.key]) p.set(`g${t.key}`, rangeText(g.totals[t.key]))
  if (g.how.length) p.set('how', g.how.join('.'))
  return p
}

// A range in words for a pill: "6", "6+", "≤3", "2–4".
export const rangeWords = ([lo, hi]) => (lo === hi ? `${lo}` : hi == null ? `${lo}+` : lo == null ? `≤${hi}` : `${lo}–${hi}`)

// The picked club is the subject: the Pitching club when set (its numbers are "allowed").
export const pitchingSide = (q) => Boolean(q.pitchTeam)
export const subjectOf = (q, g) => (pitchingSide(q) ? g.fieldTeam : g.batTeam)

export const isGameBlank = (q) => !Object.keys(q.g?.totals ?? {}).length && !q.g?.how?.length && !q.team && !q.pitchTeam && !q.park

// Plate appearances (one or more seasons, oldest first) -> club-games, oldest first, and
// the number of games left out by THE CHECK (header).
export function clubGames(pas) {
  const byGame = new Map()
  for (const pa of pas) {
    if (!byGame.has(pa.gamePk)) byGame.set(pa.gamePk, [])
    byGame.get(pa.gamePk).push(pa)
  }
  const games = []
  let leftOut = 0
  for (const plays of byGame.values()) {
    const sides = new Map()
    for (const pa of plays) {
      if (!sides.has(pa.batTeam)) {
        const { gamePk, date, gameType, home, away, gameNumber, batTeam, fieldTeam, top } = pa
        sides.set(batTeam, { key: `${gamePk}-${batTeam}`, gamePk, date, gameType, home, away, gameNumber, batTeam, fieldTeam, top, runs: 0, hits: 0, hr: 0, bb: 0, so: 0, pitches: 0, between: 0, scoring: [], scoringPas: [] })
      }
      const s = sides.get(pa.batTeam)
      s.runs = pa.runs == null || s.runs == null ? null : s.runs + pa.runs
      if (HITS.has(pa.event)) s.hits++
      if (pa.event === 'home_run') s.hr++
      if (WALKS.has(pa.event)) s.bb++
      if (STRIKEOUTS.has(pa.event)) s.so++
      // A history PA with no pitch string (#3163) leaves the club-game's pitches unknown.
      s.pitches = pa.nPitches == null || s.pitches == null ? null : s.pitches + pa.nPitches
      if (pa.runs > 0) s.scoringPas.push(pa)
      if (pa.eventRuns > 0) s.scoring.push(pa)
      if (pa.runs != null && pa.eventRuns != null) s.between += pa.runs - pa.eventRuns
    }
    const last = plays.at(-1)
    const [a, h] = [sides.get(last.away), sides.get(last.home)]
    const final = last.finalMargin ?? null
    if (!a || !h || a.runs == null || h.runs == null || final == null || a.runs - h.runs !== final) {
      leftOut++
      continue
    }
    games.push(a, h)
  }
  return { games, leftOut }
}

// The predicate for the game half of a query (totals and how), over a club-game.
export function gameMatcher(q) {
  const tests = Object.entries(q.g?.totals ?? {}).map(([k, [lo, hi]]) => (g) => {
    const v = totalOf(g, k)
    return v != null && (lo == null || v >= lo) && (hi == null || v <= hi)
  })
  for (const k of q.g?.how ?? []) tests.push((g) => g.runs > 0 && HOW_BY_KEY[k](g))
  return (g) => tests.every((t) => t(g))
}

// The rest of the query over a club-game: clubs, park, the game-level cards, the cutoff.
// An All-Star game counts only when the Game type card picks it (the play mode's rule).
function scopeMatcher(q, cutoff) {
  const tests = GAME_CHIPS.filter((k) => q.chips?.[k]?.vals.length).map((k) => {
    const c = q.chips[k]
    const want = new Set(c.vals)
    return (g) => FILTER_BY_KEY[k].values(g).some((v) => want.has(v)) !== Boolean(c.inv)
  })
  const gt = q.chips?.gt
  if (!(gt && !gt.inv && gt.vals.includes('A'))) tests.push((g) => g.gameType !== 'A')
  if (q.team) tests.push((g) => g.batTeam === q.team)
  if (q.pitchTeam) tests.push((g) => g.fieldTeam === q.pitchTeam)
  if (q.park) tests.push((g) => g.home === q.park)
  if (cutoff) tests.push((g) => g.date < cutoff)
  return (g) => tests.every((t) => t(g))
}

// pas: plate appearances, oldest first. `matchesOnly` for "Last time" season by season.
export function answerGames(pas, q, cutoff, { matchesOnly = false } = {}) {
  const { games, leftOut } = clubGames(pas)
  const inScope = scopeMatcher(q, cutoff)
  const isMatch = gameMatcher(q)
  const scoped = games.filter(inScope)
  const matches = scoped.filter(isMatch).reverse()
  if (matchesOnly) return { matches, leftOut }
  return summarizeGames(matches, scoped.length, leftOut, q)
}

// The answer for club-game matches, newest first. Each gains `ordinal`: the subject club's
// nth such game in the searched range, counted oldest first. `base`: club-games in scope.
export function summarizeGames(matches, base = null, leftOut = 0, q = {}) {
  const seen = new Map()
  const rows = new Array(matches.length)
  for (let i = matches.length - 1; i >= 0; i--) {
    const club = subjectOf(q, matches[i])
    seen.set(club, (seen.get(club) ?? 0) + 1)
    rows[i] = { ...matches[i], club, ordinal: seen.get(club) }
  }
  const clubs = [...seen].map(([club, n]) => ({ club, n })).sort((a, b) => b.n - a.n || a.club.localeCompare(b.club)).slice(0, 10)
  return { matches: rows, base, leftOut, clubs }
}

// PLAYER-GAME LINES (#3156, step 3 of #3137; #3142's streaks build on it). One line per
// batter (`role: 'bat'`) and per pitcher (`role: 'pit'`) per game, oldest game first, and
// `leftOut`: games THE CHECK drops, as in clubGames. A batter's `runsOn` is the runs on his
// plays (eventRuns): near RBI, not the official call (a run on an error counts). A pitcher's
// `runs` are every run his club allowed during his plate appearances, earned or not, and
// `starter` marks the first pitcher his club used in the game.
export function playerGames(pas) {
  const { games, leftOut } = clubGames(pas)
  const kept = new Set(games.map((g) => g.gamePk))
  const lines = new Map()
  const pitched = new Set()
  for (const pa of pas) {
    if (!kept.has(pa.gamePk)) continue
    const { gamePk, date, gameType, home, away } = pa
    const line = (role, player, team) => {
      const k = `${gamePk}-${role}-${player}`
      if (!lines.has(k)) {
        const base = { key: k, gamePk, date, gameType, home, away, role, player, team, h: 0, hr: 0, bb: 0, so: 0 }
        // The first line a club's pitching side opens in a game is its starter's.
        const side = `${gamePk}-${team}`
        const starter = role === 'pit' && !pitched.has(side)
        if (role === 'pit') pitched.add(side)
        lines.set(k, role === 'bat' ? { ...base, pa: 0, runsOn: 0 } : { ...base, bf: 0, pitches: 0, runs: 0, starter })
      }
      return lines.get(k)
    }
    const b = line('bat', pa.batter, pa.batTeam)
    const p = line('pit', pa.pitcher, pa.fieldTeam)
    b.pa++
    p.bf++
    p.pitches = pa.nPitches == null || p.pitches == null ? null : p.pitches + pa.nPitches
    b.runsOn += pa.eventRuns ?? 0
    p.runs += pa.runs ?? 0
    for (const l of [b, p]) {
      if (HITS.has(pa.event)) l.h++
      if (pa.event === 'home_run') l.hr++
      if (WALKS.has(pa.event)) l.bb++
      if (STRIKEOUTS.has(pa.event)) l.so++
    }
  }
  return { lines: [...lines.values()], leftOut }
}
