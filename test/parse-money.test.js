import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseMoneyCell } from '../src/lib/contracts/parseMoney.js'
import { parseCsv } from '../scripts/lib/csv.mjs'

// THE INVARIANT: a dollar is committed only when the source states a dollar
// (ADR-0052). A cell of prose is a STATUS, never an amount -- never 0, never
// silently dropped. `raw` always keeps the untouched source text.

// ------------------------------------------------------------------ numbers
test('a plain dollar figure parses to a number with no status', () => {
  assert.deepEqual(parseMoneyCell('61875000'), {
    amount: 61875000,
    status: null,
    raw: '61875000',
    years: null,
    guarantee: null,
  })
})

test('$ and thousands commas strip before the numeric check', () => {
  assert.equal(parseMoneyCell('$61,875,000').amount, 61875000)
})

// -------------------------------------------------------------------- blank
test('an empty or whitespace-only cell is blank, never 0', () => {
  assert.deepEqual(parseMoneyCell(''), { amount: null, status: 'blank', raw: '', years: null, guarantee: null })
  assert.equal(parseMoneyCell('   ').status, 'blank')
  assert.equal(parseMoneyCell(undefined).status, 'blank')
})

test('an explicit "n/a" is blank too, and keeps its own raw text', () => {
  const r = parseMoneyCell('n/a')
  assert.equal(r.status, 'blank')
  assert.equal(r.amount, null)
  assert.equal(r.raw, 'n/a')
})

// --------------------------------------------------- fixed-phrase statuses
// One test per distinct non-numeric value this repo's real export carries
// today (2026-08-27), across arbitration.csv (prior_salary, player_request,
// settled_salary, club_offer), salaries.csv (salary), and free_agency.csv
// (guarantee, aav). extensions.csv carries none -- its guarantee/aav are
// clean numbers.
const FIXED_PHRASES = [
  ['forfeited', 'forfeited'], // salaries.salary's one prose value
  ['outrighted', 'outrighted'],
  ['outrighted-FA', 'outrighted'], // outrighted, then elected free agency -- same underlying transaction
  ['DFA', 'dfa'],
  ['non-tendered', 'non-tendered'],
  ['released', 'released'],
  ['retired', 'retired'],
  ['lost on waivers', 'waived'],
  ['club option', 'club-option'],
  ['exercised option', 'option-exercised'],
  ['elected FA', 'elected-free-agency'],
  ['2024-25', 'term-only'], // a season range with no dollar figure stated
]

for (const [raw, status] of FIXED_PHRASES) {
  test(`"${raw}" carries no amount and reads as '${status}'`, () => {
    const r = parseMoneyCell(raw)
    assert.equal(r.amount, null)
    assert.equal(r.status, status)
    assert.equal(r.raw, raw)
  })
}

test('a fixed-phrase status is matched case-insensitively', () => {
  assert.equal(parseMoneyCell('FORFEITED').status, 'forfeited')
  assert.equal(parseMoneyCell('Club Option').status, 'club-option')
})

// ---------------------------------------------------- arbitration.prior_salary
// Three distinct prose values, each its own kind of "not a settled figure":
// a bare arbitration-class code, a lone dash meaning nothing was recorded,
// and a figure the source itself flagged as unconfirmed.
test('"A3" is an arbitration-class year code, the same vocabulary Cot\'s out-year A1..A4 codes use (ADR-0052)', () => {
  const r = parseMoneyCell('A3')
  assert.equal(r.amount, null)
  assert.equal(r.status, 'arbitration-year')
  assert.equal(r.raw, 'A3')
})

test('a bare "-" is blank, same as an empty cell', () => {
  const r = parseMoneyCell('-')
  assert.equal(r.amount, null)
  assert.equal(r.status, 'blank')
  assert.equal(r.raw, '-')
})

test('"?  $700,000" keeps the stated figure but flags it unconfirmed, never silently drops it', () => {
  const r = parseMoneyCell('?  $700,000')
  assert.equal(r.amount, 700000, 'the source did write a number down -- coercing it to null would be the silent drop the rule forbids')
  assert.equal(r.status, 'unconfirmed')
  assert.equal(r.raw, '?  $700,000')
})

