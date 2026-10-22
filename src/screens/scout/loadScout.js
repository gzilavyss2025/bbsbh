import { fetchPerson } from '../../api/person-fetch.js'
import { fetchPitchArsenalFor } from '../../api/pitchArsenal.js'
import { fetchCommandShard } from '../../api/commandMap.js'
import { shardKey100 } from '../../lib/shardKey.js'
import { currentSeasonOf } from '../../api/staticJson.js'
import { fetchSavantMatchup } from '../../api/matchup/savant.js'
import { fetchHitterGridFor, fetchHitterLeague } from '../../api/scout/hitterGrid.js'
import { fetchTeamUniformCatalog, homeSetOf } from '../../api/uniforms.js'
import { lastName } from '../../api/select.js'
import { yearsPlayed } from '../../api/search.js'
import { isMlbTeamId } from '../../lib/teams.js'
import { rosterStatusView } from '../../lib/person/rosterStatus.js'
import { baseballToday } from '../../lib/time/standingsDates.js'

// EVERYTHING THE MATCHUP SCOUT DRAWS EXCEPT THE HEAD-TO-HEAD (#1410), in one
// pass: both people (name, hands, club), the pitcher's mix and 5x5 command
// shards from the nightly season stores (whole buckets, so the board can read
// `post` beside `pit`, ADR-0094), the hitter's grid and the league's from the
// same season store (ADR-0096), and the hitter's per-pitch line from the
// Savant board, which the page shows while his grid is not posted. All season
// aggregates over final games, on an open page (ADR-0034). The head-to-head is its own request
// (api/scout/headToHead.js): it fails on its own, and the page says so.
//
// Null when either person cannot be fetched (a bad id in a hand-typed link).
// Any one store missing is not a failure: the page shows "Not posted" there.
export async function loadScout(pitcherId, hitterId) {
  const season = await currentSeasonOf('pitch-command')
  const [pitcher, hitter, arsenal, command, savant, grid, league] = await Promise.all([
    fetchPerson(pitcherId),
    fetchPerson(hitterId),
    fetchPitchArsenalFor(pitcherId),
    season == null ? null : fetchCommandShard(`${season}/${shardKey100(pitcherId)}`),
    fetchSavantMatchup(),
    // The pitch-command season, so the two maps never read different years.
    season == null ? null : fetchHitterGridFor(hitterId, season),
    season == null ? null : fetchHitterLeague(season),
  ])
  if (!pitcher || !hitter) return null
  // The hitter's club home set, for the Where map's batter figure; null (the stance box) when MLB has none.
  const teamId = hitter.currentTeam?.id ?? null
  const homeSet = teamId == null || season == null ? null : homeSetOf(await fetchTeamUniformCatalog([teamId], season), teamId)
  // A retired player, or one the season stores lack, has no scouting data
  // (slice 7b): the page then shows only the meetings.
  const pitcherIn = Boolean(arsenal?.pit?.[pitcherId])
  const hitterIn = Boolean(grid || savant?.bat?.[hitterId])
  return { pitcher: personOf(pitcher, pitcherIn), hitter: personOf(hitter, hitterIn), arsenal, command, season, savant, grid, league, homeSet }
}

// A retired player's club is his last stop, not `currentTeam` (often null).
const personOf = (p, inStores) => ({
  id: p.id,
  name: p.fullName ?? '',
  // The surname the Edge tab's sentences use ("Lean Chourio").
  last: lastName(p) || (p.fullName ?? ''),
  throws: p.pitchHand?.code ?? '',
  bats: p.batSide?.code ?? '',
  teamId: p.active === false
    ? rosterStatusView(p, baseballToday(), { isMlbTeamId })?.lastTeam?.id ?? p.currentTeam?.id ?? null
    : p.currentTeam?.id ?? null,
  retired: p.active === false,
  years: yearsPlayed(p),
  lastYear: (p.lastPlayedDate ?? '').slice(0, 4),
  inStores,
})
