import assert from 'node:assert/strict'
import test from 'node:test'
import { keysVerdict } from '../../src/lib/postseason/keysVerdict.js'

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
