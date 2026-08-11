import { fetchTeam } from '../../../api/team.js'
import { fetchTeamSchedule } from '../../../api/schedule.js'
import { allStartedGames } from '../../../api/scheduleGames.js'
import { seasonOf } from './shared.js'

// TeamPhotosPage's own data — the club and its season schedule, nothing else
// (same "thinnest loader" shape as loadStampIn.js, for the same reason: this
// page draws none of loadGames.js's All-Star card or transactions).
//
// No `resultsCutoff` on the schedule fetch, on purpose: this page is
// deliberately unsealed (see the page's own header), so unlike every other
// team-hub loader it has no spoiler cutoff to respect — same footing as
// GamePhotosPage, whose own header makes the identical call for the identical
// reason.
//
// `allStartedGames`, not `allDecidedGames`: this page's photo walk includes a
// game still in progress, not just Final ones — see that function's own
// header for why that's this page's call to make and no other consumer's.
export async function loadTeamPhotos(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const season = seasonOf(asOf)
  const schedule = await fetchTeamSchedule(id, season, sportId)
  return { team, season, seasonGames: allStartedGames(schedule) }
}
