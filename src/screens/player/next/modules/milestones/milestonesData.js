// The Milestone watch module's reads (#2017): his MLB career to the cutoff, and the nightly projections.
import { fetchPersonStats } from '../../../../../api/person-fetch.js'
import { aggregateSplits } from '../../../../../api/person/stats.js'
import { mlbCareerThroughCutoff, milestoneWatchView } from '../../../../../api/person/milestones.js'
import { dayBefore } from '../../../../../api/player/context.js'
import { isoToday } from '../../../../../lib/dates.js'

// Prior MLB seasons plus this season to the cutoff, the same sum the live hub makes. Never stats=career:
// on a dated page that would include games after the cutoff. `fetchStats` is a seam for the test.
export async function milestonesFor(bio, role, season, asOf, fetchStats = fetchPersonStats) {
  if (bio.team?.parentOrgId || !bio.debut) return []
  const endDate = asOf ? dayBefore(asOf) : isoToday()
  const [mlbSplits, seasonSplits] = await Promise.all([
    fetchStats(bio.id, { type: 'yearByYear', group: role, sportId: 1 }),
    fetchStats(bio.id, { type: 'byDateRange', group: role, season, startDate: `${season}-01-01`, endDate, sportId: 1 }),
  ])
  const stat = mlbCareerThroughCutoff(
    { mlbSplits, tileStat: aggregateSplits(seasonSplits, role), tileSportId: 1, currentSeason: season },
    role,
  )
  return milestoneWatchView(stat, role)
}
