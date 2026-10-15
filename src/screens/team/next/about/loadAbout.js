import { fetchMilbAlumni } from '../../../../api/team.js'
import { fetchAttendance, attendanceRatesFor } from '../../../../api/attendance.js'
import { franchiseFor } from '../../../../api/franchiseHistory.js'
import { loadJerseys } from '../../data/loadNumbers.js'
import { seasonOf } from '../../data/shared.js'
import { SHARED } from '../once.js'

// About's data: the ballpark's attendance, the franchise history (MLB), the manager, the
// jersey strip, and (MiLB) the alumni. The jerseys move with `?d=` (loadJerseys says why);
// the rest does not. The standings and the schedule come through SHARED.
// The manager is the one read the page's header also makes; it comes through SHARED, so the page buys it once.
const NO_JERSEYS = { jerseyCombos: [], homeRecord: { wins: 0, losses: 0 }, awayRecord: { wins: 0, losses: 0 } }

export async function loadAbout(team, asOf) {
  const isMilb = (team.sport?.id ?? 1) !== 1
  const season = seasonOf(asOf, team.sport?.id ?? 1)
  const [milbAlumni, attendanceData, franchise, manager, jerseys] = await Promise.all([
    isMilb ? fetchMilbAlumni(team.id) : Promise.resolve({ minGames: null, players: [] }),
    isMilb ? Promise.resolve(null) : fetchAttendance(),
    isMilb ? Promise.resolve(null) : franchiseFor(team.id),
    SHARED.fetchManager(team.id, season),
    // One failed jersey read must not blank the ballpark and franchise cards.
    loadJerseys(team, asOf, SHARED).catch(() => NO_JERSEYS),
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
