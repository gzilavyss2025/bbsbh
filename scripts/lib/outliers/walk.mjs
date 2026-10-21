// The per-date walk behind public/data/outliers/{season}.json (#2453). Pure.
//
// One player's regular-season game log, walked one game date at a time. On game date `d`
// the rule runs with cutoff `d + 1 day`, so the game of `d` counts and nothing later does
// (rule.js counts rows dated BEFORE the cutoff). The rule is src/api/hotcold/rule.js and is
// never copied here.
//
// THE FILE KEEPS FLAGGED DAYS ONLY. A day with a flag is one entry [date, flags]. The
// first day AFTER a flagged run with no flag is a CLOSING MARKER [date, 0]. Without it the
// reader, which answers with a player's latest entry before the cutoff, would show the old
// flag for ever. A player's state changes only on a day he plays, so game dates are enough.
import { packFlag } from '../../../src/api/hotcold/outliers.js'
import { hotColdFlags } from '../../../src/api/hotcold/rule.js'

export const nextDay = (d) => new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)

// { role, rows, tails } -> [[date, [packed flag, ...]], [date, 0], ...] in date order.
export function walkPlayer({ role, rows, tails }) {
  const dates = [...new Set(
    (rows ?? [])
      .filter((r) => r?.stat && (r.gameType == null || r.gameType === 'R') && typeof r.date === 'string')
      .map((r) => r.date),
  )].sort()
  const out = []
  let open = false
  for (const date of dates) {
    const flags = hotColdFlags({ role, sportId: 1, rows, cutoff: nextDay(date), tails })
    if (flags.length) {
      out.push([date, flags.map(packFlag)])
      open = true
    } else if (open) {
      out.push([date, 0])
      open = false
    }
  }
  return out
}
