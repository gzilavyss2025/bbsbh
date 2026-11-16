// The /research answer (#2234): one query over the decoded plate appearances, shown
// four ways. The match list (newest first, each with an ordinal) answers "when did
// this last happen?"; the summary line answers "how often?"; the leaders answer
// "who does it most?"; the outcome spread answers "what happens when...?".
// "Who most" ranks by count, or by rate (#3147): matches per plate appearance in the
// same situation (the query with no result card), with a PA minimum. The rate is ranked
// on the page (rateLeaders), so a toggle or a new minimum never re-runs the search.
//
// SPOILER CLASSIFICATION: spoiler-free. Pure functions over the store.

import { totalsOf } from '../scout/headToHead.js'
import { RATE_MIN, matcher, resultName } from './filters.js'

const LEADER_ROWS = 10

// pas: every plate appearance on file, oldest first. Returns the whole answer.
// `matchesOnly`: just the matches (newest first, with ordinals), no share or tables, for
// "Last time" across seasons, which summarizes once over every season's matches.
export function answer(pas, q, cutoff, { matchesOnly = false } = {}) {
  const isMatch = matcher(q, cutoff)
  const seen = new Map()
  const matches = []
  for (const pa of pas) {
    if (!isMatch(pa)) continue
    const k = `${pa.batter}-${pa.date.slice(0, 4)}`
    const ordinal = (seen.get(k) ?? 0) + 1
    seen.set(k, ordinal)
    matches.push({ ...pa, ordinal })
  }
  matches.reverse()
  if (matchesOnly) return { matches }

  // "How often": against the same query with no result chip, when one is set. The same
  // pass counts each batter's and pitcher's PAs in it, the base of a "Who most" rate.
  let base = null
  let baseBy = null
  if (q.chips?.res) {
    const { res, ...rest } = q.chips // eslint-disable-line no-unused-vars
    const isBase = matcher({ ...q, chips: rest }, cutoff)
    base = 0
    baseBy = { batter: new Map(), pitcher: new Map() }
    for (const pa of pas) {
      if (!isBase(pa)) continue
      base++
      baseBy.batter.set(pa.batter, (baseBy.batter.get(pa.batter) ?? 0) + 1)
      baseBy.pitcher.set(pa.pitcher, (baseBy.pitcher.get(pa.pitcher) ?? 0) + 1)
    }
  }

  return { ...summarize(matches, base), baseBy }
}

// The answer for a list of matches, newest first. "Last time" across seasons joins each
// season's matches (newest season first) and calls this with base null: a share is
// never computed from part of a search.
export function summarize(matches, base = null) {
  const games = new Set(matches.map((m) => m.gamePk)).size
  return { matches, totals: totalsOf(matches), games, base, batters: leaders(matches, 'batter'), pitchers: leaders(matches, 'pitcher'), outcomes: outcomes(matches) }
}

const countBy = (matches, who) => {
  const counts = new Map()
  for (const m of matches) counts.set(m[who], (counts.get(m[who]) ?? 0) + 1)
  return counts
}

function leaders(matches, who) {
  return [...countBy(matches, who)].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id - b.id).slice(0, LEADER_ROWS)
}

// THE RATE LEADERS (#3147): `who` 'batter' | 'pitcher', from an answer() result. Each row
// is { id, n, pa, rate }: n matches of pa plate appearances in the same situation. A
// player under `min` PA is dropped. Null when the answer has no base (no result card).
export function rateLeaders(a, who, min = RATE_MIN) {
  const pas = a.baseBy?.[who]
  if (!pas) return null
  return [...countBy(a.matches, who)]
    .map(([id, n]) => ({ id, n, pa: pas.get(id) ?? 0 }))
    .filter((r) => r.pa >= min)
    .map((r) => ({ ...r, rate: r.n / r.pa }))
    .sort((x, y) => y.rate - x.rate || y.n - x.n || x.id - y.id)
    .slice(0, LEADER_ROWS)
}

function outcomes(matches) {
  const counts = new Map()
  for (const m of matches) {
    const label = resultName(m.event)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n)
}
