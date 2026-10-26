// A pitcher's October, for the Probables card (#1906, slice 6). Pure.
//
//   outings: gameLog splits { date, isHome, opponent:{id,abbreviation?},
//            stat:{ inningsPitched:'5.1', earnedRuns, strikeOuts, baseOnBalls,
//            gamesStarted } }
//
// SPOILER FOOTING (ADR-0088). Only outings dated BEFORE `slateDate` count, so
// the slate date's own start never reaches a total, whatever the
// caller passes. Postseason, this year.

import { leadSide } from './hotBats.js'

const before = (outings, slateDate) =>
  (outings ?? []).filter((o) => o.date && o.date < slateDate).sort((a, b) => a.date.localeCompare(b.date))

// '5.1' innings is 5 and a third: thirds of an inning, summed, then printed back.
const thirds = (ip) => {
  const [w, f = '0'] = String(ip ?? '0').split('.')
  return Number(w) * 3 + Number(f)
}
const printIp = (t) => `${Math.floor(t / 3)}.${t % 3}`

export function pitcherLine(outings, slateDate) {
  const rows = before(outings, slateDate)
  let t = 0
  let er = 0
  let k = 0
  let bb = 0
  let gs = 0
  for (const o of rows) {
    t += thirds(o.stat?.inningsPitched)
    er += Number(o.stat?.earnedRuns) || 0
    k += Number(o.stat?.strikeOuts) || 0
    bb += Number(o.stat?.baseOnBalls) || 0
    gs += Number(o.stat?.gamesStarted) || 0
  }
  return {
    games: rows.length,
    gs,
    relief: rows.length - gs,
    ip: printIp(t),
    ipValue: t / 3,
    era: t > 0 ? ((er * 27) / t).toFixed(2) : null,
    k,
    bb,
  }
}

// The figures this starter leads the other on: more innings and strikeouts, a lower ERA, fewer
// walks. A tie leads nothing, and a side with no October line (or no ERA yet) leads nothing, so the
// two sides never share a figure. `mine` and `theirs` are pitcherLine results.
export function leadingFigures(mine, theirs) {
  if (!mine?.games || !theirs?.games) return []
  const era = (l) => (l.era == null ? null : Number(l.era))
  const figures = [
    ['IP', mine.ipValue, theirs.ipValue, false],
    ['ERA', era(mine), era(theirs), true],
    ['K', mine.k, theirs.k, false],
    ['BB', mine.bb, theirs.bb, true],
  ]
  return figures
    .filter(([, a, b, lowerWins]) => a != null && b != null && leadSide(a, b, { lowerWins }) === 'a')
    .map(([label]) => label)
}
