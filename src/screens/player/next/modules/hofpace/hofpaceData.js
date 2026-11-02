// The Hall of Fame pace module's reads (#1857 slice 3): the inductee file and his MLB
// yearByYear lines. Under `?d=` this season's line is cut the day before (never stats=career).
import { fetchPersonStats } from '../../../../../api/person-fetch.js'
import { aggregateSplits } from '../../../../../api/person/stats.js'
import { dayBefore } from '../../../../../api/player/context.js'
import { hofPaceRows } from './hofpaceView.js'

let pool = null
const loadPool = () =>
  (pool ??= fetch('/data/hof-pace.json')
    .then((r) => (r.ok ? r.json() : { players: [] }))
    .catch(() => ((pool = null), { players: [] })))

// `fetchStats` and `load` are seams for the test.
export async function hofPaceFor(bio, role, season, asOf, fetchStats = fetchPersonStats, load = loadPool) {
  if (bio.team?.parentOrgId || !bio.debut) return null
  const [{ players = [] }, splits, cut] = await Promise.all([
    load(),
    fetchStats(bio.id, { type: 'yearByYear', group: role, sportId: 1 }),
    asOf
      ? fetchStats(bio.id, { type: 'byDateRange', group: role, season, startDate: `${season}-01-01`, endDate: dayBefore(asOf), sportId: 1 })
      : null,
  ])
  const cutoff = asOf ? { season, stat: cut?.length ? aggregateSplits(cut, role) : null } : null
  return hofPaceRows({ id: bio.id, players, splits, role, cutoff })
}
