// Pure half of scripts/gen-hof-pace.mjs: one player's year-by-year splits in,
// the cumulative-by-age line out. Hitters [h, hr]; pitchers [w, so, outs, sv].
import { ipToOuts } from '../../../src/lib/math/innings.js'
import { num as n } from '../../../src/lib/math/number.js'

// Returns { first, rows } (rows[i] is the line at age first + i, dense: an age
// with no MLB season repeats the one before) or null when there is no MLB season.
// `warBySeason` ({ [season]: war }, from war-history/) appends a cumulative WAR column,
// rounded to tenths; null for every age when the career began before 1901 (no WAR data).
export function paceLine(splits, pitcher, warBySeason) {
  // season -> one row: the multi-team total (numTeams > 1) if present, else the single row
  const bySeason = new Map()
  for (const s of splits) {
    if (s.sport?.id !== 1 || s.gameType !== 'R' || s.stat?.age == null) continue
    const cur = bySeason.get(s.season)
    if (!cur || n(s.numTeams) > n(cur.numTeams)) bySeason.set(s.season, s)
  }
  if (!bySeason.size) return null
  const byAge = new Map([...bySeason.values()].map((s) => [s.stat.age, s]))
  const withWar = warBySeason !== undefined
  const preWar = Math.min(...[...bySeason.keys()].map(Number)) < 1901
  let war = 0
  const ages = [...byAge.keys()]
  const first = Math.min(...ages)
  const rows = []
  let cum = pitcher ? [0, 0, 0, 0] : [0, 0]
  for (let age = first; age <= Math.max(...ages); age++) {
    const split = byAge.get(age)
    const st = split?.stat
    if (st) {
      war += n(warBySeason?.[split.season])
      cum = pitcher
        ? [cum[0] + n(st.wins), cum[1] + n(st.strikeOuts), cum[2] + ipToOuts(st.inningsPitched), cum[3] + n(st.saves)]
        : [cum[0] + n(st.hits), cum[1] + n(st.homeRuns)]
    }
    rows.push(withWar ? [...cum, preWar ? null : Math.round(war * 10) / 10] : cum)
  }
  return { first, rows }
}
