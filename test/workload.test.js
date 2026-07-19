import assert from 'node:assert/strict'
import test from 'node:test'
import { workloadFor, availabilityFor, workloadVsBaseline } from '../src/api/workload.js'

// Synthetic workload.json-shaped data. `apps` are most-recent-first, each
// { d: 'YYYY-MM-DD', p: pitches, gs?: 1 }.
const data = {
  season: 2026,
  asOf: '2026-08-02',
  baselines: {
    SP: { last10: { mean: 900, sd: 60, n: 40 }, last3: { mean: 270, sd: 20, n: 40 }, app7: { mean: 1.4, sd: 0.5, n: 40 } },
    RP: { last10: { mean: 100, sd: 25, n: 120 }, last3: { mean: 40, sd: 12, n: 120 }, app7: { mean: 2.6, sd: 1.1, n: 120 } },
  },
  cohorts: { winning: {}, losing: {} },
  pitchers: {
    // Consecutive days straddling the July→August boundary.
    monthEdge: {
      name: 'Month Edge', teamId: 1, role: 'RP',
      apps: [
        { d: '2026-08-01', p: 18 },
        { d: '2026-07-31', p: 20 },
        { d: '2026-07-30', p: 15 },
      ],
      season: { g: 40, gs: 0, pitches: 640, outs: 120, bf: 160, strikes: 420 },
    },
    // Exactly two tired-flags, no 3-straight (35+ over 3 days AND back-to-back).
    downTwo: {
      name: 'Down Two', teamId: 2, role: 'RP',
      apps: [
        { d: '2026-06-15', p: 20 },
        { d: '2026-06-14', p: 20 },
      ],
      season: { g: 30, gs: 0, pitches: 450, outs: 90, bf: 120, strikes: 300 },
    },
    // Exactly one tired-flag (25+ yesterday only) -> limited.
    oneFlag: {
      name: 'One Flag', teamId: 3, role: 'RP',
      apps: [
        { d: '2026-07-15', p: 30 },
        { d: '2026-07-10', p: 12 },
      ],
      season: { g: 25, gs: 0, pitches: 300, outs: 75, bf: 100, strikes: 200 },
    },
    // An appearance ON the asOf date must be excluded.
    sameDay: {
      name: 'Same Day', teamId: 4, role: 'RP',
      apps: [
        { d: '2026-07-16', p: 40 },
        { d: '2026-07-14', p: 10 },
      ],
      season: { g: 20, gs: 0, pitches: 300, outs: 60, bf: 80, strikes: 200 },
    },
    // Even 10-app load for the vs-baseline math.
    steady: {
      name: 'Steady', teamId: 5, role: 'RP',
      apps: Array.from({ length: 10 }, (_, i) => ({ d: `2026-07-${String(15 - i).padStart(2, '0')}`, p: 20 })),
      season: { g: 20, gs: 0, pitches: 400, outs: 60, bf: 80, strikes: 260 },
    },
    // A starter — availability is a bullpen concept, so 'fresh' + last-start note.
    starter: {
      name: 'Starter', teamId: 6, role: 'SP',
      apps: [
        { d: '2026-07-10', p: 95, gs: 1 },
        { d: '2026-07-05', p: 88, gs: 1 },
      ],
      season: { g: 18, gs: 18, pitches: 1600, outs: 320, bf: 420, strikes: 1050 },
    },
    // Spread-out apps for the bucket day-span check.
    spread: {
      name: 'Spread', teamId: 7, role: 'RP',
      apps: [
        { d: '2026-07-14', p: 12 },
        { d: '2026-07-12', p: 14 },
        { d: '2026-07-10', p: 16 },
      ],
      season: { g: 15, gs: 0, pitches: 200, outs: 45, bf: 60, strikes: 130 },
    },
  },
}

test('consecutive-day counting works across a month boundary', () => {
  const w = workloadFor(data, 'monthEdge', '2026-08-02')
  assert.equal(w.consecDays, 3) // 07-30, 07-31, 08-01
  assert.equal(w.pitchedYesterday, true)
  assert.equal(w.backToBack, true)
  assert.equal(w.last1.date, '2026-08-01')
  assert.equal(w.last3.pitches, 53)
})

test('3-straight-days is a hard down flag', () => {
  const a = availabilityFor(data, 'monthEdge', '2026-08-02')
  assert.equal(a.status, 'down')
  assert.ok(a.reasons.some((r) => r.includes('3 straight days')))
})

test('two tired-flags without 3-straight is down', () => {
  // 07-14 (20) + 07-15 (20): 40 over 3 days AND back-to-back; consec = 2.
  const w = workloadFor(data, 'downTwo', '2026-06-16')
  assert.equal(w.consecDays, 2)
  const a = availabilityFor(data, 'downTwo', '2026-06-16')
  assert.equal(a.status, 'down')
  assert.ok(a.reasons.some((r) => r.includes('over 3 days')))
  assert.ok(a.reasons.some((r) => r.includes('back-to-back')))
  assert.ok(!a.reasons.some((r) => r.includes('straight days'))) // not the hard flag
})

test('exactly one tired-flag is limited', () => {
  const a = availabilityFor(data, 'oneFlag', '2026-07-16')
  assert.equal(a.status, 'limited')
  assert.deepEqual(a.reasons, ['30 pitches yesterday'])
})

test('asOfDate strictly excludes a same-day appearance', () => {
  const w = workloadFor(data, 'sameDay', '2026-07-16')
  assert.equal(w.last1.date, '2026-07-14') // 07-16 excluded
  assert.equal(w.pitchedYesterday, false) // no 07-15 appearance
  const a = availabilityFor(data, 'sameDay', '2026-07-16')
  assert.equal(a.status, 'fresh')
})

test('unknown pitcher and null data degrade to null', () => {
  assert.equal(workloadFor(data, 'nope', '2026-07-16'), null)
  assert.equal(availabilityFor(data, 'nope', '2026-07-16'), null)
  assert.equal(workloadVsBaseline(data, 'nope', '2026-07-16'), null)
  assert.equal(workloadFor(null, 'monthEdge', '2026-07-16'), null)
})

test('starters return fresh with a last-start note', () => {
  const a = availabilityFor(data, 'starter', '2026-07-16')
  assert.equal(a.status, 'fresh')
  assert.deepEqual(a.reasons, ['last start 6 days ago'])
})

test('vs-baseline computes role and own-norm percentages', () => {
  const v = workloadVsBaseline(data, 'steady', '2026-07-16')
  assert.equal(v.last10, 200) // 10 apps × 20
  assert.equal(v.ownNorm, 200) // 400 pitches / 20 g × 10
  assert.equal(v.vsOwnPct, 0)
  assert.equal(v.vsRolePct, 100) // (200 − 100) / 100
})

test('bucket day-span measures oldest appearance to asOf−1', () => {
  const w = workloadFor(data, 'spread', '2026-07-16')
  assert.equal(w.last3.apps, 3)
  assert.equal(w.last3.pitches, 42)
  assert.equal(w.last3.days, 5) // 07-10 → 07-15
})
