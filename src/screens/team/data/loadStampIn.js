import { fetchTeam } from '../../../api/team.js'
import { fetchTeamSchedule } from '../../../api/schedule.js'
import { seasonOf, cutoffFor } from './shared.js'

// The Stamp In page's own data, and deliberately the thinnest loader in this
// directory: the club, and its season schedule. Nothing else.
//
// It does NOT reuse loadGames.js even though the first two lines look alike.
// That loader also pulls the All-Star card, a transactions page and the
// photos-shelf input, none of which this page draws — and the tab-loader rule
// this hub is built on (ADR-0034) is that a screen fetches its own data and
// only its own. Each game's feed + win probability arrive later and one at a
// time, as the reader scrolls to them (StampInPage.jsx's lazy queue), never
// here: a full season is up to 162 games and fetching them on mount would be
// the largest network event in the app by an order of magnitude.
//
// MiLB degrades the house way: fetchTeamSchedule answers [] for a club with no
// posted schedule, and the page renders "no games posted yet" instead of
// crashing.
export async function loadStampIn(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const schedule = await fetchTeamSchedule(id, seasonOf(asOf), sportId, cutoffFor(asOf))
  return { team, schedule }
}
