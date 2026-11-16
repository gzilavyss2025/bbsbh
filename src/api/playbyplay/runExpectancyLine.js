import { staticJson } from '../staticJson.js'
import { isTerminalOuts, lookupRE } from '../../lib/runExpectancy.js'

// The innings viewer's run-expectancy line (#2973): one muted line under the newest revealed
// at-bat, "About .8 runs expected.", the runs the batting side can expect from the base-out state
// that play left, to the end of the half (RE24, base mask and outs only). No line once the half is over.
//
// REVEAL-ONLY: the base-out state after a play is the play's result. Call runExpectancyLine inside a
// SealBox reveal render function only (spoiler-manifest.json). The table itself is not a score, so
// fetchRunExpectancy may run eagerly.

export const fetchRunExpectancy = staticJson('/data/run-expectancy.json', { fallback: null })

// Runs to one decimal, the leading zero dropped as a scorer writes it: .8, 1.0, 2.3.
export const runsWord = (v) => v.toFixed(1).replace(/^0(?=\.)/, '')

// `play` is the at-bat's feed play: post-play outs in count.outs, and matchup.postOnFirst/Second/Third
// present only when that base is occupied. -> the line, or null.
export function runExpectancyLine(play, table) {
  const outs = play?.count?.outs
  if (!table?.re24 || outs == null || isTerminalOuts(outs)) return null
  const m = play.matchup ?? {}
  const mask = (m.postOnFirst ? 1 : 0) | (m.postOnSecond ? 2 : 0) | (m.postOnThird ? 4 : 0)
  return `About ${runsWord(lookupRE({ re24: table.re24 }, mask, outs, 0, 0))} runs expected.`
}
