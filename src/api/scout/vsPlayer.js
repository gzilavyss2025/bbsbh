import { getJson } from '../statsapi.js'

// BEFORE PITCH TRACKING (slice 7b, ADR-0118): Savant has no rows before 2008,
// so a pair that met earlier gets the Stats API career line instead. Read ONLY
// the `vsPlayerTotal` entry. The `vsPlayer` entries (one per season) list each
// plate appearance a second time, so a sum doubles it (headToHead.js).
// Spoiler-free: a career line of finished seasons on an open page (ADR-0034).
export function parseVsPlayerTotal(json) {
  const s = json?.stats?.find((x) => x.type?.displayName === 'vsPlayerTotal')?.splits?.[0]?.stat
  if (!s) return null
  return { pa: s.plateAppearances, avg: s.avg, obp: s.obp, slg: s.slg, hr: s.homeRuns, k: s.strikeOuts, bb: s.baseOnBalls }
}

// Null on any failure: the panel then says "No meetings", as before.
export async function fetchVsPlayerTotal(hitterId, pitcherId) {
  try {
    return parseVsPlayerTotal(
      await getJson(`/api/v1/people/${hitterId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${pitcherId}&sportId=1`),
    )
  } catch {
    return null
  }
}