// ------------------------------------------------------- overseas signings
// free_agency.guarantee's three real signings outside MLB. Exact strings, not
// a shape -- a foreign club's name is not something to guess a pattern for.
const OVERSEAS = ['Lotte Giants, 1 y/$1M', 'Rakuten Golden Eagles, 1 y (26)', 'signed by Leones de Yucatán']

for (const raw of OVERSEAS) {
  test(`"${raw}" is a signed-overseas status, not a guarantee`, () => {
    const r = parseMoneyCell(raw)
    assert.equal(r.amount, null)
    assert.equal(r.status, 'signed-overseas')
  })
}

// --------------------------------------------------------------- extensions
// Every distinct extension-shaped string found in arbitration.settled_salary
// and arbitration.club_offer, each mapped to the years/total guarantee the
// cell states (amounts in these cells are always millions, "M" suffix or
// not -- $168 in "8 y / $168M" and $168 in a hypothetical "8 y / $168 extn"
// mean the same figure).
const EXTENSIONS = [
  ['1 y+opt extn', 1, null],
  ['1 y/$2.125+opt', 1, 2_125_000],
  ['1 y/$2.325+opt', 1, 2_325_000],
  ['1 y/$5.7+opt', 1, 5_700_000],
  ['1 y/$7.5+opt', 1, 7_500_000],
  ['1 y/$7.75 extn', 1, 7_750_000],
  ['1 y/$8.8 extn', 1, 8_800_000],
  ['2 / $10 extn', 2, 10_000_000],
  ['2 / $13.4 extn', 2, 13_400_000],
  ['2 / $2.5 extn', 2, 2_500_000],
  ['2 y / $13.5', 2, 13_500_000], // no "extn" keyword -- years+$ shape alone is enough
  ['2 y/$10.4 extn', 2, 10_400_000],
  ['2 y/$11.1 extn', 2, 11_100_000],
  ['2 y/$14.5 extn', 2, 14_500_000],
  ['2 y/$16.5M ext', 2, 16_500_000],
  ['2 y/$27.5 extn', 2, 27_500_000],
  ['2 y/$3.65 extn', 2, 3_650_000],
  ['2 y/$4.3M extn', 2, 4_300_000],
  ['2 y/$5.925 extn', 2, 5_925_000],
  ['2 y/$6.65 extn', 2, 6_650_000],
  ['2 y/$7.25 extn', 2, 7_250_000],
  ['2 y/$8.5 extn', 2, 8_500_000],
  ['2 y/$8.8M extn', 2, 8_800_000],
  ['2 y/$8M extn', 2, 8_000_000],
  ['3 y/$22 extn', 3, 22_000_000],
  ['3 y/$24M extn', 3, 24_000_000],
  ['3 y/$26 extn', 3, 26_000_000],
  ['3 y/$30 extn', 3, 30_000_000],
  ['3 y/$33.6M ext', 3, 33_600_000],
  ['3 y/$8.875 extn', 3, 8_875_000],
  ['4 / $32.5 extn', 4, 32_500_000],
  ['4 y/$31M extn', 4, 31_000_000],
  ['5 y/$64.5 ext', 5, 64_500_000],
  ['5 y/$64M extn', 5, 64_000_000],
  // arbitration.club_offer
  ['2 y/$3.1M extn', 2, 3_100_000],
  ['3 y/$13M extn', 3, 13_000_000],
  ['5 y/$57M extn', 5, 57_000_000],
  ['6 y/$73M extn', 6, 73_000_000],
  ['extn, 2 y/$8.5', 2, 8_500_000], // "extn, " prefix instead of a trailing suffix
  ['extn, 5 y/$60M', 5, 60_000_000],
  ['extension', null, null], // bare -- the years/amount live in a different column this function never sees
]

for (const [raw, years, guarantee] of EXTENSIONS) {
  test(`"${raw}" settles as an extension (years=${years}, guarantee=${guarantee})`, () => {
    const r = parseMoneyCell(raw)
    assert.equal(r.status, 'settled-as-extension')
    assert.equal(r.amount, null, 'an extension cell is a status, not a settled amount')
    assert.equal(r.years, years)
    assert.equal(r.guarantee, guarantee)
    assert.equal(r.raw, raw)
  })
}

