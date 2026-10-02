import { fetchPerson } from '../../api/person-fetch.js'
import { fetchPitchArsenalFor } from '../../api/pitchArsenal.js'
import { fetchCommandFor } from '../../api/commandMap.js'
import { currentSeasonOf } from '../../api/staticJson.js'
import { fetchSavantMatchup } from '../../api/matchup/savant.js'

// EVERYTHING THE MATCHUP SCOUT DRAWS EXCEPT THE HEAD-TO-HEAD (#1410), in one
// pass: both people (name, hands, club), the pitcher's mix and his 5x5
// command cells from the nightly season stores, and the hitter's per-pitch
// line from the Savant board. All spoiler-free season aggregates over final
// games, on an open page (ADR-0034). The head-to-head is its own request
// (api/scout/headToHead.js): it fails on its own, and the page says so.
//
// Null when either person cannot be fetched (a bad id in a hand-typed link).
// Any one store missing is not a failure: the page shows "Not posted" there.
export async function loadScout(pitcherId, hitterId) {
  const [pitcher, hitter, arsenal, command, season, savant] = await Promise.all([
    fetchPerson(pitcherId),
    fetchPerson(hitterId),
    fetchPitchArsenalFor(pitcherId),
    fetchCommandFor(pitcherId),
    currentSeasonOf('pitch-command'),
    fetchSavantMatchup(),
  ])
  if (!pitcher || !hitter) return null
  return { pitcher: personOf(pitcher), hitter: personOf(hitter), arsenal, command, season, savant }
}

const personOf = (p) => ({
  id: p.id,
  name: p.fullName ?? '',
  throws: p.pitchHand?.code ?? '',
  bats: p.batSide?.code ?? '',
  teamId: p.currentTeam?.id ?? null,
})
