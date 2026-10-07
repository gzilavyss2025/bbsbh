import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seasonMark } from '../src/lib/identity/seasonMarks.js'

test('seasonMark: no id or a bad season means "draw the current mark"', () => {
  assert.equal(seasonMark(null, 1956), null)
  assert.equal(seasonMark(119, undefined), null)
  assert.equal(seasonMark(119, 'abc'), null)
})

test('seasonMark: a club or season outside the table is not covered', () => {
  assert.equal(seasonMark(999999, 1956), null)
})

test('seasonMark: a 1956 Dodgers game wears the Brooklyn mark, from a date or a year', () => {
  assert.equal(seasonMark(119, 1956).name, 'Brooklyn Dodgers')
  assert.equal(seasonMark(119, '1956-10-08').url, '/logos/historical/119-1945-1957.png')
})

test('seasonMark: a covered era with no art answers a null url, never today\'s mark', () => {
  const era = seasonMark(119, 1905)
  assert.equal(era.name, 'Brooklyn Dodgers')
  assert.equal(era.url, null)
})

test('seasonMark: the era ends where the franchise\'s present mark begins', () => {
  assert.equal(seasonMark(119, 1957).name, 'Brooklyn Dodgers')
  assert.equal(seasonMark(119, 1958), null)
  assert.equal(seasonMark(119, 2026), null)
})
