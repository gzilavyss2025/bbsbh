// The /postseason-records address (src/lib/postseason/recordsRoute.js) and the
// regular-season explorer's parse that moved beside it. Their query is one
// shape, so one parse serves both; these pin that neither page's address
// changed meaning when they began to share it.
import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRoute, situationalRecordsPath } from '../src/lib/route.js'
import { postseasonRecordsPath } from '../src/lib/postseason/recordsRoute.js'

test('a bare postseason-records address parses to every default', () => {
  assert.deepEqual(parseRoute('/postseason-records'), {
    name: 'postseason-records',
    asOf: null,
    season: null,
    view: null,
    team: null,
    min: null,
    category: null,
    metric: null,
    sort: null,
    order: null,
  })
})

test('the scope, view, club and board state all ride the query', () => {
  const route = parseRoute(
    '/postseason-records?d=2026-10-05&season=all&view=teams&team=119&metric=scored-first&sort=played&order=asc',
  )
  assert.equal(route.name, 'postseason-records')
  assert.equal(route.asOf, '2026-10-05')
  assert.equal(route.season, 'all')
  assert.equal(route.view, 'teams')
  assert.equal(route.team, '119')
  assert.equal(route.metric, 'scored-first')
  assert.equal(route.sort, 'played')
  assert.equal(route.order, 'asc')
})

test('an unparseable ?d= degrades to live on the postseason page too', () => {
  assert.equal(parseRoute('/postseason-records?d=2026-02-30').asOf, null)
})

test('postseasonRecordsPath writes only what was asked for', () => {
  assert.equal(postseasonRecordsPath(), '/postseason-records')
  assert.equal(postseasonRecordsPath({ season: 2025 }), '/postseason-records?season=2025')
  assert.equal(
    postseasonRecordsPath({ d: '2026-10-05', season: 'all', metric: 'lead-7', sort: 'played', order: 'desc' }),
    '/postseason-records?d=2026-10-05&season=all&metric=lead-7&sort=played&order=desc',
  )
  // The default sort is never written.
  assert.equal(postseasonRecordsPath({ metric: 'lead-7', sort: 'pct' }), '/postseason-records?metric=lead-7')
})

test('a club rides only the by-team view', () => {
  assert.equal(postseasonRecordsPath({ view: 'teams', team: 119 }), '/postseason-records?view=teams&team=119')
  assert.equal(postseasonRecordsPath({ view: null, team: 119 }), '/postseason-records')
  assert.equal(postseasonRecordsPath({ view: 'bogus' }), '/postseason-records')
})

test('every address the builder writes parses back to the same state', () => {
  const path = postseasonRecordsPath({ season: 2024, view: 'teams', team: 147, category: 'scoring', order: 'asc' })
  const route = parseRoute(path)
  assert.deepEqual(
    [route.season, route.view, route.team, route.category, route.order],
    ['2024', 'teams', '147', 'scoring', 'asc'],
  )
})

test('the regular-season explorer still parses its own query, and its old alias', () => {
  for (const base of ['/situational-records', '/team-records']) {
    const route = parseRoute(`${base}?s=11&metric=lead-8&half=post&month=7&sort=played&order=asc&category=x`)
    assert.deepEqual(
      [route.name, route.sportId, route.metric, route.half, route.month, route.sort, route.order, route.category],
      ['situational-records', 11, 'lead-8', 'post', '7', 'played', 'asc', 'x'],
      base,
    )
  }
  assert.equal(parseRoute(situationalRecordsPath({ metric: 'lead-8' })).metric, 'lead-8')
})

test('the all-years minimum rides the query and is never written at zero', () => {
  assert.equal(parseRoute('/postseason-records?season=all&min=5').min, '5')
  assert.equal(postseasonRecordsPath({ season: 'all', min: 5 }), '/postseason-records?season=all&min=5')
  assert.equal(postseasonRecordsPath({ season: 'all', min: 0 }), '/postseason-records?season=all')
  assert.equal(postseasonRecordsPath({ season: 'all', min: null }), '/postseason-records?season=all')
})
