// The Milestone watch module's pure view and loader (src/screens/player/next/modules/milestones, #2017).
import test from 'node:test'
import assert from 'node:assert/strict'
import { milestonesView } from '../src/screens/player/next/modules/milestones/milestonesView.js'
import { milestonesFor } from '../src/screens/player/next/modules/milestones/milestonesData.js'

// public/data/milestones.json, 2026-10-13.
const yelich = [{ threshold: 250, value: 245, remaining: 5, stat: 'homeRuns', label: 'HR' }]
const yelichProj = [{ stat: 'homeRuns', threshold: 250, projection: { kind: 'year', year: 2027 } }]
const jansen = [{ threshold: 500, value: 498, remaining: 2, stat: 'saves', label: 'SV' }]

test('Yelich: bar 200..250 fills 90%, year projection, one mark', () => {
  const v = milestonesView({ rows: yelich, projections: yelichProj, role: 'hitting' })
  assert.equal(v.tag, '1 mark')
  assert.deepEqual([v.rows[0].from, v.rows[0].fill, v.rows[0].eta, v.rows[0].inked], [200, 90, '2027', true])
  assert.equal(v.note, null)
})

test('Jansen: bar 400..500 fills 98%', () => {
  const r = milestonesView({ rows: jansen, role: 'pitching' }).rows[0]
  assert.deepEqual([r.from, r.fill, r.eta], [400, 98, null])
})

test('first milestone starts the bar at 0', () => {
  const r = milestonesView({ rows: [{ threshold: 100, value: 90, remaining: 10, stat: 'saves', label: 'SV' }], role: 'pitching' }).rows[0]
  assert.deepEqual([r.from, r.fill], [0, 90])
})

test('postseason pause: no ETA, one note', () => {
  const v = milestonesView({ rows: yelich, projections: yelichProj, paused: true, role: 'hitting' })
  assert.equal(v.rows[0].eta, null)
  assert.match(v.note, /Projections resume/)
})

test('asOf set: no projection and no note', () => {
  const v = milestonesView({ rows: yelich, projections: yelichProj, paused: true, asOf: '2026-05-01', role: 'hitting' })
  assert.equal(v.rows[0].eta, null)
  assert.equal(v.note, null)
})

test('two marks: plural tag, only the nearest is inked, looked up by stat', () => {
  const rows = [...yelich, { threshold: 1000, value: 980, remaining: 20, stat: 'hits', label: 'H' }]
  const v = milestonesView({ rows, projections: yelichProj, role: 'hitting' })
  assert.equal(v.tag, '2 marks')
  assert.deepEqual(v.rows.map((r) => r.inked), [true, false])
  assert.deepEqual(v.rows.map((r) => r.eta), ['2027', null])
})

test('two-way player names the group; a one-role player does not', () => {
  assert.equal(milestonesView({ rows: yelich, twoWay: true, role: 'hitting' }).group, 'Batting')
  assert.equal(milestonesView({ rows: jansen, twoWay: true, role: 'pitching' }).group, 'Pitching')
  assert.equal(milestonesView({ rows: yelich, role: 'hitting' }).group, null)
})

test('no rows: null', () => {
  assert.equal(milestonesView({ rows: [], role: 'hitting' }), null)
})

test('loader: asOf asks for endDate = the day before; minors and no debut load nothing', async () => {
  const calls = []
  const stub = async (id, q) => (calls.push(q), [])
  await milestonesFor({ id: 1, debut: '2010-01-01' }, 'hitting', 2026, '2026-05-02', stub)
  assert.equal(calls.find((q) => q.type === 'byDateRange').endDate, '2026-05-01')
  assert.deepEqual(calls.map((q) => q.type).sort(), ['byDateRange', 'yearByYear'])
  calls.length = 0
  assert.deepEqual(await milestonesFor({ id: 1, debut: '2010-01-01', team: { parentOrgId: 9 } }, 'hitting', 2026, null, stub), [])
  assert.deepEqual(await milestonesFor({ id: 1 }, 'hitting', 2026, null, stub), [])
  assert.equal(calls.length, 0)
})

test('a projection prints only under the milestone it projects, matched by stat and threshold', () => {
  // A dated season shows the 250 mark; last night's file projects the 300 chase.
  const v = milestonesView({ rows: yelich, projections: [{ stat: 'homeRuns', threshold: 300, projection: { kind: 'year', year: 2029 } }], role: 'hitting' })
  assert.equal(v.rows[0].eta, null)
})
