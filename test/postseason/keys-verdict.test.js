import assert from 'node:assert/strict'
import test from 'node:test'
import { isFailedKey, keysVerdict, nineKeysTeams } from '../../src/lib/postseason/keysVerdict.js'

const rule = { limit: 3, firstSeason: 2000 }
const sd = (failed) => ({ abbr: 'SD', failed })
const mil = (failed) => ({ abbr: 'MIL', failed })

test('equal counts inside the limit', () => {
  assert.equal(
    keysVerdict(sd(2), mil(2), rule),
    'Both clubs fail 2 keys. No champion since 2000 failed more than 3.',
  )
  assert.equal(
    keysVerdict(sd(1), mil(1), rule),
    'Both clubs fail 1 key. No champion since 2000 failed more than 3.',
  )
})

test('neither club fails a key', () => {
  assert.equal(
    keysVerdict(sd(0), mil(0), rule),
    'Neither club fails a key. No champion since 2000 failed more than 3.',
  )
})

test('different counts inside the limit name the club with fewer first', () => {
  assert.equal(
    keysVerdict(sd(3), mil(1), rule),
    'MIL fails 1 key. SD fails 3 keys. No champion since 2000 failed more than 3.',
  )
  assert.equal(
    keysVerdict(sd(0), mil(2), rule),
    'SD fails no keys. MIL fails 2 keys. No champion since 2000 failed more than 3.',
  )
})

test('one club past the limit', () => {
  assert.equal(
    keysVerdict(sd(4), mil(1), rule),
    'SD fails 4 keys. No champion since 2000 failed more than 3.',
  )
  assert.equal(
    keysVerdict(sd(2), mil(5), rule),
    'MIL fails 5 keys. No champion since 2000 failed more than 3.',
  )
})

test('both clubs past the limit', () => {
  assert.equal(
    keysVerdict(sd(4), mil(6), rule),
    'Both clubs fail more than 3 keys. No champion since 2000 did that.',
  )
})

test('the numbers come from the rule, not the sentence', () => {
  assert.match(keysVerdict(sd(1), mil(1), { limit: 2, firstSeason: 1995 }), /since 1995 failed more than 2\./)
})

test('nineKeysTeams: both clubs of the season\'s file, else null', () => {
  const data = { keys: [{ id: 'runs' }], current: { season: 2026, teams: [{ teamId: 1 }, { teamId: 2 }] } }
  assert.deepEqual(nineKeysTeams(data, [{ id: 1 }, { id: 2 }], 2026), [{ teamId: 1 }, { teamId: 2 }])
  assert.equal(nineKeysTeams(data, [{ id: 1 }, { id: 3 }], 2026), null) // a club missing
  assert.equal(nineKeysTeams(data, [{ id: 1 }, { id: 2 }], 2025), null) // another season's file
  assert.equal(nineKeysTeams({ ...data, keys: [] }, [{ id: 1 }, { id: 2 }], 2026), null)
  assert.equal(nineKeysTeams(null, [{ id: 1 }, { id: 2 }], 2026), null)
})

// The row mark and the footer tally must agree: the generator counts a missing rank as failed.
test('isFailedKey: a rank outside the bar, or no rank at all, fails', () => {
  assert.equal(isFailedKey(10, 10), false)
  assert.equal(isFailedKey(1, 10), false)
  assert.equal(isFailedKey(11, 10), true)
  assert.equal(isFailedKey(null, 10), true)
  assert.equal(isFailedKey(undefined, 10), true)
})
