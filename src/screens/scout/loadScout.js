import { fetchPerson } from '../../api/person-fetch.js'
import { fetchPitchArsenalFor } from '../../api/pitchArsenal.js'
import { fetchCommandShard } from '../../api/commandMap.js'
import { shardKey100 } from '../../lib/shardKey.js'
import { currentSeasonOf } from '../../api/staticJson.js'
import { fetchSavantMatchup } from '../../api/matchup/savant.js'

// EVERYTHING THE MATCHUP SCOUT DRAWS EXCEPT THE HEAD-TO-HEAD (#1410), in one
// pass: both people (name, hands, club), the pitcher's mix and 5x5 command
// shards from the nightly season stores (whole buckets, so the board can read
// `post` beside `pit`, ADR-0094), and the hitter's per-pitch line from the
// Savant board. All spoiler-free season aggregates over final
// games, on an open page (ADR-0034). The head-to-head is its own request
// (api/scout/headToHead.js): it fails on its own, and the page says so.
//
// Null when either person cannot be fetched (a bad id in a hand-typed link).
// Any one store missing is not a failure: the page shows "Not posted" there.
export async function loadScout(pitcherId, hitterId) {
  const season = await currentSeasonOf('pitch-command')
  const [pitcher, hitter, arsenal, command, savant] = await Promise.all([
    fetchPerson(pitcherId),
    fetchPerson(hitterId),
    fetchPitchArsenalFor(pitcherId),
    season == null ? null : fetchCommandShard(`${season}/${shardKey100(pitcherId)}`),
    fetchSavantMatchup(),
  ])
  if (!pitcher || !hitter) return null
  // THE HITTER GRID (#1411 Part B): `grid` = { reg, post } for this hitter and
  // `league` = { reg, post }, both from the same season store as `command`
  // (hitterBoard.js has the shape). Its reader lands with that store; until
  // then both are null and the page keeps its Phase 1 hitter line.
  const grid = null
  const league = null
  return { pitcher: personOf(pitcher), hitter: personOf(hitter), arsenal, command, season, savant, grid, league }
}

const personOf = (p) => ({
  id: p.id,
  name: p.fullName ?? '',
  throws: p.pitchHand?.code ?? '',
  bats: p.batSide?.code ?? '',
  teamId: p.currentTeam?.id ?? null,
})
