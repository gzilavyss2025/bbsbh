import assert from 'node:assert/strict'
import test from 'node:test'
import { hitterFormView } from '../src/api/hitterForm.js'

// Coverage for the PLAYER page's Recent form card (src/api/hitterForm.js) —
// the pure view over already-fetched lastXGames/season stat bundles.
// fetchHitterForm itself is a thin network wrapper (four parallel getJson
// calls), not covered here — same split as workload.test.js /
// PitcherWorkloadCard. Not to be confused with test/recent-form.test.js,
// which covers the unrelated TEAM page's Last 10 Games module.

const stat = ({ gamesPlayed, avg, obp, slg, ops, homeRuns, rbi }) => ({
  gamesPlayed, avg, obp, slg, ops, homeRuns, rbi,
})

test('last7/15/30 lines render as "avg · ops OPS", verbatim from the API strings', () => {
  const view = hitterFormView({
    last7: stat({ gamesPlayed: 7, avg: '.320', obp: '.400', slg: '.560', ops: '.960', homeRuns: 2, rbi: 5 }),
    last15: stat({ gamesPlayed: 15, avg: '.179', obp: '.250', slg: '.347', ops: '.597', homeRuns: 1, rbi: 4 }),
    last30: stat({ gamesPlayed: 30, avg: '.255', obp: '.310', slg: '.410', ops: '.720', homeRuns: 4, rbi: 12 }),
    season: stat({ gamesPlayed: 100, avg: '.260', obp: '.330', slg: '.430', ops: '.760' }),
  })
  assert.deepEqual(view.facts.find((f) => f.label === 'Last 7 games'), {
    label: 'Last 7 games', value: '.320 · .960 OPS',
  })
  assert.deepEqual(view.facts.find((f) => f.label === 'Last 15 games'), {
    label: 'Last 15 games', value: '.179 · .597 OPS',
  })
  assert.deepEqual(view.facts.find((f) => f.label === 'Last 30 games'), {
    label: 'Last 30 games', value: '.255 · .720 OPS',
  })
})

test('HR / RBI, last 15 pulls from the last15 split', () => {
  const view = hitterFormView({
    last15: stat({ gamesPlayed: 15, avg: '.179', obp: '.250', slg: '.347', ops: '.597', homeRuns: 1, rbi: 4 }),
    last30: stat({ gamesPlayed: 30, avg: '.255', obp: '.310', slg: '.410', ops: '.720', homeRuns: 4, rbi: 12 }),
  })
  assert.deepEqual(view.facts.find((f) => f.label === 'HR / RBI, last 15'), {
    label: 'HR / RBI, last 15', value: '1 HR · 4 RBI',
  })
})

test('Vs. season is a signed OPS-points delta, negative uses U+2212 not a hyphen', () => {
  const view = hitterFormView({
    last15: stat({ gamesPlayed: 15, avg: '.179', obp: '.250', slg: '.347', ops: '.597' }),
    last30: stat({ gamesPlayed: 30, avg: '.255', obp: '.310', slg: '.410', ops: '.720' }),
    season: stat({ gamesPlayed: 100, avg: '.260', obp: '.330', slg: '.430', ops: '.651' }),
  })
  const fact = view.facts.find((f) => f.label === 'Vs. season')
  assert.equal(fact.value, '−.054 OPS')
  assert.equal(fact.value[0], '−') // exact minus-sign codepoint, not '-'
})

test('Vs. season is positive-signed with a plus when last15 outperforms the season line', () => {
  const view = hitterFormView({
    last15: stat({ gamesPlayed: 15, ops: '.762' }),
    last30: stat({ gamesPlayed: 30, ops: '.720' }),
    season: stat({ gamesPlayed: 100, ops: '.660' }),
  })
  assert.equal(view.facts.find((f) => f.label === 'Vs. season').value, '+.102 OPS')
})

test('a missing last7 split skips its fact rather than nulling the card', () => {
  const view = hitterFormView({
    last15: stat({ gamesPlayed: 15, avg: '.179', ops: '.597' }),
    last30: stat({ gamesPlayed: 30, avg: '.255', ops: '.720' }),
  })
  assert.equal(view.facts.some((f) => f.label === 'Last 7 games'), false)
})

test('a missing last15 split skips Last 15, HR/RBI, and Vs. season facts', () => {
  const view = hitterFormView({
    last30: stat({ gamesPlayed: 30, avg: '.255', ops: '.720' }),
    season: stat({ gamesPlayed: 100, ops: '.700' }),
  })
  assert.equal(view.facts.some((f) => f.label === 'Last 15 games'), false)
  assert.equal(view.facts.some((f) => f.label === 'HR / RBI, last 15'), false)
  assert.equal(view.facts.some((f) => f.label === 'Vs. season'), false)
  assert.equal(view.facts.some((f) => f.label === 'Last 30 games'), true)
})

test('a missing season split skips only Vs. season', () => {
  const view = hitterFormView({
    last15: stat({ gamesPlayed: 15, avg: '.179', ops: '.597' }),
    last30: stat({ gamesPlayed: 30, avg: '.255', ops: '.720' }),
  })
  assert.equal(view.facts.some((f) => f.label === 'Vs. season'), false)
})

test('null when last30 is missing entirely', () => {
  assert.equal(hitterFormView({}), null)
  assert.equal(hitterFormView({ last7: stat({ gamesPlayed: 7, ops: '.900' }) }), null)
  assert.equal(hitterFormView(undefined), null)
})

test('null when last30 has zero games played (call-up with no games yet this window)', () => {
  const view = hitterFormView({ last30: stat({ gamesPlayed: 0, avg: '.000', ops: '.000' }) })
  assert.equal(view, null)
})
