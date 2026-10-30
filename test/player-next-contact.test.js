import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ballDetail, contactBalls, contactView, firstView, markKey, menuRows, mixRows, pickBalls, typeOf,
} from '../src/screens/player/next/modules/contact/contactView.js'

// The batter Contact view (#1888): the spray field's ball marks, the batted-ball mix and the
// tapped-ball detail. The board's numbers are samples; these are built.

const ball = (o = {}) => ({
  x: 150, y: 80, exitVelo: 90, result: 'out', launchAngle: 15, distance: 200, xba: 0.4, barrel: false, gamePk: 1, level: 'mlb', ...o,
})
const MANY = (n, o) => Array.from({ length: n }, () => ball(o))

test('typeOf: Statcast bands, null without a launch angle', () => {
  assert.deepEqual([-5, 9, 10, 24, 25, 50, 51].map(typeOf), ['ground', 'ground', 'line', 'line', 'fly', 'fly', 'pop'])
  assert.equal(typeOf(null), null)
})

test('contactBalls: asOf keeps games before the day; a ball with no known date goes when asOf is set', () => {
  const dates = new Map([[1, '2026-09-22'], [2, '2026-09-23']])
  const balls = [ball({ gamePk: 1 }), ball({ gamePk: 2 }), ball({ gamePk: 3 })]
  assert.deepEqual(contactBalls(balls, dates, '2026-09-23').map((b) => b.gamePk), [1])
  assert.deepEqual(contactBalls(balls, dates).map((b) => b.gamePk), [1, 2, 3])
  assert.equal(contactBalls(balls, dates)[0].date, '2026-09-22')
})

test('contactBalls: a minor-league ball is left out', () => {
  assert.equal(contactBalls([ball({ level: 'aaa' }), ball()], new Map()).length, 1)
})

test('contactView: null under the card floor, counts above it', () => {
  assert.equal(contactView(MANY(39)), null)
  const v = contactView([...MANY(38), ball({ result: 'hr' }), ball({ result: 'single' })])
  assert.deepEqual(v.counts, { hr: 1, hit: 2, all: 40 })
})

test('firstView: home runs, else hits, else all balls', () => {
  assert.equal(firstView({ hr: 2, hit: 9, all: 40 }), 'hr')
  assert.equal(firstView({ hr: 0, hit: 9, all: 40 }), 'hit')
  assert.equal(firstView({ hr: 0, hit: 0, all: 40 }), 'all')
})

test('pickBalls: view and batted-ball type narrow the field', () => {
  const b = [ball({ result: 'hr', launchAngle: 30 }), ball({ result: 'single' }), ball({ result: 'out', launchAngle: 3 })]
  assert.equal(pickBalls(b, 'hr').length, 1)
  assert.equal(pickBalls(b, 'hit').length, 2)
  assert.deepEqual(pickBalls(b, 'all', 'ground').map((x) => x.launchAngle), [3])
})

test('markKey: result or type', () => {
  const b = ball({ result: 'double', launchAngle: 60 })
  assert.equal(markKey(b, 'result'), 'double')
  assert.equal(markKey(b, 'type'), 'pop')
  assert.equal(markKey(ball({ launchAngle: null }), 'type'), 'none')
})

test('mixRows: fixed order, shares of balls with an angle, hit rate and averages', () => {
  const b = [
    ball({ launchAngle: 0, result: 'single', exitVelo: 100, xba: 0.5 }),
    ball({ launchAngle: 2, result: 'out', exitVelo: 80, xba: 0.1 }),
    ball({ launchAngle: 30, result: 'hr', exitVelo: 108, barrel: true, distance: 400, xba: 0.9 }),
    ball({ launchAngle: null }),
  ]
  const rows = mixRows(b)
  assert.deepEqual(rows.map((r) => r.key), ['ground', 'line', 'fly', 'pop'])
  const g = rows[0]
  assert.equal(g.n, 2)
  assert.equal(g.share, 2 / 3)
  assert.equal(g.avg, 0.5)
  assert.equal(g.ev, 90)
  assert.equal(g.hard, 0.5)
  assert.equal(g.xba, 0.3)
  assert.equal(rows[2].barrel, 1)
  assert.equal(rows[1].n, 0)
  assert.equal(rows[1].avg, null)
  assert.equal(mixRows([ball({ launchAngle: null })]), null)
})

test('ballDetail: the tapped ball, xBA from the store, dashes for a missing field', () => {
  const d = ballDetail(ball({ result: 'hr', exitVelo: 108.4, launchAngle: 22, distance: 406, xba: 0.907, barrel: true, date: '2026-09-23' }))
  assert.equal(d.eyebrow, 'Home run')
  assert.equal(d.when, 'Sep 23')
  assert.equal(d.big, '406')
  assert.deepEqual(d.stats, [['Exit velo', '108.4 mph'], ['Launch angle', '22°'], ['xBA', '.907'], ['Barrel', 'Yes']])
  const e = ballDetail(ball({ exitVelo: null, launchAngle: null, distance: null, xba: null, barrel: null }))
  assert.equal(e.big, '—')
  assert.equal(e.unit, '')
  assert.equal(d.unit, 'ft')
  // Barrel shows only for a barrel (2026-10-30); a missing or false one adds no row.
  assert.deepEqual(e.stats.map((s) => s[1]), ['—', '—', '—'])
  assert.equal(ballDetail(ball({ barrel: false })).stats.some(([k]) => k === 'Barrel'), false)
  assert.equal(e.when, '')
})

test('menuRows: one card per type with a ball, count and the hits / outs share', () => {
  const mix = mixRows([
    ...MANY(3, { launchAngle: 5, result: 'single' }),
    ball({ launchAngle: 5 }),
    ...MANY(2, { launchAngle: 30, result: 'out' }),
  ])
  assert.deepEqual(menuRows(mix), [
    { key: 'ground', title: 'Ground ball', meta: '4 balls', hits: '75%', outs: '25%' },
    { key: 'fly', title: 'Fly ball', meta: '2 balls', hits: '0%', outs: '100%' },
  ])
})

test('menuRows: one ball says "ball"; no mix gives no cards', () => {
  assert.equal(menuRows(mixRows([ball({ launchAngle: 60 })]))[0].meta, '1 ball')
  assert.deepEqual(menuRows(null), [])
})
