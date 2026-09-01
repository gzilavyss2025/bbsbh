import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseServiceTime } from '../src/lib/contracts/parseServiceTime.js'
import { parseCsv } from '../scripts/lib/csv.mjs'

// THE INVARIANT: salaries.csv's `mls` column lost its trailing zeros to a float
// round-trip, so the day part must be reconstructed from the DECIMAL LENGTH,
// never read as written. ".1" is 100 days, not 1. A bare integer is N years and
// 0 days -- and `exact: false`, because a meaningful subset of bare cells
// misstate the real accrued days and no per-cell rule can tell which.

// --------------------------------------------------------- the four lengths
// One case per decimal length the real export carries, each taken from a real
// row so the reconstruction is checked against data and not against itself.

test('a one-digit decimal is a stripped ".100" -- Sandy Alcantara 2026 reads 7.1', () => {
  assert.deepEqual(parseServiceTime('7.1'), {
    years: 7,
    days: 100,
    totalDays: 7 * 172 + 100,
    exact: true,
    status: null,
    raw: '7.1',
  })
})

test('a two-digit decimal is a stripped multiple of ten -- Cody Bellinger 2026 reads 8.16', () => {
  const r = parseServiceTime('8.16')
  assert.equal(r.years, 8)
  assert.equal(r.days, 160, '160 days, not 16 -- the trailing zero was stripped')
  assert.equal(r.exact, true)
})

test('a three-digit decimal kept its own padding and is read as written', () => {
  const r = parseServiceTime('7.134')
  assert.equal(r.years, 7)
  assert.equal(r.days, 134)
  assert.equal(r.totalDays, 7 * 172 + 134)
  assert.equal(r.exact, true)
  assert.equal(r.status, null)
})

test('a fifteen-digit decimal is the float artifact itself, rounded back', () => {
  // 140 real cells carry this shape: the round-trip that stripped the zeros,
  // caught in the act of failing to land on a representable fraction.
  const r = parseServiceTime('8.154000000000002')
  assert.equal(r.years, 8)
  assert.equal(r.days, 154)
  assert.equal(r.exact, true)
  assert.equal(r.status, 'float-artifact')
  assert.equal(parseServiceTime('9.103000000000002').days, 103)
  assert.equal(parseServiceTime('4.171000000000001').days, 171)
})

// ----------------------------------------------------------- the one typo
// Tim Beckham 2015 is the only four-digit decimal in the file. It is a stray
// leading zero over `145`, not a fourth notation, and his own rows are the
// proof -- 2015 to 2016 is then a gain of exactly one full service year.

test('"0.0145" is Tim Beckham 2015: a stray leading zero, read as 145 days', () => {
  const r = parseServiceTime('0.0145')
  assert.equal(r.years, 0)
  assert.equal(r.days, 145)
  assert.equal(r.exact, true)
  assert.equal(r.status, 'stray-leading-zero')
})

test("Beckham's own next row proves the reading: 2015 to 2016 gains exactly 172 days", () => {
  const before = parseServiceTime('0.0145')
  const after = parseServiceTime('1.145')
  assert.equal(after.totalDays - before.totalDays, 172, 'a textbook full service season')
})

// ------------------------------------------------------- the bare integers
// The flag that matters. A bare cell is NOT an ambiguous string -- it denotes
// N.000 exactly, because ".000" is the one day count the round-trip erases.
// `exact: false` warns about something else: 11 of 18 bare cells checked
// against wire-verified roster-add dates read a year or more when the man
// provably had not banked one (docs/service-time-debut-clock.md).

test('a bare integer is N years and 0 days, and it is never exact', () => {
  assert.deepEqual(parseServiceTime('8'), {
    years: 8,
    days: 0,
    totalDays: 8 * 172,
    exact: false,
    status: 'bare-integer',
    raw: '8',
  })
})

test('a bare "0" is zero years, zero days -- not a blank', () => {
  const r = parseServiceTime('0')
  assert.equal(r.years, 0)
  assert.equal(r.days, 0)
  assert.equal(r.totalDays, 0, 'a real zero, which a blank cell must never produce')
  assert.equal(r.exact, false)
  assert.equal(r.status, 'bare-integer')
})

