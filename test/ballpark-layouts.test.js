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
//   2. An outline that does not describe the current park is not drawn for
//      it. Globe Life Field drew the old Arlington wall for six seasons because
//      nothing checked; Comerica's Gameday SVG still shows its pre-2023 wall.
//   3. The CF label sits where the CF sign stands, not at the fence's deepest
//      vertex (Houston's old trace put a "409" on a 433-ft wall).
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveBallparkLayout, allBallparkLayouts } from '../src/lib/ballpark/layout/resolveLayout.js'
import { CONFIGURATIONS, SEED } from '../src/lib/ballpark/layout/configurations.js'
import { auditFence, fenceDistanceAt, CF_TOLERANCE_FT } from '../src/lib/ballpark/layout/fenceAudit.js'
import { BALLPARKS, ballparkFor } from '../src/lib/ballpark/ballparkData.js'
import { WALLS } from '../src/lib/ballpark/ballparkFields.js'
import { buildFieldGeometry, diagramInput, HOME } from '../src/lib/ballpark/ballparkGeometry.js'
import { clipToFoulLines, fenceProblems, heightAt } from '../src/lib/ballpark/layout/fenceShape.js'
import { FIELDS } from '../src/lib/ballpark/layout/fences.js'
import { checkLayers } from '../scripts/lib/ballpark/field-svg.mjs'

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
  assert.equal(glf.provenance.fence.kind, 'gameday', 'its own outline, not the Arlington trace')
  assert.notDeepEqual(glf.geometry.fence, WALLS.globelifeparkinarlington)
  assert.equal(layout({ venueId: 5325, gameDate: '2019-08-01' }), null, 'not open yet')
  // Athletics: Sutter Health Park is its own venue with no trace.
  const sutter = resolveBallparkLayout({ venueId: 2529, gameDate: '2025-05-01' })
  assert.equal(sutter.quality.fence, 'dimensions-only')
  assert.equal(sutter.geometry.fence, null)
})

