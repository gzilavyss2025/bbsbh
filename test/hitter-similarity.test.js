// The "Hits like" skill-similarity engine (src/lib/hitterSimilarity.js). Every
// case here pins a decision the model makes that a simpler one wouldn't: the
// four-of-five metric floor, the mean-not-sum scaling, the deliberate omission
// of xwOBA, the calibrated match slope, and the match floor that keeps an
// isolated profile from collecting filler.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MIN_MATCH,
  PROFILE_KEYS,
  matchScore,
  profileDistance,
  profileVector,
  similarHitters,
} from '../src/lib/hitterSimilarity.js'

// One hitter's savant-percentiles.json `bat` entry. Defaults put every metric
// at the 50th so a case only has to state the columns it cares about.
const bat = (over = {}) => ({ ev: 50, hardHit: 50, brl: 50, chase: 50, sprintSpeed: 50, ...over })

// --------------------------------------------------------------------------
// profileVector — which metrics are in the space, and the sample floor
// --------------------------------------------------------------------------
test('the space is the five skill metrics, and xwOBA is not one of them', () => {
  assert.deepEqual(PROFILE_KEYS, ['ev', 'hardHit', 'brl', 'chase', 'sprintSpeed'])
  assert.ok(!PROFILE_KEYS.includes('xwoba'))
})

test('xwOBA is ignored even when the file carries it', () => {
  // It always does — the radar plots it from this same map. Dropping it is the
  // module's central choice (it double-counts the contact metrics), so a
  // hitter who differs ONLY on xwOBA must come out identical, not merely close.
  const v = profileVector({ ...bat(), xwoba: 99 })
  assert.ok(!('xwoba' in v))
  assert.equal(profileDistance(v, profileVector({ ...bat(), xwoba: 1 })), 0)
})

test('four of five known is comparable; three is not', () => {
  assert.notEqual(profileVector({ ev: 60, hardHit: 62, brl: 55, chase: 40 }), null)
  assert.equal(profileVector({ ev: 60, hardHit: 62, brl: 55 }), null)
})

test('a sprint-speed-only entry has no profile at all', () => {
  // The commonest shape in the real file: 309 of 559 bat entries this season
  // carry sprint speed and nothing else, because that leaderboard's qualifier
  // is far looser than the batted-ball ones.
  assert.equal(profileVector({ ev: null, hardHit: null, brl: null, chase: null, sprintSpeed: 58 }), null)
})

test('a missing or empty percentile map has no profile rather than an empty one', () => {
  assert.equal(profileVector(null), null)
  assert.equal(profileVector({}), null)
})

// --------------------------------------------------------------------------
// profileDistance
// --------------------------------------------------------------------------
test('a hitter is at zero distance from himself', () => {
  const v = profileVector(bat({ ev: 88, hardHit: 91, brl: 76, chase: 12, sprintSpeed: 44 }))
  assert.equal(profileDistance(v, v), 0)
})

test('distance is symmetric', () => {
  const a = profileVector(bat({ ev: 88, hardHit: 91, brl: 76, chase: 12, sprintSpeed: 44 }))
  const b = profileVector(bat({ ev: 31, hardHit: 27, brl: 40, chase: 83, sprintSpeed: 95 }))
  assert.equal(profileDistance(a, b), profileDistance(b, a))
})

test('opposite ends of every metric is maximum distance', () => {
  const top = profileVector(bat({ ev: 100, hardHit: 100, brl: 100, chase: 100, sprintSpeed: 100 }))
  const bottom = profileVector(bat({ ev: 0, hardHit: 0, brl: 0, chase: 0, sprintSpeed: 0 }))
  assert.equal(profileDistance(top, bottom), 1)
})

test('distance is a MEAN, so a four-metric pair ranks against a five-metric one', () => {
  // Both pairs are 10 percentile points apart on every metric they share. A
  // sum would make the five-metric pair look half again as distant purely for
  // having more data, and the two could not be ranked against each other.
  const five = profileDistance(profileVector(bat()), profileVector(bat({ ev: 60, hardHit: 60, brl: 60, chase: 60, sprintSpeed: 60 })))
  const four = profileDistance(
    profileVector({ ev: 50, hardHit: 50, brl: 50, chase: 50 }),
    profileVector({ ev: 60, hardHit: 60, brl: 60, chase: 60 }),
  )
  assert.equal(five, four)
})

test('three shared metrics has no distance even when both sides clear the floor', () => {
  // Each hitter is comparable on his own (four known), but they overlap on
  // only three — exactly the pair the floor exists to refuse, since whichever
  // three survived would decide the match.
  const a = profileVector({ ev: 60, hardHit: 62, brl: 55, chase: 40 })
  const b = profileVector({ ev: 60, hardHit: 62, brl: 55, sprintSpeed: 40 })
  assert.notEqual(a, null)
  assert.notEqual(b, null)
  assert.equal(profileDistance(a, b), null)
})

test('a missing vector has no distance rather than a misleading zero', () => {
  assert.equal(profileDistance(null, profileVector(bat())), null)
})

// --------------------------------------------------------------------------
// matchScore — the calibration, measured against the real file
// --------------------------------------------------------------------------
test('a uniform 10-point gap on every metric scores in the seventies', () => {
  // The anchor the slope was chosen around. Measured on this season's 250
  // qualified bats, a typical nearest neighbour sits .064 apart (match 84) and
  // a random pair .335 (match 16); a 10-point-per-metric gap is a real but
  // clearly imperfect resemblance and has to read as one — neither a 90 nor a
  // coin flip.
  const d = profileDistance(profileVector(bat()), profileVector(bat({ ev: 60, hardHit: 60, brl: 60, chase: 60, sprintSpeed: 60 })))
  assert.equal(d, 0.1)
  const m = matchScore(d)
  assert.ok(m >= 70 && m < 80, `10-point gap scored ${m}, outside the 70s`)
})