// ------------------------------------------------- arbitration.player_request
// Every distinct value in player_request is multi-year-shaped, but a
// player's REQUEST is not a settlement -- passing column: 'player_request'
// reads the same shape as 'multi-year-request' instead of
// 'settled-as-extension'. This is the column the ~210-case file-and-trial
// subsample is built from, so getting the status (not just the null amount)
// right here matters downstream.
const PLAYER_REQUESTS = [
  ['2 y/$7.2M', 2, 7_200_000],
  ['2 y / $3M', 2, 3_000_000],
  ['8 y / $168M', 8, 168_000_000],
  ['3 y/$14.5M', 3, 14_500_000],
  ['6 y / $70M', 6, 70_000_000],
  ['5 y / $56M', 5, 56_000_000],
  ['2 y / $6M', 2, 6_000_000],
  ['7 y / $100M', 7, 100_000_000],
  ['2 y / $6.25M', 2, 6_250_000],
  ['7 y / $131M', 7, 131_000_000],
  ['2 y / $25M', 2, 25_000_000],
  ['2 yr / $11M', 2, 11_000_000],
]

for (const [raw, years, guarantee] of PLAYER_REQUESTS) {
  test(`player_request "${raw}" is a filed request, not a settlement (years=${years}, guarantee=${guarantee})`, () => {
    const r = parseMoneyCell(raw, 'player_request')
    assert.equal(r.status, 'multi-year-request')
    assert.equal(r.amount, null)
    assert.equal(r.years, years)
    assert.equal(r.guarantee, guarantee)
    assert.equal(r.raw, raw)
  })
}

test('the same multi-year shape in settled_salary or club_offer still reads as settled-as-extension', () => {
  assert.equal(parseMoneyCell('2 y/$7.2M', 'settled_salary').status, 'settled-as-extension')
  assert.equal(parseMoneyCell('2 y/$7.2M', 'club_offer').status, 'settled-as-extension')
  assert.equal(parseMoneyCell('2 y/$7.2M').status, 'settled-as-extension', 'no column argument keeps the original default')
})

// ---------------------------------------------------------- unparsed, loud
test('genuinely unrecognized prose is unparsed, not a guess', () => {
  const r = parseMoneyCell('some brand-new prose form nobody mapped yet')
  assert.equal(r.amount, null)
  assert.equal(r.status, 'unparsed')
  assert.equal(r.raw, 'some brand-new prose form nobody mapped yet')
})

// --------------------------------------------------- live-data assertion
// The whole point of 'unparsed': it must be ZERO against today's real export,
// and this test is what makes tomorrow's export prove that again. A future
// CSV refresh that adds a new prose form fails HERE with the exact strings
// that need a new case above, instead of silently reading as $0 somewhere
// downstream.
const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'scripts', 'data', 'contracts')

// Every money-bearing column in all four files -- nine total. Missing one
// here is exactly how the last version of this test under-covered
// arbitration.prior_salary and arbitration.player_request: it read as
// "zero unparsed" while two whole columns went unchecked.
const TARGET_COLUMNS = [
  ['arbitration.csv', ['prior_salary', 'player_request', 'club_offer', 'settled_salary']],
  ['salaries.csv', ['salary']],
  ['free_agency.csv', ['guarantee', 'aav']],
  ['extensions.csv', ['guarantee', 'aav']],
]

test('every money cell in the real CSVs parses to a known status -- zero unparsed', () => {
  const unparsed = []
  let cellCount = 0
  for (const [file, columns] of TARGET_COLUMNS) {
    const rows = parseCsv(readFileSync(join(dataDir, file), 'utf8'))
    for (const row of rows) {
      for (const column of columns) {
        cellCount++
        const r = parseMoneyCell(row[column], column)
        if (r.status === 'unparsed') unparsed.push(`${file}:${column}="${row[column]}"`)
      }
    }
  }
  assert.ok(cellCount > 40000, `expected tens of thousands of money cells, saw ${cellCount}`)
  // No named-exception list needed today: every value found across all nine
  // columns maps to a real status (see the enumeration above). If a future
  // export adds prose this function has never seen, this assertion is the
  // one that catches it -- fix it by adding a mapped case, never by adding
  // an exception here.
  assert.deepEqual(unparsed, [], `new prose form(s) need a mapped status: ${unparsed.join(', ')}`)
})
