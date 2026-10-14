// The pure half of gen-pitch-starts.mjs (ADR-0111): one feed to its rows, the resume rule, the
// shards, and the three numeric verdicts of --verify. A generator file runs when imported, so the
// code worth testing lives here (scripts/CLAUDE.md).
import { bucketsOf } from '../io.js'
import { aggregateGamePitchTypes } from '../../gen-pitch-arsenal.mjs'
import { PITCH_TYPES } from '../../../src/lib/pitch/pitchTypes.js'

const KNOWN = new Set(PITCH_TYPES.map((t) => t.code))

// --- pure parts (exported for tests) -----------------------------------------

// One feed to `{ pit: { pitcherId: { code: n } }, mph: { pitcherId: { code: tenths } } }`. The stands are
// added together; a code with no speed gets no mph entry. Codes sorted, as the database orders them.
export function rowsOfFeed(feed) {
  const pit = {}
  const mph = {}
  for (const [id, p] of aggregateGamePitchTypes(feed)) {
    const sums = {}
    for (const [key, t] of p.types) {
      const s = (sums[key.split(':')[0]] ??= { n: 0, vSum: 0, vN: 0 })
      s.n += t.pitches
      s.vSum += t.velocitySum
      s.vN += t.velocityN
    }
    for (const code of Object.keys(sums).sort()) {
      const { n, vSum, vN } = sums[code]
      ;(pit[id] ??= {})[code] = n
      if (vN) (mph[id] ??= {})[code] = Math.round((vSum / vN) * 10)
    }
  }
  return { pit, mph }
}

export function addGame(store, gamePk, { pit, mph }) {
  for (const [part, rows] of [['pit', pit], ['mph', mph]]) {
    for (const [id, codes] of Object.entries(rows)) (store[part][id] ??= {})[gamePk] = codes
  }
}

export const gamesOf = (store) => new Set(Object.values(store.pit).flatMap(Object.keys))

// Resume: the games the store does not hold yet.
export function pendingGames(pks, store) {
  const have = gamesOf(store)
  return pks.filter((pk) => !have.has(String(pk)))
}

// The same entries writeStarts gives: the mix shards, then the speed shards named NN.mph.
export const shardsOf = (season, { pit, mph }) => [
  ...bucketsOf({ season }, pit, {}),
  ...bucketsOf({ season }, mph, {}, 'mph').map(([k, b]) => [`${k}.mph`, b]),
]

// Check 1: at least 99% of the season's Final games have a row.
export function coverageVerdict(pks, store) {
  const have = gamesOf(store)
  const missing = pks.filter((pk) => !have.has(String(pk)))
  return { ok: pks.length > 0 && (pks.length - missing.length) * 100 >= pks.length * 99, total: pks.length, missing: missing.slice(0, 20) }
}

// Check 2: `pairs` is `[{ stored, box }]`, one per pitcher and game.
export function boxVerdict(pairs) {
  const near = pairs.filter((p) => Math.abs(p.stored - p.box) <= 3).length
  const sum = (k) => pairs.reduce((a, p) => a + p[k], 0)
  const pairsOk = near * 100 >= pairs.length * 95
  const totalOk = Math.abs(sum('stored') - sum('box')) * 100 <= sum('box')
  return { ok: pairs.length > 0 && pairsOk && totalOk, pairsOk, totalOk, near, n: pairs.length, stored: sum('stored'), box: sum('box') }
}

// Check 3: `counts` is `{ code: pitches }`. Unknown codes fail only above 2% of all pitches.
export function codesVerdict(counts) {
  const unknown = Object.fromEntries(Object.entries(counts).filter(([c]) => !KNOWN.has(c)))
  const sum = (o) => Object.values(o).reduce((a, n) => a + n, 0)
  return { ok: sum(unknown) * 100 <= sum(counts) * 2, unknown }
}
