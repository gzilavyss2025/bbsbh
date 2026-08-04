// The "Pitches like" arsenal-similarity engine (src/lib/pitcherSimilarity.js).
// Every case here pins a decision the model makes that a simpler one wouldn't:
// the relabeling groups, the velocity weighting, the no-overlap floor, and the
// handedness filter. See .scratch/player-profile-card/scope.md §4.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MIN_MATCH,
  MIN_SIMILARITY_PITCHES,
  arsenalDistance,
  arsenalVector,
  matchScore,
  pitchGroup,
  similarPitchers,
} from '../src/lib/pitcherSimilarity.js'

// A pitcher's rows in pitch-arsenal.json's shape. Counts are scaled so every
// fixture clears MIN_SIMILARITY_PITCHES without each test having to think
// about it.
const arm = (...rows) => rows.map(([code, pitches, avgVelo]) => ({ code, pitches, avgVelo }))

// --------------------------------------------------------------------------
// pitchGroup — which codes are the same pitch under another name
// --------------------------------------------------------------------------
test('sinker and two-seam are one pitch; four-seam is a different one', () => {
  assert.equal(pitchGroup('SI'), pitchGroup('FT'))
  assert.notEqual(pitchGroup('SI'), pitchGroup('FF'))
})

test('the slider and curve families each collapse, and never into each other', () => {
  assert.equal(pitchGroup('SL'), pitchGroup('ST'))
  assert.equal(pitchGroup('SL'), pitchGroup('SV'))
  assert.equal(pitchGroup('CU'), pitchGroup('KC'))
  assert.notEqual(pitchGroup('SL'), pitchGroup('CU'))
})

test('an unlisted code is its own group — a knuckleball is like nothing else', () => {
  assert.equal(pitchGroup('KN'), 'KN')
  assert.notEqual(pitchGroup('KN'), pitchGroup('CU'))
})

// --------------------------------------------------------------------------
// arsenalVector — shares, pooled velocity, and the sample floor
// --------------------------------------------------------------------------
test('shares sum to 1 regardless of raw pitch counts', () => {
  const v = arsenalVector(arm(['FF', 300, 95], ['SL', 100, 85]))
  assert.equal(v.byCode.get('FF'), 0.75)
  assert.equal(v.byCode.get('SL'), 0.25)
})

test('a pitcher under the sample floor has no vector at all', () => {
  assert.equal(arsenalVector(arm(['FF', MIN_SIMILARITY_PITCHES - 1, 95])), null)
  assert.notEqual(arsenalVector(arm(['FF', MIN_SIMILARITY_PITCHES, 95])), null)
})

test('a split slider/sweeper pools into one breaking ball at its weighted speed', () => {
  // 100 sliders at 84 and 300 sweepers at 80 is one breaking ball at 81,
  // not two thin ones — the weighted mean, not the plain mean of 82.
  const v = arsenalVector(arm(['FF', 400, 95], ['SL', 100, 84], ['ST', 300, 80]))
  const breaking = v.groups.get(pitchGroup('SL'))
  assert.equal(breaking.share, 0.5)
  assert.equal(breaking.velo, 81)
})

test('a row with no tracked velocity still counts toward share', () => {
  const v = arsenalVector(arm(['FF', 200, 95], ['KN', 200, null]))
  assert.equal(v.byCode.get('KN'), 0.5)
  assert.equal(v.groups.get('KN').velo, null)
})

// --------------------------------------------------------------------------
// arsenalDistance
// --------------------------------------------------------------------------
test('a pitcher is at zero distance from himself', () => {
  const v = arsenalVector(arm(['SI', 500, 96], ['ST', 200, 84], ['CH', 150, 88]))
  assert.equal(arsenalDistance(v, v), 0)
})

test('no pitch in common is maximum distance', () => {
  const a = arsenalVector(arm(['FF', 400, 95]))
  const b = arsenalVector(arm(['CU', 400, 78]))
  assert.equal(arsenalDistance(a, b), 1)
})

test('sharing nothing scores worse than sharing everything at a different speed', () => {
  // The no-overlap case returns 1 for the velocity half deliberately (see the
  // module comment) — so it must not come out AHEAD of a real shape match
  // that happens to differ on speed, which is the bug that scoring it 0 causes.
  const subject = arsenalVector(arm(['FF', 400, 95]))
  const sameShapeSlower = arsenalVector(arm(['FF', 400, 87]))
  const nothingInCommon = arsenalVector(arm(['CU', 400, 78]))
  assert.ok(arsenalDistance(subject, sameShapeSlower) < arsenalDistance(subject, nothingInCommon))
})

test('a relabelled sweeper is close but not identical to a slider', () => {
  const slider = arsenalVector(arm(['FF', 600, 95], ['SL', 400, 84]))
  const sweeper = arsenalVector(arm(['FF', 600, 95], ['ST', 400, 84]))
  const changeup = arsenalVector(arm(['FF', 600, 95], ['CH', 400, 84]))
  const relabel = arsenalDistance(slider, sweeper)
  assert.ok(relabel > 0, 'a different code still costs something')
  assert.ok(relabel < arsenalDistance(slider, changeup), 'but far less than a genuinely different pitch')
})

test('same mix at a very different speed is not a match', () => {
  const hard = arsenalVector(arm(['SI', 500, 97], ['ST', 300, 86]))
  const soft = arsenalVector(arm(['SI', 500, 88], ['ST', 300, 77]))
  const near = arsenalVector(arm(['SI', 500, 96], ['ST', 300, 85]))
  assert.ok(arsenalDistance(hard, near) < arsenalDistance(hard, soft))
})

