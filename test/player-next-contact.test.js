import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ballDetail, contactBalls, contactView, markKey, mixRows, pickBalls, typeOf,
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
  assert.deepEqual(e.stats.map((s) => s[1]), ['—', '—', '—', '—'])
  assert.equal(e.when, '')
})
