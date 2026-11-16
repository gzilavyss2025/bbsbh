// Club Stretch's fetch pruning (Gary, 2026-11-16, issue 3133): a CEILING on a player's best
// run, from season lines alone, so the generator fetches game logs only for players who could
// still make a board. The boards stay exact: a player is skipped only when his ceiling is
// strictly worse than a board's last exact row (TOP), and a tie is fetched (the tiebreak may favour him).
//
// A run of n games lies inside seasons i..k of his list (with one club, or in MLB). Seasons
// i+1..k-1 are wholly inside it, so they hold at most n games; seasons i..k hold at least n.
// So the run's counting stats are at most season i..k's, and wholly-inside seasons set a floor.
// Every such span is tried; the ceiling is the best one. A gap in his list (a year away) only
// loosens it, which is safe.
// PA_PER_GAME is the run rule's own floor: a ceiling built on another number would prune wrong.
import { CLUB_PITCH_LENGTHS, PA_PER_GAME, measuresFor } from '../../../src/api/streaks/bestStretch.js'

const sum = (rows, k) => rows.reduce((n, s) => n + (s[k] ?? 0), 0)

// The games a season gives a run of length n: games, starts, or relief outings.
function countOf(s, n, group) {
  if (group === 'hitting') return s.gamesPlayed
  return n === CLUB_PITCH_LENGTHS.relief ? s.gamesPlayed - s.gamesStarted : s.gamesStarted
}
// A pitching season wholly of the run's kind: only then does its ER or BB set a floor (a
// season with both starts and relief cannot be split).
const pure = (s, n) => (n === CLUB_PITCH_LENGTHS.relief ? s.gamesStarted === 0 : s.gamesStarted === s.gamesPlayed)

// The best value any n-run inside these seasons could reach, in the measure's own sense
// (lower is better for ERA and WHIP). -Infinity (or Infinity) means no run fits.
function spanCeiling(span, inner, n, key, group) {
  const tot = (k) => sum(span, k)
  if (group === 'pitching') {
    const fixed = inner.filter((s) => pure(s, n))
    const outs = tot('outs')
    const per = (x) => (outs > 0 ? x / outs : 0)
    if (key === 'k') return tot('strikeOuts')
    if (key === 'kbb') return tot('strikeOuts') - sum(fixed, 'baseOnBalls')
    if (key === 'era') return per(27 * sum(fixed, 'earnedRuns'))
    return per(3 * (sum(fixed, 'hits') + sum(fixed, 'baseOnBalls')))
  }
  if (key === 'hr') return tot('homeRuns')
  if (key === 'h') return tot('hits')
  if (key === 'rbi') return tot('rbi')
  if (key === 'sb') return tot('stolenBases')
  // AVG and OPS: the run has 3.1 PA a game, and PA - AB is at most the span's.
  const notAb = span.reduce((n, s) => n + Math.max(s.plateAppearances - s.atBats, s.baseOnBalls + s.hitByPitch + s.sacFlies + s.sacBunts, 0), 0)
  const ab = Math.max(sum(inner, 'atBats'), Math.ceil(PA_PER_GAME * n) - notAb)
  if (ab <= 0) return Infinity
  const avg = Math.min(1, tot('hits') / ab)
  if (key === 'avg') return avg
  const obp = Math.min(1, (tot('hits') + tot('baseOnBalls') + tot('hitByPitch')) / ab)
  return obp + Math.min(4, tot('totalBases') / ab)
}

// seasons: one scope's lines, any order. Returns { [`${n}:${key}`]: ceiling } for every length
// and measure of the group, a key only where some run could fit.
export function ceilings(seasons, lengths, group = 'hitting') {
  const list = [...seasons].sort((a, b) => a.season - b.season)
  const out = {}
  for (const n of lengths) {
    for (const m of measuresFor(group)) {
      let best = null
      for (let i = 0; i < list.length; i++) {
        let innerGames = 0
        for (let k = i; k < list.length; k++) {
          if (k > i + 1) innerGames += countOf(list[k - 1], n, group)
          if (innerGames > n) break
          const span = list.slice(i, k + 1)
          if (span.reduce((c, s) => c + countOf(s, n, group), 0) < n) continue
          const v = spanCeiling(span, list.slice(i + 1, k), n, m.key, group)
          if (best == null || (m.lower ? v < best : v > best)) best = v
        }
      }
      if (best != null) out[`${n}:${m.key}`] = best
    }
  }
  return out
}

// A board's comparable score: higher is better for every measure.
const score = (raw, lower) => (lower ? -raw : raw)

// Which players to fetch next. boards: [{ scope, n, measure, cands: [{ id, ceiling }] }] with
// cands sorted best ceiling first; done(id) says a player's rows are in; rowOf(id, scope, key)
// reads one exact row ({ raw } or undefined). For each board, the unfetched players whose
// ceiling is at least the board's `top`th exact score (all of them while it has fewer than
// `top`), up to `per` a board; the generator passes TOP. An empty set means every board is final.
export function nextFetches(boards, done, rowOf, { top = 10, per = 8 } = {}) {
  const need = new Set()
  for (const b of boards) {
    const key = `${b.n}:${b.measure.key}`
    const exact = b.cands.filter((c) => done(c.id)).map((c) => rowOf(c.id, b.scope, key)).filter(Boolean)
      .map((r) => score(r.raw, b.measure.lower)).sort((x, y) => y - x)
    const bar = exact.length >= top ? exact[top - 1] : -Infinity
    let taken = 0
    for (const c of b.cands) {
      if (taken >= per || score(c.ceiling, b.measure.lower) < bar) break
      if (!done(c.id)) { need.add(c.id); taken++ }
    }
  }
  return need
}