test('velocity on a pitch neither leans on barely moves the distance', () => {
  // Both are 95% four-seam; they disagree by a full spread on a 5% curveball.
  // That must cost far less than the same disagreement on the four-seam.
  const base = arsenalVector(arm(['FF', 950, 95], ['CU', 50, 80]))
  const offPitchDiffers = arsenalVector(arm(['FF', 950, 95], ['CU', 50, 72]))
  const mainPitchDiffers = arsenalVector(arm(['FF', 950, 87], ['CU', 50, 80]))
  assert.ok(arsenalDistance(base, offPitchDiffers) < arsenalDistance(base, mainPitchDiffers))
})

test('distance is symmetric', () => {
  const a = arsenalVector(arm(['SI', 400, 94], ['CH', 200, 87]))
  const b = arsenalVector(arm(['FF', 300, 96], ['SL', 300, 85]))
  assert.equal(arsenalDistance(a, b), arsenalDistance(b, a))
})

test('a missing vector has no distance rather than a misleading zero', () => {
  assert.equal(arsenalDistance(null, arsenalVector(arm(['FF', 400, 95]))), null)
})

// --------------------------------------------------------------------------
// matchScore
// --------------------------------------------------------------------------
test('match score runs 100 down to 0 as distance runs 0 up to 1', () => {
  assert.equal(matchScore(0), 100)
  assert.equal(matchScore(1), 0)
  assert.equal(matchScore(0.25), 75)
})

// --------------------------------------------------------------------------
// similarPitchers — the ranking, and the handedness filter
// --------------------------------------------------------------------------
const POOL = [
  { personId: 1, name: 'Subject', teamId: 158, throws: 'R', types: arm(['SI', 500, 96], ['ST', 250, 84], ['CH', 150, 88]) },
  { personId: 2, name: 'Near Righty', teamId: 116, throws: 'R', types: arm(['SI', 480, 95], ['ST', 260, 85], ['CH', 160, 87]) },
  { personId: 3, name: 'Far Righty', teamId: 117, throws: 'R', types: arm(['FF', 800, 99], ['CU', 100, 78]) },
  { personId: 4, name: 'Mirror Lefty', teamId: 118, throws: 'L', types: arm(['SI', 500, 96], ['ST', 250, 84], ['CH', 150, 88]) },
  { personId: 5, name: 'Cameo', teamId: 119, throws: 'R', types: arm(['SI', 20, 96]) },
]

test('the nearest arsenal ranks first', () => {
  const [top] = similarPitchers(POOL, 1)
  assert.equal(top.name, 'Near Righty')
})

test('a mirror-image lefty is filtered out however well his arsenal matches', () => {
  const names = similarPitchers(POOL, 1, { limit: 5 }).map((p) => p.name)
  assert.ok(!names.includes('Mirror Lefty'))
})

test('a pitcher under the sample floor never appears', () => {
  const names = similarPitchers(POOL, 1, { limit: 5 }).map((p) => p.name)
  assert.ok(!names.includes('Cameo'))
})

test('the subject is never his own neighbour', () => {
  const ids = similarPitchers(POOL, 1, { limit: 5 }).map((p) => p.personId)
  assert.ok(!ids.includes(1))
})

test('a pitcher missing from the pool yields no neighbours rather than throwing', () => {
  assert.deepEqual(similarPitchers(POOL, 999), [])
})

test('a subject under the sample floor yields no neighbours', () => {
  assert.deepEqual(similarPitchers(POOL, 5), [])
})

test('limit caps the list', () => {
  assert.equal(similarPitchers(POOL, 1, { limit: 1 }).length, 1)
  assert.equal(similarPitchers(POOL, 1, { limit: 5 }).length, 1) // only 1 clears MIN_MATCH
})

test('a pitcher with no close comparison gets a SHORT list, never filler', () => {
  // 'Far Righty' is a real, qualifying, same-handed arm — he's just nothing
  // like the subject. Returning him to fill the card out would assert a
  // resemblance that isn't there.
  const weak = similarPitchers(POOL, 1, { limit: 5 }).find((p) => p.name === 'Far Righty')
  assert.equal(weak, undefined)
})

test('every neighbour returned clears the match floor', () => {
  for (const p of similarPitchers(POOL, 1, { limit: 5 })) {
    assert.ok(p.match >= MIN_MATCH, `${p.name} scored ${p.match}, below the floor`)
  }
})

test('a candidate with no known hand is skipped rather than guessed', () => {
  const pool = [...POOL, { personId: 6, name: 'Unknown Hand', teamId: 120, types: POOL[1].types }]
  const names = similarPitchers(pool, 1, { limit: 5 }).map((p) => p.name)
  assert.ok(!names.includes('Unknown Hand'))
})

test('when the SUBJECT has no known hand the filter lifts rather than emptying the card', () => {
  // A pitcher the source file has no hand for should still get neighbours —
  // the alternative is a card that silently never renders for him.
  const pool = POOL.map((p) => (p.personId === 1 ? { ...p, throws: undefined } : p))
  const names = similarPitchers(pool, 1, { limit: 5 }).map((p) => p.name)
  assert.ok(names.includes('Mirror Lefty'))
})

test('ties break on personId so the list is stable across runs', () => {
  const twin = (id) => ({ personId: id, name: `Twin ${id}`, teamId: 1, throws: 'R', types: POOL[1].types })
  const forward = similarPitchers([POOL[0], twin(20), twin(10)], 1, { limit: 2 })
  const reversed = similarPitchers([POOL[0], twin(10), twin(20)], 1, { limit: 2 })
  assert.deepEqual(forward.map((p) => p.personId), reversed.map((p) => p.personId))
})
