// One number per MiLB level: the average age, as of today, of every player
// who cleared the playing-time floor there this season — the benchmark
// gen-prospect-trend.mjs compares a prospect's own age against for the
// Prospect Card's "N yrs younger than the level average" fact.
//
// Season-stats splits (fetchLevelSeasonStats) carry a player id and name but
// no birthDate, so this needs one extra bulk call per level: statsapi's
// /people endpoint accepts a comma-joined personIds list and returns each
// person's birthDate in one round trip. Ids are pooled across hitting AND
// pitching (age doesn't depend on which stat line qualified a player) and
// deduped before the batch fetch, then chunked — statsapi has no documented
// hard cap on personIds count, but a large single query risks a slow/failed
// response, so this stays conservative rather than betting the whole level on
// one request.
import { getPeople } from './statsapi.mjs'
import { qualifiedPlayerIds } from './prospectPercentile.mjs'
import { decimalAge } from '../../src/api/prospects/trend.js'

async function fetchBirthDates(ids) {
  // A failed batch leaves those players out of the average.
  const people = await getPeople(ids, { concurrency: 4, onError: () => {} })
  return new Map(people.map((p) => [p.id, p.birthDate]))
}

// hitSplits/pitSplits: the same raw season splits (any date range) gen-
// prospect-trend.mjs and its backfill already fetch per level. Returns
// { [sportId]: averageAge } — one decimal, null for a level with nobody
// qualified (rather than 0, which would read as a real number).
export async function fetchLevelAverageAges(hitSplits, pitSplits, sportIds, asOf = new Date()) {
  const idsBySport = new Map(sportIds.map((id) => [id, new Set()]))
  for (const [splits, group] of [
    [hitSplits, 'hitting'],
    [pitSplits, 'pitching'],
  ]) {
    const bySport = new Map()
    for (const sp of splits) {
      const sportId = sp.sport?.id
      if (!sportId) continue
      if (!bySport.has(sportId)) bySport.set(sportId, [])
      bySport.get(sportId).push(sp)
    }
    for (const [sportId, sportSplits] of bySport) {
      const ids = qualifiedPlayerIds(sportSplits, group)
      const set = idsBySport.get(sportId)
      if (set) for (const id of ids) set.add(id)
    }
  }

  const allIds = [...new Set([...idsBySport.values()].flatMap((s) => [...s]))]
  const birthDateById = allIds.length ? await fetchBirthDates(allIds) : new Map()

  const out = {}
  for (const [sportId, ids] of idsBySport) {
    const ages = [...ids]
      .map((id) => decimalAge(birthDateById.get(id), asOf))
      .filter((a) => Number.isFinite(a))
    out[sportId] = ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null
  }
  return out
}
