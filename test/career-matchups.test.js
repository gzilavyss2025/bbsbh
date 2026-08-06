// Unit coverage for the pure lookup/format helpers behind the lineup page's
// "Career vs today's starter" card (src/api/careerMatchups.js, wired into
// TeamInfo.jsx's StarterMatchups).
//
// The sortByPitcher/groupByPitcher helpers this file used to cover are gone
// with the card that needed them: it crossed every batter with every pitcher
// on the other club and had to re-group the interleaved result. The card is
// now scoped to the one probable starter, so the generator emits a single
// already-ordered list per side and there is nothing left to regroup.
import assert from 'node:assert/strict'
import test from 'node:test'
import { starterMatchupsFor, splitMatchupRows, matchupLine } from '../src/api/careerMatchups.js'

function batter(id, pa) {
  return { id, name: `Batter ${id}`, ab: pa, h: 0, hr: 0, bb: 0, hbp: 0, k: 0, pa, levels: [] }
}

const data = {
  matchups: {
    777: {
      sides: {
        158: { pitcher: { id: 10, name: 'Away Starter' }, batters: [batter(1, 9), batter(2, 4)] },
        134: { pitcher: { id: 20, name: 'Home Starter' }, batters: [batter(3, 6)] },
      },
    },
    // Game 2 of the same day's doubleheader: same two clubs, different arms.
    778: {
      sides: {
        158: { pitcher: { id: 30, name: 'Game Two Starter' }, batters: [batter(1, 2)] },
      },
    },
    // A side the generator reached but found no history for.
    779: { sides: { 158: { pitcher: { id: 40, name: 'Debutant' }, batters: [] } } },
  },
}

// --- starterMatchupsFor ------------------------------------------------------

test('starterMatchupsFor returns the batting club\'s own side, not the opponent\'s', () => {
  const side = starterMatchupsFor(data, 777, 158)
  assert.equal(side.pitcher.name, 'Away Starter')
  assert.deepEqual(side.batters.map((b) => b.id), [1, 2])
})

test('starterMatchupsFor resolves a numeric gamePk against the file\'s string keys', () => {
  // The live feed carries gamePk as a number; JSON object keys are strings.
  assert.equal(starterMatchupsFor(data, 777, 158).pitcher.id, 10)
  assert.equal(starterMatchupsFor(data, '777', '158').pitcher.id, 10)
})

test('starterMatchupsFor keeps a doubleheader\'s two games on their own starters', () => {
  // The regression this file's gamePk key exists for: keyed by team pair, both
  // games of a doubleheader (and every night of a series) collapsed onto
  // whichever starter happened to be processed last.
  assert.equal(starterMatchupsFor(data, 777, 158).pitcher.name, 'Away Starter')
  assert.equal(starterMatchupsFor(data, 778, 158).pitcher.name, 'Game Two Starter')
})

test('starterMatchupsFor is null for a side with no career history', () => {
  assert.equal(starterMatchupsFor(data, 779, 158), null)
})

test('starterMatchupsFor is null for an unknown game, an unknown club, or missing data', () => {
  assert.equal(starterMatchupsFor(data, 999, 158), null)
  assert.equal(starterMatchupsFor(data, 777, 111), null)
  assert.equal(starterMatchupsFor(null, 777, 158), null)
  assert.equal(starterMatchupsFor({ matchups: {} }, 777, 158), null)
})

test('starterMatchupsFor is null when the game or club is unset', () => {
  // A cold load renders before the feed lands, so both arrive undefined.
  assert.equal(starterMatchupsFor(data, undefined, 158), null)
  assert.equal(starterMatchupsFor(data, 777, undefined), null)
})

// --- splitMatchupRows --------------------------------------------------------

test('splitMatchupRows indexes every row by batter id for the inline lookup', () => {
  const side = starterMatchupsFor(data, 777, 158)
  const { byId } = splitMatchupRows(side, new Set([1, 2]))
  assert.equal(byId.get(1).pa, 9)
  assert.equal(byId.get(2).pa, 4)
})

test('splitMatchupRows sends a batter who is NOT in the posted nine to the bench list', () => {
  // The case that makes the bench row necessary: measured across a real slate,
  // every side had at least one of these, so annotating only the posted nine
  // would drop a live pinch-hit read every game.
  const side = starterMatchupsFor(data, 777, 158)
  const { byId, bench } = splitMatchupRows(side, new Set([1]))
  assert.deepEqual(bench.map((r) => r.id), [2])
  // Still indexed — the bench row renders from the same records.
  assert.equal(byId.size, 2)
})

test('splitMatchupRows leaves the bench empty when every batter is in the order', () => {
  const side = starterMatchupsFor(data, 777, 158)
  assert.deepEqual(splitMatchupRows(side, new Set([1, 2])).bench, [])
})

test('splitMatchupRows benches nobody before a lineup posts', () => {
  // No posted order means the card is listing the whole roster, so every
  // batter's line goes inline and there is nothing left over to collect.
  const side = starterMatchupsFor(data, 777, 158)
  assert.deepEqual(splitMatchupRows(side, new Set()).bench, [])
  assert.deepEqual(splitMatchupRows(side, undefined).bench, [])
  assert.equal(splitMatchupRows(side, new Set()).byId.size, 2)
})

test('splitMatchupRows survives a null side', () => {
  const { byId, bench } = splitMatchupRows(null, new Set([1]))
  assert.equal(byId.size, 0)
  assert.deepEqual(bench, [])
})

// --- matchupLine -------------------------------------------------------------

test('matchupLine renders the bare AB/H line with no extras or levels', () => {
  const r = { h: 2, ab: 7, hr: 0, bb: 0, k: 0, levels: [] }
  assert.equal(matchupLine(r, 'MLB'), '2-for-7')
})

test('matchupLine appends only the nonzero extras, in HR/BB/K order', () => {
  const r = { h: 1, ab: 3, hr: 1, bb: 0, k: 2, levels: [] }
  assert.equal(matchupLine(r, 'MLB'), '1-for-3, 1 HR, 2 K')
})

test('matchupLine drops the level tag when history is entirely at tonight\'s own level', () => {
  const r = { h: 1, ab: 4, hr: 0, bb: 0, k: 0, levels: ['AA'] }
  assert.equal(matchupLine(r, 'AA'), '1-for-4')
})

test('matchupLine keeps the level tag, including tonight\'s level, when history spans more than one level', () => {
  const r = { h: 3, ab: 9, hr: 0, bb: 0, k: 0, levels: ['AA', 'A+'] }
  assert.equal(matchupLine(r, 'AA'), '3-for-9 — AA, A+')
})

test('matchupLine keeps a single non-tonight level tag', () => {
  const r = { h: 0, ab: 2, hr: 0, bb: 0, k: 0, levels: ['A+'] }
  assert.equal(matchupLine(r, 'AA'), '0-for-2 — A+')
})
