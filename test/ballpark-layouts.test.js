// Unit coverage for the ballpark layout registry (#1859):
// src/lib/ballpark/layout/{configurations,fenceAudit,resolveLayout}.js and the
// CF label placement in ballparkGeometry.js.
//
// WHAT IS WORTH PINNING. The registry makes three claims, and each one can
// break without any visual sign:
//
//   1. The same venue on the same date resolves to the same configuration,
//      whether a caller has a venue id or only a (possibly old) name. A
//      renovated park resolves by date. A club that moved does not take its
//      old park's wall with it.
//   2. A traced outline that does not describe the current park is not drawn
//      for it. Globe Life Field drew the old Arlington wall for six seasons
//      because nothing checked.
//   3. The CF label sits where the CF sign stands, not at the fence's deepest
//      vertex (Houston's old trace put a "409" on a 433-ft wall).
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveBallparkLayout, allBallparkLayouts } from '../src/lib/ballpark/layout/resolveLayout.js'
import { CONFIGURATIONS, SEED } from '../src/lib/ballpark/layout/configurations.js'
import { auditFence, fenceDistanceAt, CF_TOLERANCE_FT } from '../src/lib/ballpark/layout/fenceAudit.js'
import { BALLPARKS, ballparkFor } from '../src/lib/ballpark/ballparkData.js'
import { WALLS } from '../src/lib/ballpark/ballparkFields.js'
import { buildFieldGeometry, HOME } from '../src/lib/ballpark/ballparkGeometry.js'

const layout = (q) => resolveBallparkLayout(q)?.configurationId ?? null

test('a venue id resolves its configuration by date across a renovation', () => {
  assert.equal(layout({ venueId: 2394, gameDate: '2022-09-30' }), 'comericapark-2000')
  assert.equal(layout({ venueId: 2394, gameDate: '2023-04-06' }), 'comericapark-2023')
  assert.equal(layout({ venueId: 14, gameDate: '2022-10-01' }), 'rogerscentre-1989')
  assert.equal(layout({ venueId: 14, gameDate: '2023-04-11' }), 'rogerscentre-2023')
  assert.equal(layout({ venueId: 2, gameDate: '2024-06-01' }), 'orioleparkatcamdenyards-2022')
  assert.equal(layout({ venueId: 2, gameDate: '2025-06-01' }), 'orioleparkatcamdenyards-2025')
})

test('the boundary days belong to the right season', () => {
  assert.equal(layout({ venueId: 2392, gameDate: '2016-12-31' }), 'daikinpark-2000')
  assert.equal(layout({ venueId: 2392, gameDate: '2017-01-01' }), 'daikinpark-2017')
  // A full ISO timestamp (the feed's gameDate) reads by its day.
  assert.equal(layout({ venueId: 2392, gameDate: '2016-10-02T18:10:00Z' }), 'daikinpark-2000')
})

test('a sponsor rename keeps the configuration; an old name still resolves by date', () => {
  const now = '2026-07-01'
  assert.equal(layout({ venueName: 'Minute Maid Park', gameDate: now }), 'daikinpark-2017')
  assert.equal(layout({ venueName: 'Daikin Park', gameDate: now }), 'daikinpark-2017')
  assert.equal(layout({ venueName: 'Minute Maid Park', gameDate: '2015-05-01' }), 'daikinpark-2000')
  assert.equal(layout({ venueName: 'Guaranteed Rate Field', gameDate: now }), 'ratefield')
  assert.equal(layout({ venueName: 'Dodger Stadium', gameDate: now }), 'uniqlofieldatdodgerstadium')
})

test('a relocated club does not take its old park with it', () => {
  // Rangers: Arlington through 2019, Globe Life Field from 2020. The old trace
  // lives on venue 13 only.
  assert.equal(layout({ venueId: 13, gameDate: '2019-08-01' }), 'globelifeparkinarlington')
  assert.equal(layout({ venueId: 13, gameDate: '2021-08-01' }), null)
  const glf = resolveBallparkLayout({ venueId: 5325, gameDate: '2024-08-01' })
  assert.equal(glf.configurationId, 'globelifefield')
  assert.equal(glf.geometry.fence, null)
  assert.equal(glf.quality.fence, 'dimensions-only')
  assert.equal(layout({ venueId: 5325, gameDate: '2019-08-01' }), null, 'not open yet')
  // Athletics: Sutter Health Park is its own venue with no trace.
  const sutter = resolveBallparkLayout({ venueId: 2529, gameDate: '2025-05-01' })
  assert.equal(sutter.quality.fence, 'dimensions-only')
  assert.equal(sutter.geometry.fence, null)
})

test('a venue with no record resolves to null, so callers say "not on file"', () => {
  // The Rays' 2025 season at George M. Steinbrenner Field (venue 2523).
  assert.equal(resolveBallparkLayout({ venueId: 2523, gameDate: '2025-05-01' }), null)
  // A MiLB park, by name.
  assert.equal(resolveBallparkLayout({ venueName: 'Louisville Slugger Field' }), null)
  assert.equal(resolveBallparkLayout({}), null)
  // A venue id wins over a name: a neutral site is its own venue.
  assert.equal(resolveBallparkLayout({ venueId: 2523, venueName: 'Tropicana Field' }), null)
})

