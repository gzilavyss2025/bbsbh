// A club's World Series past, derived from the frozen finished-Series file
// (public/data/world-series/series.json, ADR-0114). Pure. `before` is the slate
// date, as in lastBefore.js (ADR-0087): a Series counts only when its season
// is strictly earlier than the slate date's year, so the Series being played
// now is never counted even if a fixture or a later file includes it.
//
// { lastWs, lastTitle } are seasons or null. A club that never reached a
// Series (the Mariners, 136) gets null for both. Club ids in the file are
// current franchise ids, so `clubs` and `winner` are read as they stand.
const ISO = /^\d{4}-\d{2}-\d{2}$/

export function franchiseHistory(seriesList, clubId, { before } = {}) {
  if (typeof before !== 'string' || !ISO.test(before)) {
    throw new Error('franchiseHistory: `before` must be an ISO date (YYYY-MM-DD)')
  }
  const year = Number(before.slice(0, 4))
  let lastWs = null
  let lastTitle = null
  for (const s of seriesList ?? []) {
    if (!(s.season < year)) continue
    if (!(s.clubs ?? []).includes(clubId)) continue
    if (lastWs == null || s.season > lastWs) lastWs = s.season
    if (s.winner === clubId && (lastTitle == null || s.season > lastTitle)) lastTitle = s.season
  }
  return { lastWs, lastTitle }
}
