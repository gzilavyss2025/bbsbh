// Coverage for the ABS Challenges card's plot geometry
// (src/screens/team/next/ranks/challenges/plotModel.js).
//
// The two rules that earned a test are the ones a reader would otherwise find
// by being fooled:
//
//   1. ONE OUTLIER MUST NOT FLATTEN THE OTHER THIRTEEN. A hitter at 37 reviews
//      beside a field that tops out at 15 pinned the axis at 40 and left
//      everyone else in the bottom third. The cap holds only with five or more
//      faces: with two catchers, the higher one is the plot, not an outlier.
//   2. SPREADING MOVES A FACE, NEVER ITS FIGURE. Faces that would stack are
//      pushed apart, and the true place stays in tx/ty for the leader line.
import assert from 'node:assert/strict'
import test from 'node:test'
import { challengeCard } from '../src/api/around-the-game/absClubCard.js'
import { buildPlot, niceStep, spread, tabPlacement, tickLabel, ticksBetween } from '../src/screens/team/next/ranks/challenges/plotModel.js'

test('niceStep picks 1, 2, 2.5 or 5 times a power of ten', () => {
  assert.equal(niceStep(0.7), 1)
  assert.equal(niceStep(4.5), 5)
  assert.equal(niceStep(9.25), 10)
  assert.equal(niceStep(61.7), 100)
  assert.equal(niceStep(2.2), 2.5)
  assert.equal(niceStep(0), 1)
})

test('ticks sit above the axis start, up to and including the end', () => {
  assert.deepEqual(ticksBetween(0, 3000, 1000), [1000, 2000, 3000])
  assert.deepEqual(ticksBetween(500, 3000, 1000), [1000, 2000, 3000])
  assert.deepEqual(ticksBetween(0, 20, 5), [5, 10, 15, 20])
  assert.equal(tickLabel(1000), '1k')
  assert.equal(tickLabel(2500), '2.5k')
  assert.equal(tickLabel(15000), '15k')
  assert.equal(tickLabel(40), '40')
})

const man = (id, pitches, calls, over = {}) => ({
  playerId: id,
  name: `Man ${id}`,
  pitches,
  plateAppearances: 300,
  asBatter: calls,
  wonBatter: Math.floor(calls / 2),
  ...over,
})
const jobOf = (men) => challengeCard({ levels: { MLB: { byTeam: { 1: men } } } }, 1).batter

test('called: the axis starts past zero when every face is far from it, and caps one outlier', () => {
  const men = [man(1, 2890, 7), man(2, 2409, 15), man(3, 2278, 10), man(4, 2190, 3), man(5, 1146, 37), man(6, 789, 2)]
  const plot = buildPlot(jobOf(men), 'called')
  assert.equal(plot.few, false)
  assert.equal(plot.x1, 3000)
  assert.equal(plot.x0, 500)
  assert.equal(plot.y1, 20)
  assert.deepEqual(plot.yt, [5, 10, 15, 20])
  const outlier = plot.points.find((p) => p.row.playerId === 5)
  assert.equal(outlier.off, true)
  assert.equal(plot.legend.off, true)
  assert.equal(plot.points.filter((p) => p.off).length, 1)
  assert.equal(plot.xTitle, 'Pitches seen')
  assert.equal(plot.yTitle, 'Reviews called')
  assert.ok(plot.line.slope > 0)
})

test('called: two faces are never an outlier', () => {
  const plot = buildPlot(jobOf([man(1, 5600, 65), man(2, 17500, 185)]), 'called')
  assert.equal(plot.few, true)
  assert.equal(plot.y1, 200)
  assert.equal(plot.points.some((p) => p.off), false)
})

test('success: reviews across, share won up, a flat line at the league share', () => {
  const men = [man(1, 2000, 10, { wonBatter: 6 }), man(2, 2000, 20, { wonBatter: 4 }), man(3, 2000, 0, { wonBatter: 0 }), man(4, 2000, 3, { wonBatter: 3 })]
  const job = jobOf(men)
  const plot = buildPlot(job, 'success')
  assert.equal(plot.y1, 100)
  assert.deepEqual(plot.yt, [25, 50, 75, 100])
  // The man with no reviews has no share and is not drawn.
  assert.deepEqual(plot.points.map((p) => p.row.playerId).sort(), [1, 2, 4])
  assert.equal(plot.points.find((p) => p.row.playerId === 4).thin, true)
  assert.equal(plot.legend.thin, true)
  assert.ok(Math.abs(plot.line.flat - job.league.success * 100) < 1e-9)
  assert.equal(plot.xTitle, 'Reviews called')
  assert.equal(plot.yTitle, 'Overturned')
})

test('the MLB average sits where the average regular and the league rate meet', () => {
  const job = jobOf([man(1, 2000, 10), man(2, 1000, 4)])
  const called = buildPlot(job, 'called')
  assert.deepEqual(called.average, { x: 1500, y: 7 })
  const success = buildPlot(job, 'success')
  assert.equal(success.average.x, 7)
  assert.ok(Math.abs(success.average.y - job.league.success * 100) < 1e-9)
})

test('spread: no two faces overlap, and the true place is kept', () => {
  const nodes = [0, 1, 2, 3, 4].map((i) => ({ id: i, tx: 100 + i * 3, ty: 100 }))
  const out = spread(nodes, { size: 32, bounds: { minX: 16, maxX: 300, minY: 16, maxY: 200 } })
  for (let i = 0; i < out.length; i++) {
    assert.equal(out[i].tx, nodes[i].tx)
    for (let j = i + 1; j < out.length; j++) {
      assert.ok(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) >= 32, `faces ${i} and ${j} overlap`)
    }
  }
  assert.deepEqual(out, spread(nodes, { size: 32, bounds: { minX: 16, maxX: 300, minY: 16, maxY: 200 } }))
})

test('spread: a face stays inside its bounds', () => {
  const out = spread([{ tx: -50, ty: 500 }], { size: 32, bounds: { minX: 16, maxX: 300, minY: 16, maxY: 200 } })
  assert.equal(out[0].x, 16)
  assert.equal(out[0].y, 200)
})

test('tabPlacement skips a spot that would cover another face, and never the face itself', () => {
  const opts = { tabWidth: 120, size: 32, width: 400, height: 280 }
  const node = { x: 200, y: 140 }
  // Nothing around: the first spot, above the face.
  const free = tabPlacement(node, [], opts)
  assert.ok(free.y < node.y - 16)
  // A neighbour above: the tab moves to a side.
  const blocked = tabPlacement(node, [{ x: 200, y: 100 }], opts)
  assert.ok(!(blocked.x < 220 && blocked.x + 120 > 180 && blocked.y < 116 && blocked.y + 26 > 84))
  // The tab never lies over its own face.
  for (const s of [free, blocked]) {
    assert.ok(!(s.x < node.x + 16 && s.x + 120 > node.x - 16 && s.y < node.y + 16 && s.y + 26 > node.y - 16))
  }
})

// The face's side is in two places: here, where faces are spread until their
// centres are one face apart, and in the stylesheet that draws them. A drift
// between the two overlaps faces or leaves gaps.
test('FACE_SIZE is the stylesheet\'s --chalplot-face', async () => {
  const { readFileSync } = await import('node:fs')
  const { FACE_SIZE } = await import('../src/screens/team/next/ranks/challenges/plotModel.js')
  const css = readFileSync(new URL('../src/styles/report/challenge-faces.css', import.meta.url), 'utf8')
  assert.match(css, new RegExp(`--chalplot-face:\\s*${FACE_SIZE}px`))
})