test('every configuration id is unique and no two records of a venue overlap', () => {
  const ids = CONFIGURATIONS.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length)
  const byVenue = Map.groupBy(CONFIGURATIONS, (c) => c.venueId)
  for (const [venueId, configs] of byVenue) {
    for (const a of configs) {
      for (const b of configs) {
        if (a === b) continue
        const overlap = (a.from ?? '0000') <= (b.to ?? '9999') && (b.from ?? '0000') <= (a.to ?? '9999')
        assert.ok(!overlap, `venue ${venueId}: ${a.id} overlaps ${b.id}`)
      }
    }
    // A closed venue (Arlington) has none open-ended; no venue has two.
    assert.ok(configs.filter((c) => c.to == null).length <= 1, `venue ${venueId} has one current record at most`)
  }
})

test('every seed reference exists and every trace is used once at most', () => {
  const used = CONFIGURATIONS.filter((c) => c.fence === 'seed').map((c) => c.seedKey)
  for (const key of used) assert.ok(WALLS[key], `${key} is in ballparkFields.js`)
  assert.equal(new Set(used).size, used.length, 'one trace stands for one configuration')
  assert.match(SEED.revision, /^[0-9a-f]{40}$/, 'the upstream revision is pinned')
  assert.match(SEED.license, /MIT/)
})

test('a current record that draws a trace passes the audit or is marked estimated', () => {
  for (const l of allBallparkLayouts()) {
    if (!l.geometry.fence) continue
    assert.ok(l.audit, `${l.configurationId} was audited`)
    assert.equal(l.quality.fence, l.audit.pass ? 'audited' : 'estimated', l.configurationId)
  }
  // The two traces that miss today. If one starts to pass (or a new one starts
  // to fail), update the coverage report in docs/ballpark-layouts.md.
  const estimated = allBallparkLayouts().filter((l) => l.quality.fence === 'estimated')
  assert.deepEqual(estimated.map((l) => l.configurationId).sort(), ['oraclepark', 'yankeestadium'])
})

test('the rebuilt parks no longer draw the old wall', () => {
  for (const key of ['globelifefield', 'daikinpark', 'comericapark', 'rogerscentre', 'orioleparkatcamdenyards', 'loandepotpark', 'sutterhealthpark']) {
    assert.equal(BALLPARKS[key].arc, undefined, key)
  }
  assert.ok(ballparkFor('Fenway Park').arc, 'an audited park keeps its trace')
  assert.equal(ballparkFor('Comerica Park').dist.cf, 412)
})

test('the audit reads the CF sign at straightaway or at the deepest point', () => {
  // A flat wall 400 ft out with a notch whose vertex is 426.5 ft out at +10°.
  const fence = [[-250, 250], [0, 400], [70, 414], [74, 420], [80, 410], [250, 250]]
  assert.ok(Math.abs(fenceDistanceAt(fence, 0) - 400) < 0.01)
  const straight = auditFence(fence, 401)
  assert.equal(straight.cfMarkerAngle, 0)
  assert.ok(straight.pass)
  const deep = auditFence(fence, 426)
  assert.ok(deep.cfMarkerAngle > 5 && deep.cfMarkerAngle < 15)
  assert.ok(deep.pass)
  const miss = auditFence(fence, 427 + CF_TOLERANCE_FT)
  assert.equal(miss.pass, false)
  assert.equal(auditFence(null, 400), null)
})

test('the CF label sits at the CF sign, not the deepest vertex', () => {
  const dist = { lf: 330, lc: 370, cf: 400, rc: 370, rf: 330 }
  const wall = { lf: 8, cf: 8, rf: 8 }
  // Deepest vertex is 30 ft right of center; straightaway is 400.
  const arc = [[-233, 233], [-50, 395], [0, 400], [30, 440], [80, 400], [233, 233]]
  const g = buildFieldGeometry(dist, wall, arc)
  const cfLabel = g.labels[1]
  assert.equal(cfLabel.t, 400)
  assert.ok(Math.abs(cfLabel.x - HOME.x) < 0.01, 'straightaway: no sideways offset')
  // With the sign at the deepest point, the label moves there.
  const atDeep = buildFieldGeometry(dist, wall, arc, (Math.atan2(30, 440) * 180) / Math.PI)
  assert.ok(atDeep.labels[1].x > HOME.x + 20)
})

test("Fenway's 420 label sits at the triangle, right of straightaway", () => {
  const fenway = ballparkFor('Fenway Park')
  assert.ok(fenway.cfMarkerAngle > 5, 'the triangle is right of center')
  const g = buildFieldGeometry(fenway.dist, fenway.wall, fenway.arc, fenway.cfMarkerAngle)
  assert.ok(g.labels[1].x > HOME.x)
})
