// THE STREAKS MODE of /research (#3142, Gary 2026-11-17): the longest runs of a player's
// consecutive games that match every stat card. Built on games.js playerGames (one line per
// player per game). Rules (Gary, 2026-11-16): a streak carries across seasons; only games
// the player appeared in count, so a game he sat out neither extends nor breaks it; a run
// still going in the latest season searched is `active`. "Starts only" skips relief games
// the same way. All-Star games are always skipped; the postseason only counts when the Game
// type card picks it [DECISION: regular season by default, the way a hitting streak is kept].
//
// The search feeds seasons oldest first (`streakRun(...).feed(lines)` per season, the
// season freed after), so only each player's running streak and the top list stay in memory.
// URL: `mode=streak`, `side=pit` (batters by default), a range per stat (`sso=10-`,
// `sruns=-0`) and `st=1` for Starts only. The person is `bat` or `pit`, the club `team`.
//
// SPOILER CLASSIFICATION: spoiler-free. Pure functions over the store (ADR-0034).

// The stat cards per side: key (URL `s{key}`, the line's field), label, unit words.
export const STREAK_STATS = {
  bat: [
    { key: 'pa', label: 'Plate appearances', units: ['PA', 'PA'] },
    { key: 'h', label: 'Hits', units: ['hit', 'hits'] },
    { key: 'hr', label: 'Home runs', units: ['home run', 'home runs'] },
    { key: 'bb', label: 'Walks', units: ['walk', 'walks'] },
    { key: 'so', label: 'Strikeouts', units: ['strikeout', 'strikeouts'] },
    { key: 'runsOn', label: 'Runs driven in', units: ['run driven in', 'runs driven in'] },
  ],
  pit: [
    { key: 'so', label: 'Strikeouts', units: ['strikeout', 'strikeouts'] },
    { key: 'runs', label: 'Runs allowed', units: ['run allowed', 'runs allowed'] },
    { key: 'h', label: 'Hits allowed', units: ['hit allowed', 'hits allowed'] },
    { key: 'bb', label: 'Walks issued', units: ['walk', 'walks'] },
    { key: 'hr', label: 'Home runs allowed', units: ['home run allowed', 'home runs allowed'] },
    { key: 'pitches', label: 'Pitches', units: ['pitch', 'pitches'] },
    { key: 'bf', label: 'Batters faced', units: ['batter faced', 'batters faced'] },
  ],
}
export const RUNS_INFO = 'Runs driven in: the runs that scored on his plate appearances. Close to RBI but not the official call: a run on an error counts, and a run on a wild pitch during his turn does not.'

// The scope cards a streak query keeps from the play mode.
export const STREAK_CHIPS = ['gt']
export const TOP = 25

const RANGE = /^(\d{0,3})-(\d{0,3})$|^(\d{1,3})$/
function parseRange(v) {
  const m = RANGE.exec(v ?? '')
  if (!m) return null
  if (m[3]) return [Number(m[3]), Number(m[3])]
  const lo = m[1] === '' ? null : Number(m[1])
  const hi = m[2] === '' ? null : Number(m[2])
  return lo == null && hi == null ? null : [lo, hi]
}

// The streak half of the query, or null when the URL is not in streak mode.
export function parseStreakQuery(search) {
  const p = new URLSearchParams(search)
  if (p.get('mode') !== 'streak') return null
  const side = p.get('side') === 'pit' ? 'pit' : 'bat'
  const totals = {}
  for (const t of STREAK_STATS[side]) {
    const r = parseRange(p.get(`s${t.key}`))
    if (r) totals[t.key] = r
  }
  return { side, totals, starts: side === 'pit' && p.get('st') === '1' }
}

// The streak params (without `mode`), for buildQuery.
export function buildStreakParams(s) {
  const p = new URLSearchParams()
  if (s.side === 'pit') p.set('side', 'pit')
  for (const t of STREAK_STATS[s.side]) {
    const r = s.totals[t.key]
    if (r) p.set(`s${t.key}`, `${r[0] ?? ''}-${r[1] ?? ''}`)
  }
  if (s.side === 'pit' && s.starts) p.set('st', '1')
  return p
}

const bounded = (r) => r && r.some((v) => v != null)
export const isStreakBlank = (q) => !Object.values(q.s?.totals ?? {}).some(bounded)

// The person a streak query names: the Batter or the Pitcher picker, by side.
export const streakPerson = (q) => (q.s?.side === 'pit' ? q.pitcher : q.batter)

// Does a line match every stat card?
export function streakMatcher(q) {
  const tests = Object.entries(q.s?.totals ?? {}).filter(([, r]) => bounded(r)).map(([k, [lo, hi]]) => (l) => {
    const v = l[k]
    return v != null && (lo == null || v >= lo) && (hi == null || v <= hi)
  })
  return (l) => tests.every((t) => t(l))
}

// Does a line count at all (match or break)? The side, Starts only, the person, the game
// type and the cutoff. A line that does not count is skipped: it neither extends nor breaks.
function counts(q, cutoff) {
  const side = q.s?.side ?? 'bat'
  const gt = q.chips?.gt?.vals.length ? q.chips.gt : null
  const types = gt ? new Set(gt.vals) : null
  const person = streakPerson(q)
  return (l) => {
    if (l.role !== side) return false
    if (side === 'pit' && q.s.starts && !l.starter) return false
    if (person && l.player !== person) return false
    if (cutoff && l.date >= cutoff) return false
    const type = l.gameType === 'R' || l.gameType === 'A' ? l.gameType : 'P'
    if (!types) return type === 'R'
    return types.has(type) !== Boolean(gt.inv)
  }
}

const game = (l) => ({ gamePk: l.gamePk, date: l.date, away: l.away, home: l.home, gameNumber: l.gameNumber })

// One search. feed(lines) once per season, oldest first; finish() the answer:
// { top: [{ player, team, len, first, last, active, rank }] }, longest first, ties newest
// first. `activeFrom`: the first day of the latest season on file when the search reached
// it, else null. A streak's club is his club in its last game; the Club picker reads that.
export function streakRun(q, cutoff = null) {
  const inScope = counts(q, cutoff)
  const isMatch = streakMatcher(q)
  const running = new Map()
  let done = []
  const close = (s) => {
    if (s.len < 2 || (q.team && s.team !== q.team)) return
    done.push(s)
    if (done.length > TOP * 8) done = rank(done).slice(0, TOP * 2)
  }
  return {
    feed(lines) {
      for (const l of lines) {
        if (!inScope(l)) continue
        const cur = running.get(l.player)
        if (!isMatch(l)) {
          if (cur) close(cur)
          running.delete(l.player)
        } else if (cur) {
          cur.len++
          cur.last = game(l)
          cur.team = l.team
        } else running.set(l.player, { player: l.player, team: l.team, len: 1, first: game(l), last: game(l) })
      }
    },
    finish({ activeFrom }) {
      for (const s of running.values()) {
        s.active = Boolean(activeFrom && s.last.date >= activeFrom)
        close(s)
      }
      running.clear()
      let prev = null
      return {
        top: rank(done).slice(0, TOP).map((s, i) => {
          const r = prev && prev.len === s.len ? prev.rank : i + 1
          prev = { ...s, active: Boolean(s.active), rank: r }
          return prev
        }),
      }
    },
  }
}

const rank = (list) => list.sort((a, b) => b.len - a.len || b.last.date.localeCompare(a.last.date) || b.last.gamePk - a.last.gamePk)