test('an identical profile is 100 and the floor sits at a 20-point mean gap', () => {
  assert.equal(matchScore(0), 100)
  assert.equal(matchScore(0.2), MIN_MATCH)
})

test('a worse-than-random pair clamps at zero rather than going negative', () => {
  // The slope crosses zero at a 40-point mean gap, which is wider than the
  // measured average random pair (33.5 points). Everything past it is equally
  // "no resemblance", and a negative match printed on a card is nonsense.
  assert.equal(matchScore(0.4), 0)
  assert.equal(matchScore(1), 0)
})

test('an unknown distance has no match score', () => {
  assert.equal(matchScore(null), null)
})

// --------------------------------------------------------------------------
// similarHitters — the ranking
// --------------------------------------------------------------------------
const POOL = [
  { personId: 1, pct: bat({ ev: 90, hardHit: 92, brl: 85, chase: 70, sprintSpeed: 30 }) },
  { personId: 2, pct: bat({ ev: 88, hardHit: 90, brl: 83, chase: 72, sprintSpeed: 33 }) },
  { personId: 3, pct: bat({ ev: 80, hardHit: 84, brl: 75, chase: 62, sprintSpeed: 42 }) },
  { personId: 4, pct: bat({ ev: 12, hardHit: 9, brl: 6, chase: 20, sprintSpeed: 97 }) },
  { personId: 5, pct: { ev: null, hardHit: null, brl: null, chase: null, sprintSpeed: 71 } },
]

test('the nearest profile ranks first', () => {
  const ranked = similarHitters(POOL, 1, { limit: 5 })
  assert.equal(ranked[0].personId, 2)
  assert.equal(ranked[1].personId, 3)
})

test('a hitter under the metric floor never appears', () => {
  const ids = similarHitters(POOL, 1, { limit: 5 }).map((p) => p.personId)
  assert.ok(!ids.includes(5))
})

test('the subject is never his own neighbour', () => {
  const ids = similarHitters(POOL, 1, { limit: 5 }).map((p) => p.personId)
  assert.ok(!ids.includes(1))
})

test('a hitter with no close comparison gets a SHORT list, never filler', () => {
  // Id 4 is a real, qualifying bat — a bottom-decile-power burner, the exact
  // opposite of the subject. Returning him to fill the card to three would
  // assert a resemblance that isn't there.
  const ids = similarHitters(POOL, 1, { limit: 5 }).map((p) => p.personId)
  assert.ok(!ids.includes(4))
  assert.equal(ids.length, 2)
})

test('every neighbour returned clears the match floor', () => {
  for (const p of similarHitters(POOL, 1, { limit: 5 })) {
    assert.ok(p.match >= MIN_MATCH, `${p.personId} scored ${p.match}, below the floor`)
  }
})

test('no handedness filter — bat side is not part of the model at all', () => {
  // Unlike the arsenal card, where a mirror-image lefty is filtered out. Two
  // hitters with the same contact, discipline and speed genuinely do hit alike
  // from opposite boxes, so a `bats` field on a pool entry must be inert.
  const pool = [
    { personId: 1, bats: 'R', pct: POOL[0].pct },
    { personId: 9, bats: 'L', pct: POOL[1].pct },
  ]
  assert.equal(similarHitters(pool, 1)[0].personId, 9)
})

test('limit caps the list', () => {
  assert.equal(similarHitters(POOL, 1, { limit: 1 }).length, 1)
  assert.equal(similarHitters(POOL, 1).length, 2) // default 3, only 2 clear the floor
})

test('a hitter missing from the pool yields no neighbours rather than throwing', () => {
  assert.deepEqual(similarHitters(POOL, 999), [])
})

test('a subject under the metric floor yields no neighbours', () => {
  assert.deepEqual(similarHitters(POOL, 5), [])
})

test('ids match across string and number forms, as the source file keys them', () => {
  // savant-percentiles.json is a JSON object, so its keys are strings while
  // every caller holds a numeric personId.
  assert.equal(similarHitters(POOL, '1', { limit: 1 })[0].personId, 2)
  const stringKeyed = POOL.map((p) => ({ ...p, personId: String(p.personId) }))
  assert.equal(similarHitters(stringKeyed, 1, { limit: 1 })[0].personId, '2')
})

test('ties break on personId so the list is stable across runs', () => {
  // Percentiles are whole numbers over a pool of a few hundred, so exact ties
  // are routine here rather than a corner case.
  const twin = (id) => ({ personId: id, pct: POOL[1].pct })
  const forward = similarHitters([POOL[0], twin(20), twin(10)], 1, { limit: 2 })
  const reversed = similarHitters([POOL[0], twin(10), twin(20)], 1, { limit: 2 })
  assert.deepEqual(forward.map((p) => p.personId), reversed.map((p) => p.personId))
})

test('every returned row carries the distance it was ranked on', () => {
  // The card prints `match`, but `distance` is what the ranking is, and a
  // caller re-sorting on the returned rows must get the same order.
  const ranked = similarHitters(POOL, 1, { limit: 5 })
  for (const p of ranked) {
    assert.ok(Number.isFinite(p.distance))
    assert.equal(p.match, matchScore(p.distance))
  }
  assert.ok(ranked[0].distance <= ranked[1].distance)
})
