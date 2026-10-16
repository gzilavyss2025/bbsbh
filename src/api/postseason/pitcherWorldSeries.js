import { fetchPitcherSeasonLine } from '../game.js'
import { fetchPitcherPostseasonCareer } from './pitcherCareer.js'

// A starter's all-time World Series line, ending the day before the game: earlier
// seasons from yearByYear (gameType=W) plus this season's World Series line when
// the caller has it. Never stats=career, which counts a game in progress
// (ADR-0088). Same rules as pitcherCareer.js, which does the work.
// Verified against /api/v1/people/477132/stats?stats=yearByYear&group=pitching&gameType=W
// on 2026-10-16 (Kershaw: 8 games, 41 strikeouts).
export const fetchPitcherWorldSeriesCareer = (personId, season, thisSeasonWs = null) =>
  fetchPitcherPostseasonCareer(personId, season, thisSeasonWs, 'W')

// His World Series starts before `date` (ISO): earlier Series plus this one's
// games through the day before. 0 for a pitcher with none, and also when the
// read fails (ponytail: the fetchers swallow errors, so a failed read says "first";
// make them throw if that ever matters).
export async function fetchWorldSeriesStartsBefore(personId, date) {
  const season = Number(date.slice(0, 4))
  const thisWs = await fetchPitcherSeasonLine(personId, season, 1, date, { worldSeries: true })
  return (await fetchPitcherWorldSeriesCareer(personId, season, thisWs))?.gamesStarted ?? 0
}