test('exact separates a bare cell from a day-count cell at the same service level', () => {
  // The threshold test this flag exists to stop. Both cells say "one year".
  // Only one of them was written by something that counted days.
  assert.equal(parseServiceTime('1').exact, false)
  assert.equal(parseServiceTime('1.011').exact, true)
  assert.equal(parseServiceTime('1').totalDays, 172)
  assert.equal(parseServiceTime('1.011').totalDays, 183)
})

// -------------------------------------------------------------------- blank
test('a blank cell states nothing, and states nothing about exactness either', () => {
  assert.deepEqual(parseServiceTime(''), {
    years: null,
    days: null,
    totalDays: null,
    exact: null,
    status: 'blank',
    raw: '',
  })
  assert.equal(parseServiceTime('   ').status, 'blank')
  assert.equal(parseServiceTime(undefined).status, 'blank')
  assert.equal(parseServiceTime(undefined).exact, null, 'null, never false -- "not recorded" is not "may be wrong"')
})

// --------------------------------------------------------- unparsed, loud
test('a shape nobody has read is unparsed, not a guess at a day count', () => {
  for (const raw of ['4.12345', 'n/a', '4.078.1', '-1.100', '4,078']) {
    const r = parseServiceTime(raw)
    assert.equal(r.status, 'unparsed', `${raw} should not resolve to a day count`)
    assert.equal(r.years, null)
    assert.equal(r.totalDays, null)
    assert.equal(r.raw, raw)
  }
})

// ------------------------------------------------------ live-data sweep
// The same shape parse-money.test.js uses: run the real file through the parser
// and assert the rule holds over every cell, so a future export that changes
// the notation fails HERE with the offending strings instead of shipping a
// silently wrong day count.

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'scripts', 'data', 'contracts')
const salaries = parseCsv(readFileSync(join(dataDir, 'salaries.csv'), 'utf8'))

test('every mls cell in salaries.csv falls inside the rule -- zero unparsed', () => {
  const unparsed = []
  let populated = 0
  for (const row of salaries) {
    const r = parseServiceTime(row.mls)
    if (r.status === 'blank') continue
    populated++
    if (r.status === 'unparsed') unparsed.push(`${row.year} ${row.player} = "${row.mls}"`)
  }
  assert.equal(populated, 19308)
  // No exception list. Every populated cell in today's export is a dotted cell
  // of length 1, 2, 3, 4 or 15, or a bare integer. A new shape is fixed by
  // reading it and mapping it, never by excusing it here.
  assert.deepEqual(unparsed, [], `unmapped mls shape(s): ${unparsed.join(', ')}`)
})

test('no reconstructed day part exceeds a full service year', () => {
  // 172 days IS a service year, so a day part above it would mean the
  // reconstruction invented a season. The real maximum among three-digit cells
  // is 171; nothing anywhere reaches 172.
  const over = []
  let maxDays = -1
  for (const row of salaries) {
    const r = parseServiceTime(row.mls)
    if (r.days === null) continue
    maxDays = Math.max(maxDays, r.days)
    if (r.days > 172) over.push(`${row.year} ${row.player} = "${row.mls}" -> ${r.days}`)
  }
  assert.deepEqual(over, [], `day part above a full service year: ${over.join(', ')}`)
  assert.equal(maxDays, 171)
})

test('the notation splits 16,382 dotted against 2,926 bare, and nothing else', () => {
  const counts = { dotted: 0, bare: 0, blank: 0 }
  for (const row of salaries) {
    const r = parseServiceTime(row.mls)
    if (r.status === 'blank') counts.blank++
    else if (r.status === 'bare-integer') counts.bare++
    else counts.dotted++
  }
  assert.equal(counts.dotted, 16382)
  assert.equal(counts.bare, 2926)
  assert.equal(counts.blank, 8041)
  assert.equal(counts.dotted + counts.bare + counts.blank, salaries.length)
})
