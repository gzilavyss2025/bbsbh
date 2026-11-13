// The /research answer (#2234): one query over the decoded plate appearances, shown
// four ways. The match list (newest first, each with an ordinal) answers "when did
// this last happen?"; the summary line answers "how often?"; the leaders answer
// "who does it most?"; the outcome spread answers "what happens when...?".
//
// SPOILER CLASSIFICATION: spoiler-free. Pure functions over the store.

import { totalsOf } from '../scout/headToHead.js'
import { matcher, resultName } from './filters.js'

const LEADER_ROWS = 10

// pas: every plate appearance on file, oldest first. Returns the whole answer.
export function answer(pas, q, cutoff) {
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

  // "How often": against the same query with no result chip, when one is set.
  let base = null
  if (q.chips?.res) {
    const { res, ...rest } = q.chips // eslint-disable-line no-unused-vars
    const isBase = matcher({ ...q, chips: rest }, cutoff)
    base = pas.reduce((n, pa) => n + (isBase(pa) ? 1 : 0), 0)
  }

  return summarize(matches, base)
}

// The answer for a list of matches, newest first. "Last time" across seasons joins each
// season's matches (newest season first) and calls this with base null: a share is
// never computed from part of a search.
export function summarize(matches, base = null) {
  const games = new Set(matches.map((m) => m.gamePk)).size
  return { matches, totals: totalsOf(matches), games, base, batters: leaders(matches, 'batter'), pitchers: leaders(matches, 'pitcher'), outcomes: outcomes(matches) }
}

function leaders(matches, who) {
  const counts = new Map()
  for (const m of matches) counts.set(m[who], (counts.get(m[who]) ?? 0) + 1)
  return [...counts].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id - b.id).slice(0, LEADER_ROWS)
}

function outcomes(matches) {
  const counts = new Map()
  for (const m of matches) {
    const label = resultName(m.event)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n)
}
