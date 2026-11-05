// The offseason gate's phase decision with REMEMBERED season rows (issue #2907):
// the phase has to be right on the first frame, from storage alone, and the
// network has to be able to correct it. Rows are shaped like statsapi's
// /seasons and /league rows; the dates are modelled on 2026/2027, not read live.
import assert from 'node:assert/strict'
import test from 'node:test'
import { answered, phaseOf, winterOf } from '../src/hooks/useOffseason.js'
import { readSeasonRow, saveSeasonRow, taggedRows } from '../src/lib/time/seasonRows.js'

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

// The hook's two memoised steps, run end to end.
function resolveOffseason(dateStr, sportId, net, load) {
  const base = phaseOf(dateStr, sportId, net, load)
  return { phase: base.phase, winter: winterOf(dateStr, sportId, base, net.next, load), expectWinter: base.expectWinter }
}

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
  assert.deepEqual(resolveOffseason('2026-11-04', 1, NONE, store({})), { phase: null, winter: null, expectWinter: true })
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
  assert.equal(resolveOffseason('2027-01-02', 1, NONE, only2026).phase, null)
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
  assert.equal(resolveOffseason('2026-11-04', 12, NONE, load).phase, null)
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

test('a saved in-season row says season, not winter: no reserve, the old empty-day page', () => {
  const r = resolveOffseason('2026-07-07', 1, NONE, store({ '1:2026': MLB_2026 }))
  assert.equal(r.phase, null)
  assert.equal(r.expectWinter, false)
  // nothing saved at all is unknown: the calendar decides (see the next test)
  assert.equal(resolveOffseason('2026-11-07', 1, NONE, store({})).expectWinter, true)
  // a saved winter expects one
  assert.equal(resolveOffseason('2026-11-04', 1, NONE, store({ '1:2026': MLB_2026 })).expectWinter, true)
})

test('the network wins once it has answered, even degraded; saved rows only while it is pending', () => {
  const load = store({ '1:2026': MLB_2026, '1:2027': MLB_2027 })
  // pending (undefined): the saved row decides
  assert.equal(resolveOffseason('2026-11-04', 1, { season: undefined }, load).phase.seasonEnded, 2026)
  // answered with nothing, or with a row that is not this year's: phase null, as without saved rows
  assert.equal(resolveOffseason('2026-11-04', 1, { season: null }, load).phase, null)
  assert.equal(resolveOffseason('2026-11-04', 1, { season: MLB_2027 }, load).phase, null)
  // a level: league rows answered but missing dates (a league without them) is not rescued by a saved row
  const loadLevel = store({ '13:2026': LEVEL_2026, '13:2027': LEVEL_2027 })
  const bad = [{ leagueId: 117, name: 'no dates' }]
  assert.equal(resolveOffseason('2026-11-04', 13, { level: bad }, loadLevel).phase, null)
  assert.equal(resolveOffseason('2026-11-04', 13, { level: undefined }, loadLevel).phase.seasonEnded, 2026)
  // the next row too: a settled miss means no countdown date
  assert.equal(resolveOffseason('2026-11-04', 1, { next: null }, load).winter, null)
})

test('nothing saved: expect a winter only when the calendar allows one', () => {
  const none = store({})
  const expect = (d, id = 1) => resolveOffseason(d, id, NONE, none).expectWinter
  assert.equal(expect('2026-07-14'), false) // the All-Star break
  assert.equal(expect('2026-10-20'), false) // a postseason off day (#2928)
  assert.equal(expect('2026-10-31'), false) // the World Series window
  assert.equal(expect('2026-11-01'), true)
  assert.equal(expect('2026-11-04'), true)
  assert.equal(expect('2027-02-28'), true)
  assert.equal(expect('2027-03-01'), false)
  assert.equal(expect('2026-07-14', 13), false) // a Triple-A Monday off
  assert.equal(expect('2026-09-20', 13), false)
  assert.equal(expect('2026-10-05', 13), true) // the levels are out well before MLB (#2928)
  assert.equal(expect('2026-11-04', 13), true)
  assert.equal(expect('2027-03-20', 13), true) // and stay out until their April opener
  assert.equal(expect('2027-04-05', 13), false)
})

test('a settled-null MLB row means no level winter, whatever is saved (#2928)', () => {
  const load = store({ '13:2026': LEVEL_2026, '13:2027': LEVEL_2027 })
  assert.equal(resolveOffseason('2026-11-04', 13, { season: null }, load).phase, null)
  // not answered yet: the saved rows still decide
  assert.equal(resolveOffseason('2026-11-04', 13, { season: undefined }, load).phase.seasonEnded, 2026)
})

test('a next-season answer for another year supplies no countdown dates (#2928)', () => {
  const load = store({ '1:2026': MLB_2026 })
  assert.equal(resolveOffseason('2026-11-04', 1, { next: MLB_2026 }, load).winter, null)
  assert.equal(resolveOffseason('2026-11-04', 1, { next: MLB_2027 }, load).winter.endDate, '2027-02-18')
  const loadL = store({ '13:2026': LEVEL_2026 })
  assert.equal(resolveOffseason('2026-11-04', 13, { next: LEVEL_2026 }, loadL).winter, null)
})

test('a rejected fetch settles pending; a stale one does not (#2928)', () => {
  const ok = { sportId: 13, year: 2026, rows: [] }
  assert.equal(answered({ data: ok }, 13, 2026), true)
  assert.equal(answered({ data: ok }, 13, 2027), false)
  assert.equal(answered({ data: null, error: new Error('x') }, 13, 2026), true)
  assert.equal(answered({ data: null, error: null }, 13, 2026), false)
})

test('a tab that can never have an offseason page never expects one', () => {
  assert.equal(resolveOffseason('2026-11-04', 999, NONE, store({})).expectWinter, false)
  assert.equal(resolveOffseason('2026-11-04', 51, NONE, store({})).expectWinter, false)
})

test('fetched rows carry the key they were fetched for (AAA to AA never saves AAA under 12)', () => {
  const aaa = { sportId: 13, year: 2026, rows: LEVEL_2026 }
  assert.equal(taggedRows(aaa, 13, 2026), LEVEL_2026)
  // undefined = still pending (another key's data, or none); a settled miss is null
  assert.equal(taggedRows(aaa, 12, 2026), undefined)
  assert.equal(taggedRows(aaa, 13, 2027), undefined)
  assert.equal(taggedRows(null, 13, 2026), undefined)
  assert.equal(taggedRows({ sportId: 13, year: 2026, rows: null }, 13, 2026), null)
})

test('save and read check a row against its key', () => {
  const mem = {}
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v } }
  try {
    saveSeasonRow(1, 2026, MLB_2027) // the 2027 row is not 2026's: not saved
    assert.equal(readSeasonRow(1, 2026), null)
    assert.deepEqual(mem, {})
    saveSeasonRow(13, 2026, LEVEL_2027)
    assert.deepEqual(mem, {})
    // a bad value already in storage reads as no row, so 2026-11-04 decides nothing from it
    mem['bbsbh:seasonrows:1:2026'] = JSON.stringify({ sportId: 1, year: 2026, row: MLB_2027 })
    assert.equal(readSeasonRow(1, 2026), null)
    // another sport's envelope under this key too
    mem['bbsbh:seasonrows:12:2026'] = JSON.stringify({ sportId: 13, year: 2026, row: LEVEL_2026 })
    assert.equal(readSeasonRow(12, 2026), null)
    assert.equal(resolveOffseason('2026-11-04', 1, NONE, readSeasonRow).phase, null)
  } finally {
    delete globalThis.localStorage
  }
})
