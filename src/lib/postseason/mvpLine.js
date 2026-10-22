// The Series MVP's own stat line, from the per-player series sums
// (postseasonSeries.js `lines`). One line per player: a pitcher's when he threw
// 3+ innings (or barely batted), else his batting line; [] when unknown. Pure arithmetic.
import { outsToIp } from '../math/innings.js'

const rate3 = (v) => v.toFixed(3).replace(/^0(?=\.)/, '')

export function mvpStatLine(lines, playerId) {
  const bat = lines?.batting?.[playerId]
  const pit = lines?.pitching?.[playerId]
  const batting = bat
    ? [
        ['AVG', bat.atBats ? rate3(bat.hits / bat.atBats) : '—'],
        ['H', String(bat.hits)],
        ['HR', String(bat.homeRuns)],
        ['RBI', String(bat.rbi)],
        ['BB', String(bat.baseOnBalls)],
      ]
    : []
  const pitching = pit
    ? [
        ['IP', outsToIp(pit.outs)],
        ['W-L', `${pit.wins}-${pit.losses}`],
        ['SV', String(pit.saves)],
        ['ER', String(pit.earnedRuns)],
        ['SO', String(pit.strikeOuts)],
      ]
    : []
  return pit && (!bat || pit.outs >= 9 || bat.atBats < 6) ? pitching : batting
}
