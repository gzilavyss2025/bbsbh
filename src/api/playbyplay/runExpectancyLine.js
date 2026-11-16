import { staticJsonBy } from '../staticJson.js'
import { ERA_LAST, eraDecade, isTerminalOuts, re24Key } from '../../lib/runExpectancy.js'

// The innings viewer's run-expectancy line (#2973): one muted line under the newest revealed
// at-bat, "About .8 runs expected.", the runs the batting side can expect from the base-out state
// that play left, to the end of the half (RE24, base mask and outs only). No line once the half is over.
//
// REVEAL-ONLY: the base-out state after a play is the play's result. Call runExpectancyLine inside a
// SealBox reveal render function only (spoiler-manifest.json). The table itself is not a score, so
// fetchRunExpectancy may run eagerly.

// The table for a game's season (#3115): 2024 on, the current table; 1960-2023, that decade's era
// table (re24 only is read here, so the pre-1990 count-cell caveat does not apply); before 1960, or any
// game that is not MLB (sportId 1), none. `season` is selectGameSeason(feed). -> a url or null.
export function runExpectancyUrl(season, sportId) {
  if (sportId !== 1 || season == null) return null
  const year = Number(season)
  if (year > ERA_LAST) return '/data/run-expectancy.json'
  const decade = eraDecade(year)
  return decade ? `/data/run-expectancy-eras/${decade}.json` : null
}

const fetchByUrl = staticJsonBy((url) => url, { fallback: null })
// One fetch per file, memoized; null for a game with no table.
export const fetchRunExpectancy = (season, sportId) => {
  const url = runExpectancyUrl(season, sportId)
  return url ? fetchByUrl(url) : Promise.resolve(null)
}

// Runs to one decimal, the leading zero dropped as a scorer writes it: .8, 1.0, 2.3.
export const runsWord = (v) => v.toFixed(1).replace(/^0(?=\.)/, '')

// A walk-off: the home side ahead after a play in the bottom of the last scheduled inning or later. The
// game is over though the outs are not (post-play scores in play.result).
const walkOff = (play, scheduled) => play.about?.halfInning === 'bottom' && (play.about?.inning ?? 0) >= scheduled &&
  (play.result?.homeScore ?? 0) > (play.result?.awayScore ?? 0)

// `play` is the at-bat's feed play: post-play outs in count.outs, and matchup.postOnFirst/Second/Third
// present only when that base is occupied (both checked on gamePk 813024, 2026-11-16). `scheduled` is the
// game's scheduled innings (linescore.scheduledInnings; 7 in some doubleheaders). -> the line, or null:
// none once the half or the game is over, and none for a state the table has no sample of.
export function runExpectancyLine(play, table, scheduled = 9) {
  const outs = play?.count?.outs
  if (!table?.re24 || outs == null || isTerminalOuts(outs) || walkOff(play, scheduled)) return null
  const m = play.matchup ?? {}
  const mask = (m.postOnFirst ? 1 : 0) | (m.postOnSecond ? 2 : 0) | (m.postOnThird ? 4 : 0)
  const cell = table.re24[re24Key(mask, outs)]
  return cell?.n > 0 ? `About ${runsWord(cell.sum / cell.n)} runs expected.` : null
}
