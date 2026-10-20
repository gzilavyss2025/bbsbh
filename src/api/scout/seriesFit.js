import { fetchSprayFor, decodeSprayBalls } from '../spray.js'
import { getJson } from '../statsapi.js'
import { fetchHotBatSplits } from '../postseason/worldSeriesHome.js'
import { topHitters } from '../../lib/postseason/worldseries/scouting/pitchByPitch.js'

// The reads behind the World Series scouting cards Platoon and Park fit (#2316, slice 2).
// OPEN SURFACE (ADR-0034), no score. Platoon reads the regular-season totals, which are over before
// the Series starts, so no read reaches the slate date; Park fit reads the spray store (balls from
// games already Final) and the postseason PA that ends the day before `slateDate`.

// Field paths checked against live statsapi on 2026-10-19 (Brewers 158): stats[0].splits[] holds
// { split: { code: 'vl' | 'vr' }, stat: { ops: '.828', ... } }, one row per hand of the pitcher.
export const platoonUrl = (clubId, season) =>
  `/api/v1/teams/${clubId}/stats?stats=statSplits&group=hitting&season=${season}&sitCodes=vl,vr&gameType=R`

// -> { R, L }: the club's OPS against right- and left-handers, null when the feed has none.
export function shapePlatoon(data) {
  const ops = { R: null, L: null }
  for (const s of data?.stats?.[0]?.splits ?? []) {
    const hand = { vr: 'R', vl: 'L' }[s.split?.code]
    const v = Number(s.stat?.ops)
    if (hand && Number.isFinite(v)) ops[hand] = v
  }
  return ops
}

// -> { [clubId]: { R, L } }. A club with no splits is left out; a failed read throws.
export async function loadPlatoon({ clubIds, season }) {
  const rows = await Promise.all(clubIds.map((id) => getJson(platoonUrl(id, season)).then(shapePlatoon)))
  return Object.fromEntries(clubIds.map((id, i) => [id, rows[i]]).filter(([, r]) => r))
}

// -> { [clubId]: balls[] }: the regular-season balls in play of the club's regulars (its hitters
// with the most postseason PA, as Pitch by pitch picks them), with the contact columns aligned.
export async function loadParkFit({ clubIds, slateDate }) {
  const season = Number(slateDate.slice(0, 4))
  const rows = await Promise.all(
    clubIds.map(async (clubId) => {
      const ids = topHitters(await fetchHotBatSplits(season, clubId, slateDate))
      const datas = await Promise.all(ids.map((id) => fetchSprayFor(id, { seasonYear: season, contact: true })))
      return [clubId, datas.flatMap((d, i) => decodeSprayBalls(d?.bat?.[ids[i]], season))]
    }),
  )
  return Object.fromEntries(rows)
}
