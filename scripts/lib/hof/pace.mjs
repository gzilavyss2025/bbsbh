// Pure half of scripts/gen-hof-pace.mjs: one player's year-by-year splits in,
// the cumulative-by-age line out. Hitters [h, hr]; pitchers [w, so, outs, sv].
import { ipToOuts } from '../../../src/lib/math/innings.js'
import { num as n } from '../../../src/lib/math/number.js'

// Returns { first, rows } (rows[i] is the line at age first + i, dense: an age
// with no MLB season repeats the one before) or null when there is no MLB season.
export function paceLine(splits, pitcher) {
  // season -> one row: the multi-team total (numTeams > 1) if present, else the single row
  const bySeason = new Map()
  for (const s of splits) {
    if (s.sport?.id !== 1 || s.gameType !== 'R' || s.stat?.age == null) continue
    const cur = bySeason.get(s.season)
    if (!cur || n(s.numTeams) > n(cur.numTeams)) bySeason.set(s.season, s)
  }
  if (!bySeason.size) return null
  const byAge = new Map([...bySeason.values()].map((s) => [s.stat.age, s.stat]))
  const ages = [...byAge.keys()]
  const first = Math.min(...ages)
  const rows = []
  let cum = pitcher ? [0, 0, 0, 0] : [0, 0]
  for (let age = first; age <= Math.max(...ages); age++) {
    const st = byAge.get(age)
    if (st) {
      cum = pitcher
        ? [cum[0] + n(st.wins), cum[1] + n(st.strikeOuts), cum[2] + ipToOuts(st.inningsPitched), cum[3] + n(st.saves)]
        : [cum[0] + n(st.hits), cum[1] + n(st.homeRuns)]
    }
    rows.push(cum)
  }
  return { first, rows }
}
