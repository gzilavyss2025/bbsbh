import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALL_MLB_TEAM_IDS } from '../src/lib/teams.js'

// #2959: the hand-curated temporary home parks. Every entry names its source and the day it was
// checked, so a park on the card traces back to a page and the guard fails a guess.
const FILE = JSON.parse(readFileSync(new URL('../public/data/temporary-parks.json', import.meta.url), 'utf8'))
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

function entryProblems(e) {
  const out = []
  if (!Number.isInteger(e?.venueId)) out.push('venueId')
  if (typeof e?.name !== 'string' || !e.name.trim()) out.push('name')
  if (!Array.isArray(e?.seasons) || !e.seasons.length || !e.seasons.every((y) => Number.isInteger(y) && y >= 1901 && y <= 2100)) out.push('seasons')
  if (!(typeof e?.source === 'string' && /^https:\/\/\S+$/.test(e.source))) out.push('source')
  if (!isDay(e?.checked)) out.push('checked')
  return out
}

test('the guard catches an entry with no source or a bad date', () => {
  const good = { venueId: 2756, name: 'Sahlen Field', seasons: [2020], source: 'https://en.wikipedia.org/wiki/Sahlen_Field', checked: '2026-11-12' }
  assert.deepEqual(entryProblems(good), [])
  assert.deepEqual(entryProblems({ ...good, source: undefined }), ['source'])
  assert.deepEqual(entryProblems({ ...good, checked: '11/12/2026' }), ['checked'])
  assert.deepEqual(entryProblems({ ...good, seasons: [] }), ['seasons'])
})

test('every entry has a venue, name, seasons, an https source and a checked date, under a real club', () => {
  for (const [club, list] of Object.entries(FILE.clubs)) {
    assert.ok(ALL_MLB_TEAM_IDS.includes(Number(club)), club)
    for (const e of list) assert.deepEqual(entryProblems(e), [], `${club} ${e.name}`)
  }
})
