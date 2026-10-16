import { fetchStandings, fetchTeamRoster, fetchTeamIL } from '../../../api/team.js'
import { fetchTeamSchedule } from '../../../api/schedule.js'
import { fetchManager } from '../../../api/game.js'
import { fetchTeamSeasonStats } from '../../../api/statsLevels.js'

// The six reads more than one team-hub loader makes: standings (the header and Standings),
// the club schedule (Standings, Games, Roster), the roster (Roster, Farm), a club's season
// /stats (Ranks, Farm), the manager (header, About) and the 40-man Injured List view (Roster,
// Ranks). A loader takes them as its last argument, `src`. With none it fetches its own copy.
// The one-scroll page passes `SHARED` (next/once.js), the same six bought once per page.
export const DIRECT = { fetchStandings, fetchTeamSchedule, fetchTeamRoster, fetchTeamSeasonStats, fetchManager, fetchTeamIL }
