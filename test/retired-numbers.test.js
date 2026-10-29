import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALL_MLB_TEAM_IDS } from '../src/lib/teams.js'

// #2598: the hand-curated retired numbers. Every entry names its source and the day it was checked,
// so a reader can trace any number back to a page, and the guard fails a guess.
const FILE = JSON.parse(readFileSync(new URL('../public/data/retired-numbers.json', import.meta.url), 'utf8'))
const ROLES = new Set(['player', 'manager', 'executive', 'other'])
const DAY = /^\d{4}-\d{2}-\d{2}$/
const isDay = (s) => typeof s === 'string' && DAY.test(s) && !Number.isNaN(Date.parse(s))
const isSource = (s) => typeof s === 'string' && /^https:\/\/\S+$/.test(s)

// The problems with one entry, as words; [] when it is sound.
function entryProblems(e) {
  const out = []
  if (!Number.isInteger(e?.number) || e.number < 0) out.push('number')
  if (typeof e?.name !== 'string' || !e.name.trim()) out.push('name')
  if (!ROLES.has(e?.role)) out.push('role')
  if (e?.year != null && !(Number.isInteger(e.year) && e.year >= 1900 && e.year <= 2100)) out.push('year')
  if (!isSource(e?.source)) out.push('source')
  if (!isDay(e?.checked)) out.push('checked')
  return out
}

test('the guard catches a bad entry: no source, a malformed date, no number, no name', () => {
  const good = { number: 19, name: 'Robin Yount', role: 'player', year: 1994, source: 'https://www.mlb.com/brewers/history/retired-numbers', checked: '2026-10-29' }
  assert.deepEqual(entryProblems(good), [])
  assert.deepEqual(entryProblems({ ...good, source: undefined }), ['source'])
  assert.deepEqual(entryProblems({ ...good, source: 'http://example.com' }), ['source'])
  assert.deepEqual(entryProblems({ ...good, checked: '10/29/2026' }), ['checked'])
  assert.deepEqual(entryProblems({ ...good, checked: undefined }), ['checked'])
  assert.deepEqual(entryProblems({ ...good, number: undefined }), ['number'])
  assert.deepEqual(entryProblems({ ...good, name: '' }), ['name'])
})

test('every entry in the file has a number, a name, a role, an https source and a checked date', () => {
  const all = [...FILE.league, ...Object.values(FILE.clubs).flatMap((c) => c.numbers)]
  assert.ok(all.length > 100)
  for (const e of all) assert.deepEqual(entryProblems(e), [], `${e.number} ${e.name}`)
})

test('all 30 clubs are listed, each with its own source and checked date', () => {
  assert.deepEqual(Object.keys(FILE.clubs).map(Number).sort((a, b) => a - b), [...ALL_MLB_TEAM_IDS].sort((a, b) => a - b))
  for (const [id, c] of Object.entries(FILE.clubs)) {
    assert.ok(isSource(c.source), `${id} source`)
    assert.ok(isDay(c.checked), `${id} checked`)
    assert.ok(Array.isArray(c.numbers), `${id} numbers`)
  }
})

test('Jackie Robinson\'s 42 is one league note, not 30 club entries', () => {
  assert.deepEqual(FILE.league.map((e) => [e.number, e.name]), [[42, 'Jackie Robinson']])
  for (const c of Object.values(FILE.clubs)) assert.ok(!c.numbers.some((e) => e.name === 'Jackie Robinson'))
})

test('the Brewers: Molitor 4, Yount 19, Fingers 34 and Aaron 44, each with a source', async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => FILE, url })
  const { retiredNumbersFor } = await import('../src/api/history/retiredNumbers.js')
  const mil = await retiredNumbersFor(158)
  for (const [n, name] of [[4, 'Paul Molitor'], [19, 'Robin Yount'], [34, 'Rollie Fingers'], [44, 'Hank Aaron']]) {
    const e = mil.numbers.find((x) => x.number === n)
    assert.equal(e?.name, name)
    assert.ok(isSource(e.source))
  }
  assert.equal(mil.league[0].number, 42)
  assert.deepEqual((await retiredNumbersFor(999)).numbers, [])
})
