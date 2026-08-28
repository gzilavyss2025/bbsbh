import test from 'node:test'
import assert from 'node:assert/strict'
import { EXCEPT, MAX_AGE_HOURS, evaluate } from '../scripts/check-data-freshness.mjs'

// The guard behind the 2026-08-28 incident: GitHub silently dropped the nightly
// cron, no run record existed, and every dataset went a day stale with nothing
// anywhere going red. evaluate() is the pure half, driven here with a fixed
// `now` so the suite doesn't depend on the clock.
const NOW = Date.parse('2026-08-28T12:00:00Z')
const at = (iso) => ({ key: 'generatedAt', value: iso })
const run = (datasets) => evaluate(datasets, { now: NOW })

test('a dataset written last night passes', () => {
  const r = run([{ name: 'war.json', stamp: at('2026-08-28T07:10:00Z') }])
  assert.deepEqual(r.stale, [])
  assert.equal(r.checked, 1)
})

test('a dataset the cron stopped writing is caught, with its age', () => {
  const r = run([{ name: 'postseason-odds.json', stamp: at('2026-08-05T07:10:00Z') }])
  assert.equal(r.stale.length, 1)
  assert.equal(r.stale[0].name, 'postseason-odds.json')
  assert.equal(r.stale[0].ageHours, 556)
})

// The boundary has to hold, or the guard drifts into uselessness the first time
// someone rounds it up. It is measured in HOURS on purpose: on a DAY scale the
// smallest failure this can express is "three nights missed", which is no guard
// at all — see MAX_AGE_HOURS's note.
test('the age budget is inclusive at the edge and fails one hour past it', () => {
  const hours = (n) => at(new Date(NOW - n * 3_600_000).toISOString())
  assert.deepEqual(run([{ name: 'a.json', stamp: hours(MAX_AGE_HOURS) }]).stale, [])
  assert.equal(run([{ name: 'a.json', stamp: hours(MAX_AGE_HOURS + 1) }]).stale.length, 1)
})

// The incident this exists for: ONE missed night must be enough.
test('a single missed night is over the budget', () => {
  assert.ok(MAX_AGE_HOURS < 24, 'a budget of 24h or more cannot see one missed night')
  const r = run([{ name: 'war.json', stamp: at('2026-08-27T07:10:00Z') }])
  assert.equal(r.stale.length, 1)
})

test('a hand-run dataset is skipped however old it is, and says why', () => {
  const name = 'postseason-history.json'
  assert.ok(name in EXCEPT, 'fixture must name a real EXCEPT entry')
  const r = run([{ name, stamp: at('2019-01-01T00:00:00Z') }])
  assert.deepEqual(r.stale, [])
  assert.equal(r.checked, 0)
  assert.equal(r.excepted[0].why, EXCEPT[name])
})

// An unstamped dataset is UNCHECKABLE, not stale — reporting it as stale would
// be a false alarm that trains the reader to ignore this guard. It is counted
// instead, and the caller ratchets on the count.
test('an unstamped dataset is counted, never reported stale', () => {
  const r = run([
    { name: 'jerseys.json', stamp: null },
    { name: 'team-records/', stamp: null },
    { name: 'war.json', stamp: at('2026-08-28T07:10:00Z') },
  ])
  assert.deepEqual(r.stale, [])
  assert.deepEqual(r.unstamped, ['jerseys.json', 'team-records/'])
  assert.equal(r.checked, 1)
})

// A stamp that exists but can't be parsed is its own failure: treating it as
// unstamped would let a generator writing garbage sit under the budget forever.
test('an unparseable stamp is a failure of its own, not silently unstamped', () => {
  const r = run([{ name: 'x.json', stamp: { key: 'generatedAt', value: 'last Tuesday' } }])
  assert.deepEqual(r.stale, [])
  assert.deepEqual(r.unstamped, [])
  assert.equal(r.unreadable.length, 1)
  assert.equal(r.unreadable[0].value, 'last Tuesday')
})

test('a date-only stamp is read the same as a full timestamp', () => {
  const r = run([{ name: 'workload.json', stamp: { key: 'asOf', value: '2026-08-28' } }])
  assert.deepEqual(r.stale, [])
  assert.equal(r.checked, 1)
})

// The 2026-08-28 shape end to end: one night missed, everything a day behind.
test('a missed night shows up across every nightly dataset at once', () => {
  const missed = '2026-08-27T07:10:00Z'
  const r = run([
    { name: 'war.json', stamp: at(missed) },
    { name: 'teams.json', stamp: at(missed) },
    { name: 'milestones.json', stamp: at(missed) },
    { name: 'postseason-history.json', stamp: at('2019-01-01T00:00:00Z') },
  ])
  assert.deepEqual(
    r.stale.map((s) => s.name),
    ['war.json', 'teams.json', 'milestones.json'],
  )
  assert.equal(r.excepted.length, 1, 'the hand-run file must not join the alarm')
})
