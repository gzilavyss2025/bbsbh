// The zone map's data (#2568, #2566): a batter's batting average by strike-zone cell, season
// through the day BEFORE the game. Without `endDate` the total includes the game being scored
// (Arozarena, gamePk 824716: zone 5 moves .250 to .261 after his home run), so the request always
// ends at dayBefore(officialDate), the ADR-0088 footing. Reads no live game data: spoiler-free.
//
// Verified 2026-10-26: Arozarena (668227) sportId=1 returns five splits (exitVelocity,
// sluggingPercentage, onBasePlusSlugging, battingAverage, onBasePercentage), each with zones
// 01-09 (the strike zone) and 11-14 (outside it). Triple-A (sportId 11) answers the same shape;
// sportIds 12-14 and a hitter with no games before endDate answer `splits: []`.
import { getJson } from '../statsapi.js'
import { dayBefore } from '../game.js'

// { zones: { '01'..'09': { avg, temp } } }, or null when there are no zones (MiLB, a debut) or
// no date to stop at. A failed fetch is null too: the map is left off rather than mislabelled.
export async function fetchBatterZones(personId, season, sportId, officialDate) {
  if (!personId || !season || !officialDate) return null
  try {
    const data = await getJson(
      `/api/v1/people/${personId}/stats?stats=hotColdZones&group=hitting` +
        `&season=${season}&sportId=${sportId}&endDate=${dayBefore(officialDate)}`,
    )
    const rows = data.stats?.[0]?.splits?.find((s) => s.stat?.name === 'battingAverage')?.stat?.zones
    const zones = {}
    for (const z of rows ?? []) {
      if (/^0[1-9]$/.test(z.zone)) zones[z.zone] = { avg: z.value ?? '', temp: z.temp ?? '' }
    }
    return Object.keys(zones).length ? { zones } : null
  } catch {
    return null
  }
}
