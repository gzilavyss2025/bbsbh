import { fetchStandings, fetchTeamRoster } from '../../../api/team.js'
import { fetchTeamSchedule } from '../../../api/schedule.js'
import { fetchManager } from '../../../api/game.js'
import { fetchTeamSeasonStats } from '../../../api/statsLevels.js'

// The five reads more than one team-hub loader makes: standings (the header and Standings),
// the club schedule (Standings, Games, Roster), the active roster (Roster, Farm) and a club's
// season /stats (Ranks, Farm) and the manager (header, About). A loader takes them as its last argument, `src`. A tab route
// passes nothing and gets these, so each tab still fetches on its own (ADR-0034). The
// one-scroll page passes `SHARED` (next/once.js), the same five bought once per page.
export const DIRECT = { fetchStandings, fetchTeamSchedule, fetchTeamRoster, fetchTeamSeasonStats, fetchManager }
