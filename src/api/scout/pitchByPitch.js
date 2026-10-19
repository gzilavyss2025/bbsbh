import { fetchPitchArsenalFor } from '../pitchArsenal.js'
import { fetchHitterGridFor, fetchHitterLeague } from './hitterGrid.js'
import { projectFromLiveLogs } from '../rotation/liveStarters.js'
import { fetchWorkload } from '../workload.js'
import { pitchByPitchModel, seatOf, topHitters } from '../../lib/postseason/worldseries/scouting/pitchByPitch.js'
import { fetchHotBatSplits } from '../postseason/worldSeriesHome.js'
import { fetchUpcomingSeriesGames } from '../postseason/upcoming.js'

// The Pitch by pitch card's reads (#2316, slice 2): `clubId`'s starter for `gamePk` (the named
// probable, else the projected one, as the Probables card does) against `oppId`'s regular
// hitters. Open surface (ADR-0034): the schedule probable, season arsenal and grid sums over
// Final games, and postseason splits that end the day before `slateDate`. No score is read.
// -> null | { starter: { id, name, hand, projected }, rows }. Any failed read drops the card.
export async function loadPitchByPitch({ clubId, oppId, gamePk, slateDate }) {
  try {
    const season = Number(slateDate.slice(0, 4))
    const game = (await fetchUpcomingSeriesGames([gamePk]))[gamePk]
    if (!game) return null
    const seat = seatOf(game, clubId)
    if (!seat) return null
    let arm = game[seat]
    let projected = false
    if (!arm) {
      const first = (await projectFromLiveLogs(await fetchWorkload(), clubId, game.date || slateDate))?.[0]
      arm = first && { id: first.id, name: first.name }
      projected = true
    }
    if (!arm) return null
    const [arsenalData, splits, league] = await Promise.all([
      fetchPitchArsenalFor(arm.id, { seasonYear: season }),
      fetchHotBatSplits(season, oppId, slateDate),
      fetchHitterLeague(season),
    ])
    const entry = arsenalData?.pit?.[arm.id]
    const hitters = await Promise.all(topHitters(splits).map((id) => fetchHitterGridFor(id, season)))
    const hand = entry?.throws ?? arm.hand ?? ''
    const model = pitchByPitchModel({ arsenal: entry?.mlb, hitters, league, hand })
    return model && { starter: { id: arm.id, name: arm.name, hand, projected }, hitters: model.hitters, rows: model.rows }
  } catch {
    return null
  }
}
