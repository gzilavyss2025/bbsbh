import { fetchMilbAlumni } from '../../../../api/team.js'
import { fetchManager } from '../../../../api/game.js'
import { fetchAttendance, attendanceRatesFor } from '../../../../api/attendance.js'
import { franchiseFor } from '../../../../api/franchiseHistory.js'
import { loadJerseys } from '../../data/loadNumbers.js'
import { seasonOf } from '../../data/shared.js'
import { SHARED } from '../once.js'

// About's data: the ballpark's attendance, the franchise history (MLB), the manager, the
// jersey strip, and (MiLB) the alumni. The jerseys move with `?d=` (loadJerseys says why);
// the rest does not. The standings and the schedule come through SHARED.
// The manager is the one read the page's header also makes; Band hands a module no manager,
// so About asks once more (one small request). Row 7 can pass it down and drop this.
export async function loadAbout(team, asOf) {
  const isMilb = (team.sport?.id ?? 1) !== 1
  const season = seasonOf(asOf, team.sport?.id ?? 1)
  const [milbAlumni, attendanceData, franchise, manager, jerseys] = await Promise.all([
    isMilb ? fetchMilbAlumni(team.id) : Promise.resolve({ minGames: null, players: [] }),
    isMilb ? Promise.resolve(null) : fetchAttendance(),
    isMilb ? Promise.resolve(null) : franchiseFor(team.id),
    fetchManager(team.id, season),
    loadJerseys(team, asOf, SHARED),
  ])
  return {
    milbAlumni,
    franchise,
    manager,
    jerseys,
    attendance: isMilb ? null : attendanceRatesFor(attendanceData, team.id, season),
  }
}

// The jump-bar badge: the cards the band drew. The ballpark draws for any club with a venue.
export const aboutCount = (d, team) =>
  [team.venue?.name, d.franchise?.spans?.length, d.jerseys.jerseyCombos.length || d.jerseys.homeRecord, d.milbAlumni?.players?.length].filter(Boolean).length
