import { fetchMilbAlumni } from '../../../../api/team.js'
import { fetchAttendance, attendanceRatesFor } from '../../../../api/attendance.js'
import { franchiseFor } from '../../../../api/franchiseHistory.js'
import { seasonOf } from '../../data/shared.js'

// About's data: the three things the Overview drew under the club's name, read the way
// loadOverview.js reads them (MLB: attendance and franchise history; MiLB: the alumni).
export async function loadAbout(team, asOf) {
  const isMilb = (team.sport?.id ?? 1) !== 1
  const [milbAlumni, attendanceData, franchise] = await Promise.all([
    isMilb ? fetchMilbAlumni(team.id) : Promise.resolve({ minGames: null, players: [] }),
    isMilb ? Promise.resolve(null) : fetchAttendance(),
    isMilb ? Promise.resolve(null) : franchiseFor(team.id),
  ])
  return {
    milbAlumni,
    franchise,
    attendance: isMilb ? null : attendanceRatesFor(attendanceData, team.id, seasonOf(asOf, team.sport?.id ?? 1)),
  }
}