test('a venue with no record resolves to null, so callers say "not on file"', () => {
  // The Rays' 2025 season at George M. Steinbrenner Field (venue 2523).
  assert.equal(resolveBallparkLayout({ venueId: 2523, gameDate: '2025-05-01' }), null)
  // A park no source covers, by name.
  assert.equal(resolveBallparkLayout({ venueName: 'Nowhere Field' }), null)
  // Louisville Slugger Field was "not on file" before slice 3; it draws now.
  assert.equal(layout({ venueName: 'Louisville Slugger Field' }), 'milb-2724')
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

test('every drawn outline passed its audit', () => {
  for (const l of allBallparkLayouts()) {
    if (!l.geometry.fence) continue
    assert.ok(l.audit.pass, l.configurationId)
    // A minor-league outline is checked only against posted signs: an estimate.
    const kind = l.provenance.fence?.kind
    assert.equal(l.quality.fence, kind === 'milb' ? 'estimated' : 'audited', l.configurationId)
  }
})

test('a current park draws its Gameday outline or none, never a 2018 trace', () => {
  const traces = new Set(Object.values(WALLS))
  const current = CONFIGURATIONS.filter((cfg) => cfg.park && cfg.to == null)
  const fenceOf = (c) => resolveBallparkLayout({ venueId: c.venueId }).geometry.fence
  for (const c of current) {
    const fence = fenceOf(c)
    assert.ok(!traces.has(fence), `${c.id} draws a 2018 trace`)
    if (fence) assert.deepEqual(fence, FIELDS.venues[c.venueId].fence, c.id)
  }
  // The four whose SVG fails the audit against Savant 2026 (or has none). If
  // one starts to pass after a re-import, update docs/ballpark-layouts.md.
  const without = current.filter((c) => !fenceOf(c)).map((c) => c.park)
  assert.deepEqual(without.sort(), ['comericapark', 'kauffmanstadium', 'rogerscentre', 'sutterhealthpark'])
  assert.equal(ballparkFor('Comerica Park').dist.cf, 412)
})

test('wall heights are Savant\'s measured ones where it measures the park', () => {
  assert.deepEqual(ballparkFor('Fenway Park').wall, { lf: 37, cf: 17, rf: 4 })
  // The issue's Sutter Health example: 8 / 8 / 13, not the old flat 8s.
  assert.deepEqual(ballparkFor('Sutter Health Park').wall, { lf: 8, cf: 8, rf: 13 })
  const l = resolveBallparkLayout({ venueId: 2529, gameDate: '2026-05-01' })
  assert.equal(l.quality.wall, 'measured')
  // An older configuration never borrows today's measurements.
  const old = resolveBallparkLayout({ venueId: 2394, gameDate: '2022-05-01' })
  assert.equal(old.measurements.measured, null)
})

test('the imported store is complete for every current MLB park', () => {
  for (const c of CONFIGURATIONS.filter((cfg) => cfg.park && cfg.to == null)) {
    const v = FIELDS.venues[c.venueId]
    assert.ok(v?.measured, `venue ${c.venueId} has a Savant row`)
    if (v.fence) {
      assert.ok(v.audit.pass, `venue ${c.venueId} stores only a passing outline`)
      assert.ok(v.fence.length >= 4)
      // Pole to pole, left to right: the first point is in left field.
      assert.ok(v.fence[0][0] < 0 && v.fence.at(-1)[0] > 0)
    }
  }
  assert.match(FIELDS.generatedAt, /^\d{4}-\d{2}-\d{2}$/)
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
  const g = buildFieldGeometry({ dist, wall, fence: arc })
  const cfLabel = g.labels[1]
  assert.equal(cfLabel.t, 400)
  assert.ok(Math.abs(cfLabel.x - HOME.x) < 0.01, 'straightaway: no sideways offset')
  // With the sign at the deepest point, the label moves there.
  const atDeep = buildFieldGeometry({ dist, wall, fence: arc, cfAngle: (Math.atan2(30, 440) * 180) / Math.PI })
  assert.ok(atDeep.labels[1].x > HOME.x + 20)
})

test("Fenway's 420 label sits at the triangle, right of straightaway", () => {
  const fenway = resolveBallparkLayout({ venueName: 'Fenway Park', gameDate: '2026-07-01' })
  assert.ok(fenway.geometry.cfMarkerAngle > 5, 'the triangle is right of center')
  const g = buildFieldGeometry(diagramInput(fenway))
  assert.ok(g.labels[1].x > HOME.x)
})

test('every outline clips to the foul lines as a valid fence', () => {
  for (const l of allBallparkLayouts()) {
    if (!l.geometry.fence) continue
    const c = clipToFoulLines(l.geometry.fence)
    assert.deepEqual(fenceProblems(c), [], l.configurationId)
    const bearing = (p) => (Math.atan2(p[0], p[1]) * 180) / Math.PI
    assert.ok(Math.abs(bearing(c[0]) + 45) < 0.01 && Math.abs(bearing(c.at(-1)) - 45) < 0.01, l.configurationId)
  }
})

test('clipping cuts a trace that runs into foul ground at the line', () => {
  // Runs past both lines (a bullpen wall), then back.
  const fence = [[-260, 200], [-240, 240], [0, 400], [240, 240], [260, 200]]
  const c = clipToFoulLines(fence)
  assert.ok(Math.abs(c[0][0] + c[0][1]) < 0.01, 'starts on the LF line (x = -y)')
  assert.ok(Math.abs(c.at(-1)[0] - c.at(-1)[1]) < 0.01, 'ends on the RF line (x = y)')
  assert.deepEqual(c.slice(1, -1), [[0, 400]])
  // An end that stops short of the line is carried onto it, same distance.
  const short = clipToFoulLines([[-200, 260], [0, 400], [200, 260]])
  assert.ok(Math.abs(Math.hypot(...short[0]) - Math.hypot(200, 260)) < 0.01)
})

test('fenceProblems names a crossing, foul ground, and a backwards outline', () => {
  assert.match(fenceProblems([[-240, 240], [100, 380], [-100, 380], [240, 240]]).join(), /cross/)
  assert.match(fenceProblems([[-300, 100], [0, 400], [240, 240]]).join(), /foul territory/)
  assert.match(fenceProblems([[240, 240], [0, 400], [-240, 240]]).join(), /left field to right field/)
})

test("wall height follows Savant's five measured heights when present", () => {
  const five = { lf: 37, lc: 17, cf: 17, rc: 5, rf: 4 }
  assert.equal(heightAt(-45, five), 37)
  assert.equal(heightAt(-18, five), 17)
  assert.equal(heightAt(18, five), 5)
  assert.equal(heightAt(-31.5, five), 27)
  // Three heights only: line → CF → line.
  assert.equal(heightAt(-22.5, { lf: 8, cf: 16, rf: 8 }), 12)
  // The Fenway layout weights its stroke with the five.
  const fenway = resolveBallparkLayout({ venueName: 'Fenway Park', gameDate: '2026-07-01' })
  assert.ok(Number.isFinite(diagramInput(fenway).heights.lc))
})

test('a drawing that is not a checked outline says so', () => {
  const note = (q) => resolveBallparkLayout(q).accuracyNote
  assert.equal(note({ venueId: 3, gameDate: '2026-07-01' }), null, 'a checked Gameday outline needs no note')
  assert.match(note({ venueId: 2394, gameDate: '2026-07-01' }), /posted distances/)
  assert.match(note({ venueId: 2394, gameDate: '2022-07-01' }), /2018 drawing/)
  // An older record with no name of its own takes the park's current name.
  assert.equal(resolveBallparkLayout({ venueId: 2394, gameDate: '2022-07-01' }).name, 'Comerica Park')
})

test('every configuration builds a drawing, and prints only values it knows', () => {
  // A dated older wall knows its outline but not its heights (wall: null), and
  // may know only some distances: the 2022 Comerica sheet crashed on exactly
  // that. Unknown values are left off the drawing, never printed as "null′".
  for (const l of allBallparkLayouts()) {
    if (l.quality.fence === 'missing') continue
    const g = buildFieldGeometry(diagramInput(l))
    for (const t of [...g.labels.map((x) => x.t), ...g.wallTags.map((x) => x.h)]) {
      assert.ok(Number.isFinite(t), `${l.configurationId}: printed ${t}`)
    }
    for (const s of g.fenceSegs) assert.ok(Number.isFinite(s.h), `${l.configurationId}: stroke weight`)
  }
  const old = buildFieldGeometry(diagramInput(resolveBallparkLayout({ venueId: 2394, gameDate: '2022-06-15' })))
  assert.equal(old.wallTags.length, 0, 'no heights on file for the old wall')
  assert.deepEqual(old.labels.map((x) => x.t), [345, 420, 330])
  const kc = buildFieldGeometry(diagramInput(resolveBallparkLayout({ venueId: 7, gameDate: '2024-06-15' })))
  assert.deepEqual(kc.labels.map((x) => x.t), [410], 'only the CF distance is known for the old Kauffman wall')
})

// ── Minor-league parks (slice 3) ───────────────────────────────────────────

test('a minor-league park with a checked outline draws it, an estimate with no note', () => {
  // Principal Park (Iowa Cubs, venue 2844): posted 335 / 400 / 335.
  const l = resolveBallparkLayout({ venueId: 2844, gameDate: '2026-06-01' })
  assert.equal(l.configurationId, 'milb-2844')
  assert.equal(l.quality.fence, 'estimated')
  assert.equal(l.provenance.fence.kind, 'milb')
  // Gary, 2026-10-21: the "Wall from MLB's drawing of this park" note told the reader nothing,
  // so a checked minor-league outline prints none. The quality stays 'estimated'.
  assert.equal(l.accuracyNote, null)
  assert.equal(l.measurements.wall, null, 'no wall heights are known')
  // By name too: the feed's venue name resolves the same record.
  assert.equal(layout({ venueName: 'Principal Park', gameDate: '2026-06-01' }), 'milb-2844')
})

test('a minor-league park with no usable outline draws its five posted distances', () => {
  // Fifth Third Field (Toledo, venue 2767): the SVG parses to no wall.
  const l = resolveBallparkLayout({ venueId: 2767, gameDate: '2026-06-01' })
  assert.equal(l.quality.fence, 'dimensions-only')
  assert.equal(l.geometry.fence, null)
  assert.match(l.accuracyNote, /straight between the posted distances/)
})

test('a minor-league park resolves only from the imported season on', () => {
  // No dated history exists for minor-league walls: an older game gets nothing.
  assert.equal(layout({ venueId: 2844, gameDate: `${FIELDS.season - 1}-06-01` }), null)
})

test('a minor-league venue with nothing to draw stays "not on file"', () => {
  // Roger Dean Chevrolet Stadium (venue 2520) hosts two clubs; it resolves by
  // venue, so both clubs get the same answer: no outline, no five posted signs.
  assert.equal(resolveBallparkLayout({ venueId: 2520, gameDate: '2026-06-01' }), null)
  assert.equal(resolveBallparkLayout({ venueName: 'Roger Dean Chevrolet Stadium', gameDate: '2026-06-01' }), null)
})

test('every stored minor-league outline fits its posted signs and is a valid fence', () => {
  const venues = Object.entries(FIELDS.milb.venues)
  assert.ok(venues.length > 50, 'the import covers the minor-league parks')
  for (const [id, v] of venues) {
    if (!v.fence) {
      assert.ok(Object.values(v.posted).every(Number.isFinite), `${id}: kept only for its five posted distances`)
      continue
    }
    assert.ok(v.audit.pass, id)
    for (const k of ['lf', 'cf', 'rf']) assert.ok(Math.abs(v.audit[k]) <= FIELDS.milb.toleranceFt, `${id} ${k}`)
    assert.deepEqual(fenceProblems(clipToFoulLines(v.fence)), [], id)
  }
  // An MLB-measured park is never shadowed by the minor-league pass.
  assert.equal(FIELDS.milb.venues[2529], undefined, 'Sutter Health keeps its Savant row')
})

test('a sponsor rename never loses the park: the venue id wins over the name', () => {
  // A name nobody has added an alias for yet, with American Family Field's id.
  const park = ballparkFor('Some New Sponsor Field', 32)
  assert.equal(park?.name, 'American Family Field')
  assert.equal(ballparkFor('Some New Sponsor Field'), null, 'by name alone it is not on file')
  assert.equal(
    resolveBallparkLayout({ venueId: 32, venueName: 'Some New Sponsor Field', gameDate: '2026-07-01' }).configurationId,
    'americanfamilyfield',
  )
  // A minor-league rename the importer saw for next season: both names resolve.
  // Lehigh Valley's Coca-Cola Park (venue 3230) is Jefferson Park in the 2027 data.
  assert.equal(layout({ venueName: 'Coca-Cola Park', gameDate: '2026-07-01' }), 'milb-3230')
  assert.equal(layout({ venueName: 'Jefferson Park', gameDate: '2026-07-01' }), 'milb-3230')
})

// ── Foul ground, track, infield (slice 5) ──────────────────────────────────

test('each layer has its own quality: a checked fence does not check its foul ground', () => {
  const brewers = resolveBallparkLayout({ venueId: 32, gameDate: '2026-07-01' })
  assert.deepEqual(
    { fence: brewers.quality.fence, foul: brewers.quality.foul, track: brewers.quality.track, infield: brewers.quality.infield },
    { fence: 'audited', foul: 'estimated', track: 'estimated', infield: 'regulation' },
  )
  // Fenway's drawn track is 46 to 52 ft wide at the triangle and the RF bend: not stored.
  const fenway = resolveBallparkLayout({ venueId: 3, gameDate: '2026-07-01' })
  assert.equal(fenway.quality.foul, 'estimated')
  assert.equal(fenway.quality.track, 'stylized')
  // An older wall and a minor-league park keep the stylized layers.
  for (const q of [{ venueId: 2394, gameDate: '2022-07-01' }, { venueId: 2844, gameDate: '2026-07-01' }]) {
    const l = resolveBallparkLayout(q)
    assert.equal(l.quality.foul, 'stylized')
    assert.equal(l.quality.track, 'stylized')
  }
  // Estimates of a drawing carry no on-screen note (the owner's call).
  assert.equal(brewers.accuracyNote, null)
})

test("the drawing uses the park's own foul ground and track when it has them", () => {
  const brewers = resolveBallparkLayout({ venueId: 32, gameDate: '2026-07-01' })
  const own = buildFieldGeometry(diagramInput(brewers))
  const stylized = buildFieldGeometry({ ...diagramInput(brewers), surface: null, trackInner: null })
  assert.notEqual(own.foul, stylized.foul)
  assert.notEqual(own.track, stylized.track)
  // The surface path is the stored ring, behind the plate included.
  const ys = [...own.foul.matchAll(/-?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]))
  assert.ok(Math.max(...ys) > HOME.y + 35, 'the backstop sits behind home plate')
})

test('every stored foul ground and track passes its plausibility check', () => {
  let surfaces = 0
  for (const [id, v] of Object.entries(FIELDS.venues)) {
    if (!v.surface && !v.trackInner) continue
    assert.ok(v.fence, `${id}: soft layers ride only on an audited fence`)
    const ok = checkLayers(v.fence, v.measured.areaSqFt, v)
    if (v.surface) { assert.ok(ok.surface, `${id} surface`); surfaces++ }
    if (v.trackInner) assert.ok(ok.track, `${id} track`)
  }
  assert.ok(surfaces >= 20, 'most current MLB parks have their own foul ground')
})

test('a game date that was asked for and is missing resolves no layout; no date at all means today', () => {
  assert.equal(resolveBallparkLayout({ venueId: 32, gameDate: null }), null)
  assert.equal(resolveBallparkLayout({ venueId: 32, gameDate: '' }), null)
  assert.ok(resolveBallparkLayout({ venueId: 32 }))
})
