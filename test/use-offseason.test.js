// The offseason gate's phase decision with REMEMBERED season rows (issue #2907):
// the phase has to be right on the first frame, from storage alone, and the
// network has to be able to correct it. Rows are shaped like statsapi's
// /seasons and /league rows; the dates are modelled on 2026/2027, not read live.
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveOffseason } from '../src/hooks/useOffseason.js'
import { readSeasonRow, saveSeasonRow } from '../src/lib/time/seasonRows.js'

const MLB_2026 = {
  seasonId: '2026',
  springStartDate: '2026-02-20',
  regularSeasonStartDate: '2026-03-26',
  offseasonStartDate: '2026-11-02',
}
const MLB_2027 = {
  seasonId: '2027',
  springStartDate: '2027-02-18',
  regularSeasonStartDate: '2027-04-01',
  offseasonStartDate: '2027-11-02',
}
const LEVEL_2026 = [
  { leagueId: 117, regularSeasonStartDate: '2026-03-27', offseasonStartDate: '2026-09-28' },
  { leagueId: 112, regularSeasonStartDate: '2026-03-27', offseasonStartDate: '2026-09-28' },
]
const LEVEL_2027 = [
  { leagueId: 117, regularSeasonStartDate: '2027-04-02', offseasonStartDate: '2027-09-27' },
  { leagueId: 112, regularSeasonStartDate: '2027-04-02', offseasonStartDate: '2027-09-27' },
]

// A fake store keyed like localStorage: load(sportId, year) -> row | null.
const store = (rows) => (sportId, year) => rows[`${sportId}:${year}`] ?? null
const NONE = {}

test('saved rows decide the winter with no network at all', () => {
  const load = store({ '1:2026': MLB_2026, '1:2027': MLB_2027 })
  const { phase, winter } = resolveOffseason('2026-11-04', 1, NONE, load)
  assert.equal(phase.seasonEnded, 2026)
  assert.equal(winter.endDate, '2027-02-18')
  assert.equal(winter.openingDay, '2027-04-01')
})

test('no saved rows and no network: nothing to say', () => {
  assert.deepEqual(resolveOffseason('2026-11-04', 1, NONE, store({})), { phase: null, winter: null })
})

test('phase known but the next row missing: phase without winter, never a countdown without a date', () => {
  const { phase, winter } = resolveOffseason('2026-11-04', 1, NONE, store({ '1:2026': MLB_2026 }))
  assert.equal(phase.springFromNextSeason, 2027)
  assert.equal(winter, null)
})

test('a stale saved row is corrected by the network', () => {
  const stale = { ...MLB_2027, springStartDate: '2027-02-10' }
  const load = store({ '1:2026': MLB_2026, '1:2027': stale })
  assert.equal(resolveOffseason('2026-11-04', 1, NONE, load).winter.endDate, '2027-02-10')
  const net = { next: MLB_2027 }
  assert.equal(resolveOffseason('2026-11-04', 1, net, load).winter.endDate, '2027-02-18')
  // and a network season row beats a stale saved one the same way
  const moved = { ...MLB_2026, offseasonStartDate: '2026-11-10' }
  assert.equal(resolveOffseason('2026-11-04', 1, { season: moved }, load).phase, null)
})

test('season boundary: a saved 2026 row is never read on 2027-01-02', () => {
  const only2026 = store({ '1:2026': MLB_2026 })
  assert.deepEqual(resolveOffseason('2027-01-02', 1, NONE, only2026), { phase: null, winter: null })
  const both = store({ '1:2026': MLB_2026, '1:2027': MLB_2027 })
  const { phase, winter } = resolveOffseason('2027-01-02', 1, NONE, both)
  assert.equal(phase.seasonEnded, 2026)
  assert.equal(winter.endDate, '2027-02-18')
})

test('a minor-league tab decides from saved level rows', () => {
  const load = store({ '13:2026': LEVEL_2026, '13:2027': LEVEL_2027 })
  const { phase, winter } = resolveOffseason('2026-11-04', 13, NONE, load)
  assert.equal(phase.seasonEnded, 2026)
  assert.equal(winter.openingDay, '2027-04-02')
  // another level's rows are not this level's
  assert.deepEqual(resolveOffseason('2026-11-04', 12, NONE, load), { phase: null, winter: null })
})

test('season rows survive a storage round trip and tolerate no storage', () => {
  assert.equal(readSeasonRow(1, 2026), null) // no localStorage in node: null, no throw
  saveSeasonRow(1, 2026, MLB_2026) // and no throw
  const mem = {}
  globalThis.localStorage = {
    getItem: (k) => mem[k] ?? null,
    setItem: (k, v) => { mem[k] = v },
  }
  try {
    saveSeasonRow(1, 2026, MLB_2026)
    assert.deepEqual(readSeasonRow(1, 2026), MLB_2026)
    assert.equal(readSeasonRow(1, 2027), null)
    mem['bbsbh:seasonrows:1:2028'] = '{not json'
    assert.equal(readSeasonRow(1, 2028), null)
  } finally {
    delete globalThis.localStorage
  }
})
