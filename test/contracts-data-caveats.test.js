// Pins the findings in docs/contracts-data-caveats.md against the real CSVs in
// scripts/data/contracts/. Every payroll number this program produces rests on
// those findings, so they must not drift in silence.
//
// WHAT IS ASSERTED HERE, AND WHAT IS NOT. This file pins the CLASSIFICATION and
// the STRUCTURAL claims — the duplicate categories, the shape of the population
// break, the coverage windows, the blank-cell counts. It deliberately does not
// pin a per-season row count or a per-season dollar total. Those move whenever a
// source fix lands, and the doc names the commit it measured them at. Pinning
// them here would turn an intended source fix into a red suite and invite
// somebody to loosen the interesting assertions to get green.
//
// If an assertion below fails, the data changed in a way that changes what the
// data MEANS. Read the doc, decide what the new rows are, then update both.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parseCsv } from '../scripts/lib/csv.mjs'
import { parseServiceTime } from '../src/lib/contracts/parseServiceTime.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'scripts', 'data', 'contracts')
const load = (name) => parseCsv(readFileSync(join(DATA_DIR, name), 'utf8'))

const salaries = load('salaries.csv')
const freeAgency = load('free_agency.csv')
const arbitration = load('arbitration.csv')
const extensions = load('extensions.csv')
const summary = load('salaries_summary.csv')

const isNumber = (cell) => cell !== '' && Number.isFinite(Number(cell))
const salaried = salaries.filter((r) => isNumber(r.salary))
const blankCount = (rows, key) => rows.filter((r) => (r[key] ?? '').trim() === '').length

// ------------------------------------------------------- coverage windows
// Derived from the files. Three of these correct figures quoted elsewhere in
// this program, so they are the reason the doc exists.

test('each file states its own coverage window', () => {
  const span = (rows, key) => {
    const years = rows.map((r) => Number(r[key])).filter(Number.isFinite)
    return [Math.min(...years), Math.max(...years)]
  }
  assert.deepEqual(span(salaries, 'year'), [2000, 2026])
  assert.deepEqual(span(freeAgency, 'year'), [1991, 2026])
  assert.deepEqual(span(arbitration, 'season'), [2018, 2026])

  const signed = extensions
    .map((r) => (r.signed_date ? Number(r.signed_date.slice(0, 4)) : NaN))
    .filter(Number.isFinite)
  assert.deepEqual([Math.min(...signed), Math.max(...signed)], [1992, 2026])
})

test('arbitration covers nine seasons and nothing before 2018', () => {
  const seasons = new Set(arbitration.map((r) => Number(r.season)))
  assert.equal(seasons.size, 9)
  assert.deepEqual([...seasons].sort(), [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
})

test('46 extensions were signed before 2000', () => {
  // The "extensions start in 2000" figure quoted elsewhere in this program is
  // wrong. These 46 rows are why.
  const early = extensions.filter((r) => r.signed_date && Number(r.signed_date.slice(0, 4)) < 2000)
  assert.equal(early.length, 46)
  assert.equal(blankCount(extensions, 'signed_date'), 6)
})

// ------------------------------------------------------ the population break
// The row count steps at 2017 and spikes once at 2015. Both steps live entirely
// in rows that carry no salary figure, which is why a dollar total survives the
// break and a row count does not.

test('every row with no salary figure falls in 2015 or 2017-2026', () => {
  const years = new Set(salaries.filter((r) => !isNumber(r.salary)).map((r) => Number(r.year)))
  const expected = [2015, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
  assert.deepEqual([...years].sort((a, b) => a - b), expected)
})

test('the salaried population does not step at 2015 or 2017', () => {
  const perYear = new Map()
  for (const row of salaried) perYear.set(row.year, (perYear.get(row.year) ?? 0) + 1)
  // The raw row count roughly doubles at 2015 and rises by 40% at 2017. The
  // salaried count moves by a few dozen, which is ordinary season-to-season
  // churn. That contrast IS the finding.
  for (const [a, b] of [['2014', '2015'], ['2016', '2017']]) {
    const change = Math.abs(perYear.get(b) - perYear.get(a)) / perYear.get(a)
    assert.ok(change < 0.05, `salaried count moved ${(change * 100).toFixed(1)}% from ${a} to ${b}`)
  }
  // 2006-2026 is the comparable era: flat enough to put in a series.
  for (let year = 2006; year <= 2026; year++) {
    const n = perYear.get(String(year))
    assert.ok(n >= 850 && n <= 1000, `${year} has ${n} salaried rows, outside the stable band`)
  }
  // THE REGIME BOUNDARY, which W1 and every W2 spike read from the doc.
  // 2000-2002 sit under the 750-player league floor (30 clubs, 25 active each),
  // so those seasons are provably incomplete and their totals under-report.
  for (const year of ['2000', '2001', '2002']) {
    assert.ok(perYear.get(year) < 750, `${year} is no longer below the 750 floor`)
  }
  assert.equal(perYear.get('2000'), 559)
  assert.equal(perYear.get('2001'), 631)
  assert.equal(perYear.get('2002'), 716)
})

test('the 2015 unsalaried block reaches deep into veteran service time', () => {
  // The block is the rows whose salary cell is EMPTY. The one cell that reads
  // `forfeited` is a salaried row with a status, not a row the source declined
  // to price, so it stays out of this count.
  const block = (year) => salaries.filter((r) => r.year === String(year) && r.salary === '')
  const veterans = (year) => block(year).filter((r) => parseFloat(r.mls) >= 3).length
  // 2015 carries 157 men with three or more years of service. No other block
  // comes within a factor of ten. That contrast is what makes 2015 a wider draw
  // rather than a payroll event, so assert the contrast, not an arbitrary bound.
  assert.equal(veterans(2015), 157)
  for (let year = 2017; year <= 2026; year++) {
    assert.ok(
      veterans(2015) > 10 * veterans(year),
      `${year} block holds ${veterans(year)} veterans against 2015's ${veterans(2015)}`,
    )
  }
})

// ------------------------------------------------- the 88 duplicate pairs
// Three categories, three rules. The classifier below is the doc's rule set,
// executed. A duplicate that falls through to `unexplained` is a duplicate
// nobody has read yet, and the rules say an unexplained duplicate is flagged
// and kept — never merged.

const PITCHER = /hp|^p$/

// Three pairs that no rule inside the file can separate, because both rows read
// the same position and the pair appears in one season only. A person checked
// each against public/data/contracts-history/season-players/, which lists who
// appeared in MLB each season with an MLB id, and found two men. The ids ARE the
// evidence — keep them next to the exception, so the next reader can re-run the
// check instead of trusting a category.
//
// Add to this list only after the same check. A duplicate nobody has read stays
// unexplained, and this test fails until somebody reads it.
const CONFIRMED_BY_ID = new Map([
  ['2016|Duffy, Matt', '622110 (3B, debut 2014) and 592274 (3B, debut 2015)'],
  ['2015|Taylor, Michael', '446345 (RF, debut 2011) and 572191 (RF, debut 2014)'],
  ['2003|Castro, Ramon', '135783 (C, debut 1999) and 425792 (2B, debut 2004)'],
])

function duplicateGroups() {
  const groups = new Map()
  for (const row of salaries) {
    const key = `${row.year}|${row.player}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.entries()].filter(([, rows]) => rows.length > 1)
}

function classify(groups) {
  const out = { verbatim: [], obligation: [], homonym: [], unexplained: [] }
  const byName = new Map()
  for (const [key, rows] of groups) {
    const name = key.split('|')[1]
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push({ year: Number(key.split('|')[0]), rows })
  }
  // Two careers running side by side: the same name duplicated in consecutive
  // seasons with BOTH service-time values advancing.
  const parallelTracks = (name) => {
    const seasons = byName
      .get(name)
      .filter((e) => e.rows.every((r) => r.mls !== ''))
      .sort((a, b) => a.year - b.year)
    for (let i = 1; i < seasons.length; i++) {
      if (seasons[i].year !== seasons[i - 1].year + 1) continue
      const before = seasons[i - 1].rows.map((r) => parseFloat(r.mls)).sort((a, b) => a - b)
      const after = seasons[i].rows.map((r) => parseFloat(r.mls)).sort((a, b) => a - b)
      if (after[0] > before[0] && after[1] > before[1]) return true
    }
    return false
  }
  for (const [key, rows] of groups) {
    const [a, b] = rows
    // An obligation row carries no position and no service time: money a club
    // owed a man who was not on its roster.
    if (rows.some((r) => r.position === '' && r.mls === '')) {
      out.obligation.push(key)
    } else if (a.position === b.position && a.mls === b.mls && a.salary === b.salary) {
      out.verbatim.push(key)
    } else if (PITCHER.test(a.position) !== PITCHER.test(b.position)) {
      out.homonym.push(key)
    } else if (a.mls !== b.mls && (a.position !== b.position || parallelTracks(key.split('|')[1]))) {
      out.homonym.push(key)
    } else if (CONFIRMED_BY_ID.has(key)) {
      out.homonym.push(key)
    } else {
      out.unexplained.push(key)
    }
  }
  return out
}

test('88 duplicate pairs, all of them classified', () => {
  const groups = duplicateGroups()
  assert.equal(groups.length, 88)
  assert.ok(groups.every(([, rows]) => rows.length === 2), 'a group holds more than two rows')

  const cats = classify(groups)
  assert.equal(cats.verbatim.length, 27)
  assert.equal(cats.obligation.length, 26)
  assert.equal(cats.homonym.length, 35)
  assert.deepEqual(cats.unexplained, [], 'an unexplained duplicate appeared — read it before you merge it')
})

test('the repeated rows belong to six players and restate $89,426,775', () => {
  const cats = classify(duplicateGroups())
  const names = new Set(cats.verbatim.map((k) => k.split('|')[1]))
  assert.deepEqual(
    [...names].sort(),
    ['Anderson, Garret', 'Branyan, Russell', 'Proctor, Scott', 'Robertson, Nate', 'Stokes, Brian', 'Villarreal, Oscar'],
  )
  const restated = cats.verbatim.reduce((sum, key) => {
    const [year, player] = key.split('|')
    const row = salaries.find((r) => r.year === year && r.player === player)
    return sum + Number(row.salary)
  }, 0)
  assert.equal(restated, 89426775)
})

test('two men named Chris Young are never merged into one', () => {
  // The cheapest way to get this wrong is to key a payroll on (year, player).
  const rows = salaries.filter((r) => r.year === '2016' && r.player === 'Young, Chris')
  assert.equal(rows.length, 2)
  assert.notEqual(rows[0].position, rows[1].position)
})

// ---------------------------------------------- the row-deletion tripwire

test('salaries_summary reconciles against every season of salaries.csv', () => {
  // A wave once deleted 23 rows from the detail file and broke five seasons
  // here before anybody read a rowKey. This is the cheapest check that a row
  // moved. If it fails, do not adjust the summary -- find the deleted row and
  // put it back. Exclusion belongs at read time, on a field.
  assert.equal(salaries.length, 27349)
  const failures = []
  for (const season of summary) {
    const paid = salaries.filter((r) => r.year === season.year && isNumber(r.salary))
    const dollars = paid.reduce((sum, r) => sum + Number(r.salary), 0)
    const sorted = paid.map((r) => Number(r.salary)).sort((a, b) => a - b)
    const middle = sorted.length / 2
    const median =
      sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[middle - 1] + sorted[middle]) / 2
    if (Number(season.total_payroll) !== dollars) failures.push(`${season.year} total`)
    if (Number(season.players_with_salary) !== paid.length) failures.push(`${season.year} count`)
    if (Number(season.median_salary) !== median) failures.push(`${season.year} median`)
  }
  assert.deepEqual(failures, [], 'a season stopped reconciling — a row was deleted or edited')
  assert.equal(summary.length, 27)
})

test('every job-title row is still in salaries.csv, flagged and not deleted', () => {
  // The 49 rows whose position cell holds a front-office title instead of a
  // playing position. 26 of them belong to men who were playing that season and
  // are players; 23 are genuine executives, listed as a VIEW in executives.csv
  // and excluded downstream by resolveRole(). Neither group may leave this file.
  const titles = salaries.filter((r) =>
    /^(mgr|Manager|GM|SVP, GM|VP, AGM|spec ass't to GM)$/.test(r.position),
  )
  assert.equal(titles.length, 49)
  // The executives among them, named, so a future deletion cannot pass quietly.
  for (const [year, player] of [
    ['2001', 'La Russa, Tony'],
    ['2000', 'Baker, Dusty'],
    ['2002', 'Beane, Billy'],
    ['2001', 'Cashman, Brian'],
    ['2004', 'Wedge, Eric'],
  ]) {
    assert.ok(
      salaries.some((r) => r.year === year && r.player === player),
      `${year} ${player} was deleted from salaries.csv — flag a row, never remove it`,
    )
  }
  // And the players wrongly wearing a manager's title, who must never be swept
  // out with them.
  for (const [year, player, salary] of [
    ['2002', 'Ventura, Robin', '8500000'],
    ['2003', 'Ausmus, Brad', '5500000'],
  ]) {
    const row = salaries.find((r) => r.year === year && r.player === player)
    assert.equal(row?.salary, salary)
  }
})

// ------------------------------------------------------- obligation rows
// A row with no position and no service time is money without a roster spot.
// Twinned rows restate a salary the file already carries; orphan rows are the
// only record of money a club really paid.

test('67 obligation rows split 25 twinned and 42 orphan', () => {
  const key = (name) => name.toLowerCase().replace(/[^a-z, ]/g, '').trim()
  const obligations = salaries.filter((r) => r.position === '' && r.mls === '')
  assert.equal(obligations.length, 67)

  let twinned = 0
  let twinnedDollars = 0
  let orphan = 0
  let orphanDollars = 0
  for (const row of obligations) {
    const hasRosterRow = salaries.some(
      (o) => o !== row && o.year === row.year && key(o.player) === key(row.player) && o.position !== '',
    )
    const dollars = Number(row.salary || 0)
    if (hasRosterRow) {
      twinned += 1
      twinnedDollars += dollars
    } else {
      orphan += 1
      orphanDollars += dollars
    }
  }
  assert.equal(twinned, 25)
  assert.equal(twinnedDollars, 110009167)
  assert.equal(orphan, 42)
  assert.equal(orphanDollars, 249559405)
})

test('Roy Halladay 2010 shows the double count the twinned rule removes', () => {
  const rows = salaries.filter((r) => r.year === '2010' && r.player === 'Halladay, Roy')
  assert.equal(rows.length, 2)
  const full = rows.find((r) => r.position !== '')
  const share = rows.find((r) => r.position === '')
  // Toronto's $6M share of a $15.75M Philadelphia salary. Counting both puts
  // $21.75M on a $15.75M contract.
  assert.equal(Number(full.salary), 15750000)
  assert.equal(Number(share.salary), 6000000)
  assert.ok(Number(share.salary) < Number(full.salary))
})

// -------------------------------------------------------- blank-rate floors
// Counts, not rates, so a source fix that changes a denominator fails loudly
// instead of shifting a percentage by a tenth in silence.

test('salaries blank counts hold, and service time is a window not scatter', () => {
  assert.equal(blankCount(salaries, 'salary'), 3974)
  // Every row before 2010 lacks service time; almost none after it does.
  const early = salaries.filter((r) => Number(r.year) < 2010)
  const late = salaries.filter((r) => Number(r.year) >= 2010)
  assert.equal(blankCount(early, 'mls'), early.length)
  assert.ok(blankCount(late, 'mls') / late.length < 0.005)
})

test('exactly one salary cell is a word, and it is a forfeit', () => {
  const words = salaries.filter((r) => r.salary !== '' && !isNumber(r.salary))
  assert.equal(words.length, 1)
  assert.equal(words[0].player, 'Cano, Robinson')
  assert.equal(words[0].year, '2021')
  assert.equal(words[0].salary, 'forfeited')
})

test('free agency blank counts hold', () => {
  assert.equal(freeAgency.length, 5598)
  assert.equal(blankCount(freeAgency, 'guarantee'), 1045)
  assert.equal(blankCount(freeAgency, 'agent'), 1454)
  assert.equal(blankCount(freeAgency, 'aav'), 2211)
})

test('guarantee of 1 is a minor-league sentinel, not one dollar', () => {
  // The single largest distortion in this file: a fifth of its rows. Counting
  // it as a dollar halves the 2020 median guarantee.
  const sentinels = freeAgency.filter((r) => r.guarantee === '1')
  assert.equal(sentinels.length, 1156)
  assert.equal(sentinels.filter((r) => r.years === '0').length, 1153)
  const years = sentinels.map((r) => Number(r.year))
  assert.deepEqual([Math.min(...years), Math.max(...years)], [1991, 2023])
  // The convention stops after 2023, so a series spanning the change compares
  // two conventions and reads the difference as a market move.
  assert.equal(sentinels.filter((r) => Number(r.year) > 2023).length, 0)
  // 1,045 empty cells plus 1,156 sentinels: 2,201 rows state no usable figure.
  assert.equal(blankCount(freeAgency, 'guarantee') + sentinels.length, 2201)
})

test('dropping the sentinel doubles the 2020 median guarantee', () => {
  const median = (values) => {
    const sorted = values.slice().sort((a, b) => a - b)
    const middle = sorted.length / 2
    return sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[middle - 1] + sorted[middle]) / 2
  }
  const priced = (year) =>
    freeAgency.filter((r) => r.year === year && Number.isFinite(Number(r.guarantee)) && r.guarantee !== '')
  assert.equal(median(priced('2020').map((r) => Number(r.guarantee))), 3000000)
  assert.equal(median(priced('2020').filter((r) => r.guarantee !== '1').map((r) => Number(r.guarantee))), 6050000)
  assert.equal(median(priced('2023').map((r) => Number(r.guarantee))), 7500000)
  assert.equal(median(priced('2023').filter((r) => r.guarantee !== '1').map((r) => Number(r.guarantee))), 11500000)
})

test('arbitration states no filed figures in nine cases out of ten', () => {
  assert.equal(arbitration.length, 2420)
  assert.equal(blankCount(arbitration, 'player_request'), 2210)
  assert.equal(blankCount(arbitration, 'club_offer'), 1770)
})

test('extensions is the complete file', () => {
  assert.equal(extensions.length, 999)
  assert.equal(blankCount(extensions, 'guarantee'), 0)
  assert.equal(blankCount(extensions, 'aav'), 0)
  assert.equal(blankCount(extensions, 'mls'), 0)
})

// ------------------------------------------------------------ name defects
// A join on the player name is the natural thing to write and the wrong thing
// to write.

test('deferred-money names carry an asterisk the join must strip', () => {
  const starred = salaries.filter((r) => r.player.includes('*'))
  assert.equal(starred.length, 48)
  assert.deepEqual([...new Set(starred.map((r) => r.year))].sort(), ['2025', '2026'])

  // Every starred name carries exactly ONE asterisk, and it always trails. The
  // stripper below would be wrong under either assumption, so state both here
  // rather than leaving them implicit in a single-occurrence replace.
  for (const row of starred) {
    assert.equal((row.player.match(/\*/g) ?? []).length, 1, `${row.player} carries more than one asterisk`)
    assert.ok(row.player.endsWith('*'), `${row.player} carries a non-trailing asterisk`)
  }

  // replaceAll, not replace: a string-literal first argument to replace strips
  // only the first occurrence, which would silently leave a name half-cleaned
  // the day a second asterisk appears.
  const bare = new Set(starred.map((r) => r.player.replaceAll('*', '')))
  assert.equal(bare.size, 30, '48 starred rows belong to 30 distinct men')

  // Those same 30 men appear WITHOUT the asterisk in 259 other rows, so a raw
  // name join splits each of them in two. Pin both counts: a regression that
  // broke 29 of the 30 joins would still satisfy a `some` check.
  const unstarred = salaries.filter((r) => !r.player.includes('*') && bare.has(r.player))
  assert.equal(unstarred.length, 259)
  assert.equal(new Set(unstarred.map((r) => r.player)).size, 30, 'every starred man also appears unstarred')
})

// ------------------------------------------------- the mls notation, and its
// bare integers
// The column lost its trailing zeros to a float round-trip, so a day part must
// be reconstructed from the DECIMAL LENGTH. These tests pin the evidence for
// that reading, because the reading is what parseServiceTime.js encodes and a
// future export that changes the notation would otherwise ship a silently wrong
// day count. The parser itself is covered in test/parse-service-time.test.js.

const populatedMls = salaries.filter((r) => (r.mls ?? '').trim() !== '')
const decimalOf = (cell) => cell.split('.')[1]

test('19,308 mls cells split 16,382 dotted and 2,926 bare, with no third shape', () => {
  assert.equal(populatedMls.length, 19308)
  const dotted = populatedMls.filter((r) => /^\d+\.\d+$/.test(r.mls))
  const bare = populatedMls.filter((r) => /^\d+$/.test(r.mls))
  assert.equal(dotted.length, 16382)
  assert.equal(bare.length, 2926)
  assert.equal(dotted.length + bare.length, populatedMls.length, 'an mls cell in a shape nobody has read')
  assert.equal(Math.round((1000 * bare.length) / populatedMls.length) / 10, 15.2)
})

test('no mls cell reads X.000 — which is where the bare integers came from', () => {
  // The keystone of the trailing-zero reading. A float drops ".000" entirely,
  // so if the mechanism is real there can be no surviving X.000 cell anywhere.
  // There is none, and none whose decimal part is zeros at any length.
  const zeros = populatedMls.filter((r) => r.mls.includes('.') && /^0+$/.test(decimalOf(r.mls)))
  assert.deepEqual(zeros, [])
})

test('the decimal lengths are 1, 2, 3, 4 and 15, and each is explained', () => {
  const histogram = {}
  for (const row of populatedMls) {
    if (!row.mls.includes('.')) continue
    const length = decimalOf(row.mls).length
    histogram[length] = (histogram[length] ?? 0) + 1
  }
  assert.deepEqual(histogram, { 1: 123, 2: 1569, 3: 14549, 4: 1, 15: 140 })

  // A one-digit decimal can only be a stripped ".100": ".2" would be a 200-day
  // season, which does not exist. All 123 are the digit 1, so the prediction
  // holds with no exception.
  const oneDigit = new Set(
    populatedMls.filter((r) => r.mls.includes('.') && decimalOf(r.mls).length === 1).map((r) => decimalOf(r.mls)),
  )
  assert.deepEqual([...oneDigit], ['1'])

  // The two-digit set is exactly the multiples of ten from 010 to 170, minus
  // 100 (which strips to one digit). No "10", nothing above "17". Any other
  // reading of this column would have to explain that missing 10.
  const twoDigit = [
    ...new Set(
      populatedMls.filter((r) => r.mls.includes('.') && decimalOf(r.mls).length === 2).map((r) => decimalOf(r.mls)),
    ),
  ].sort()
  assert.deepEqual(twoDigit, ['01', '02', '03', '04', '05', '06', '07', '08', '09', '11', '12', '13', '14', '15', '16', '17'])

  // 172 days IS a service year, so a three-digit day part may not reach it.
  const threeDigit = populatedMls
    .filter((r) => r.mls.includes('.') && decimalOf(r.mls).length === 3)
    .map((r) => Number(decimalOf(r.mls)))
  assert.equal(Math.max(...threeDigit), 171)
  assert.equal(threeDigit.filter((d) => d > 172).length, 0)
})

test('the one four-digit cell is Tim Beckham 2015, a typo and not a fourth notation', () => {
  const four = populatedMls.filter((r) => r.mls.includes('.') && decimalOf(r.mls).length === 4)
  assert.equal(four.length, 1)
  assert.equal(four[0].player, 'Beckham, Tim')
  assert.equal(four[0].year, '2015')
  assert.equal(four[0].mls, '0.0145')
  // His own next row is the proof: strip the stray leading zero and 2015 to
  // 2016 is a gain of exactly one full service year.
  const y2016 = salaries.find((r) => r.year === '2016' && r.player === 'Beckham, Tim')
  assert.equal(y2016.mls, '1.145')
  assert.equal(parseServiceTime(y2016.mls).totalDays - parseServiceTime(four[0].mls).totalDays, 172)
})

// The 15 names the duplicate table above already resolved as two different men.
// Luis García appears under both spellings the file uses, so 15 men need 16
// strings — and each is asserted present, because a typo here would silently
// weaken the exclusion instead of failing.
const TWO_MEN_ONE_NAME = [
  'Young, Chris', 'Smith, Will', 'García, Luis', 'Garcia, Luis', 'Castillo, Diego',
  'Muncy, Max', 'Ortiz, Luis', 'Gonzalez, Miguel', 'Nunez, Abraham', 'Carpenter, Chris',
  'Thompson, Rich', 'Taylor, Michael', 'Castro, Ramon', 'Sanchez, Angel', 'Smith, Kevin',
  'Duffy, Matt',
]

test('a year-over-year continuity test finds the bad cells without the transaction wire', () => {
  for (const name of TWO_MEN_ONE_NAME) {
    assert.ok(salaries.some((r) => r.player === name), `${name} is not a name in salaries.csv`)
  }

  // One value per (name, season), taking the last row in file order. That pick
  // only matters for the duplicate names below — every other man has one row a
  // season — which is exactly why the dup-excluded figure is the one the doc
  // quotes.
  const byName = new Map()
  for (const row of populatedMls) {
    if (!byName.has(row.player)) byName.set(row.player, new Map())
    byName.get(row.player).set(Number(row.year), parseServiceTime(row.mls).totalDays)
  }

  // A violation is a gain above a realistic 200-day season, or a gain below
  // zero. Service time never falls, and no season banks 200 days.
  const excluded = new Set(TWO_MEN_ONE_NAME)
  let pairs = 0
  let violations = 0
  let cleanPairs = 0
  let cleanViolations = 0
  for (const [name, seasons] of byName) {
    for (const [year, before] of seasons) {
      if (!seasons.has(year + 1)) continue
      const gain = seasons.get(year + 1) - before
      const bad = gain > 200 || gain < 0
      pairs++
      if (bad) violations++
      if (!excluded.has(name)) {
        cleanPairs++
        if (bad) cleanViolations++
      }
    }
  }
  assert.equal(pairs, 13291)
  assert.equal(violations, 38)
  assert.equal(cleanPairs, 13229)
  assert.equal(cleanViolations, 26)
  assert.equal(Math.round((100000 * cleanViolations) / cleanPairs) / 1000, 0.197)
})

test('1,745 of the 2,926 bare cells have no earlier mls to check them against', () => {
  // The at-risk population, and an UPPER BOUND rather than a count of wrong
  // cells: it also holds every man whose earlier seasons predate 2010, when the
  // column starts. At the other end, 62 bare cells follow a dotted history for
  // the same man and are the highest-trust bare cells in the file.
  const history = new Map()
  for (const row of populatedMls) {
    if (!history.has(row.player)) history.set(row.player, [])
    history.get(row.player).push(row)
  }
  let noHistory = 0
  let dottedHistory = 0
  const bare = populatedMls.filter((r) => /^\d+$/.test(r.mls))
  for (const row of bare) {
    const earlier = history.get(row.player).filter((o) => o !== row && Number(o.year) <= Number(row.year))
    if (earlier.length === 0) noHistory++
    else if (earlier.some((o) => o.mls.includes('.'))) dottedHistory++
  }
  assert.equal(bare.length, 2926)
  assert.equal(noHistory, 1745)
  assert.equal(Math.round((1000 * noHistory) / bare.length) / 10, 59.6)
  assert.equal(dottedHistory, 62)
  assert.equal(Math.round((1000 * dottedHistory) / bare.length) / 10, 2.1)
})

// ----------------------------------------- arbitration.csv's `note` column
// A pre-settlement projected figure, not the recorded outcome. These tests pin
// the evidence for that reading, because the consequence of the other reading
// is a backfill: an estimate entering a series of recorded facts.

const noteOf = (row) => (row.note ?? '').trim()
const moneyNote = arbitration.filter((r) => isNumber(noteOf(r)))

test('note carries a bare dollar figure on 1,440 of 2,420 rows', () => {
  assert.equal(arbitration.length, 2420)
  assert.equal(arbitration.filter((r) => noteOf(r) !== '').length, 1442)
  assert.equal(moneyNote.length, 1440)
  // The only two non-money values in the whole column, so a caller that reads
  // note as a number has exactly these to handle.
  const prose = [...new Set(arbitration.map(noteOf).filter((n) => n !== '' && !isNumber(n)))].sort()
  assert.deepEqual(prose, ['4-year extension', 'signed 4-year extension'])
  // The money figure covers five of the file's nine seasons. The two prose
  // values sit on the 2019 sheet, which carries no money note at all.
  const sheets = [...new Set(moneyNote.map((r) => r.source_sheet))].sort()
  assert.deepEqual(sheets, [
    'MLB-2022 Arb by club',
    'MLB-2023 Arb by club',
    'MLB-2024 Arb by club',
    'MLB-2025 Arb by club',
    'MLB-2026 Arb by club',
  ])
})

test('note disagrees with settled_salary on 1,002 of 1,058 rows', () => {
  const both = moneyNote.filter((r) => isNumber((r.settled_salary ?? '').trim()))
  assert.equal(both.length, 1058)
  const equal = both.filter((r) => Number(r.note) === Number(r.settled_salary))
  assert.equal(equal.length, 56)
  assert.equal(both.length - equal.length, 1002)
  assert.equal(Math.round((1000 * (both.length - equal.length)) / both.length) / 10, 94.7)
  // Loosening the test does not rescue it. Half the rows still miss by more
  // than a tenth, which no recorded figure does.
  const within = (p) =>
    both.filter((r) => Math.abs(Number(r.note) - Number(r.settled_salary)) <= p * Number(r.settled_salary)).length
  assert.equal(within(0.01), 85)
  assert.equal(within(0.05), 332)
  assert.equal(within(0.1), 544)
  // Nor is it another column wearing a different name.
  const testableMidpoint = moneyNote.filter(
    (r) => isNumber((r.player_request ?? '').trim()) && isNumber((r.club_offer ?? '').trim()),
  )
  assert.equal(testableMidpoint.length, 121)
  assert.equal(
    testableMidpoint.filter((r) => Number(r.note) === (Number(r.player_request) + Number(r.club_offer)) / 2).length,
    4,
  )
  const testablePrior = moneyNote.filter((r) => isNumber((r.prior_salary ?? '').trim()))
  assert.equal(testablePrior.length, 1336)
  assert.equal(testablePrior.filter((r) => Number(r.note) === Number(r.prior_salary)).length, 42)
})

test('a money note never sits beside a non-dollar outcome — 0 of 1,440', () => {
  // The tell. A settlement column records "outrighted", "non-tendered",
  // "released" and the rest; a figure produced BEFORE the case closed has
  // nothing to say about those, and sure enough it never appears next to one.
  const shapes = { numeric: 0, blank: 0, extension: 0, outcome: 0 }
  for (const row of moneyNote) {
    const settled = (row.settled_salary ?? '').trim()
    if (isNumber(settled)) shapes.numeric++
    else if (settled === '') shapes.blank++
    else if (/\d\s*(?:y|yr)?\s*[/+]|extn|ext\b|extension/i.test(settled)) shapes.extension++
    else shapes.outcome++
  }
  assert.deepEqual(shapes, { numeric: 1058, blank: 359, extension: 23, outcome: 0 })
  // 382 rows would be "filled" by a backfill, and 23 of them would have a
  // multi-year deal restated as one settled season.
  assert.equal(shapes.blank + shapes.extension, 382)
})

test('one arbitration row disagrees with its own source sheet, and only one', () => {
  const mismatched = arbitration.filter((r) => {
    const sheet = r.source_sheet.match(/MLB-(\d{4})/)
    return sheet && sheet[1] !== r.season
  })
  assert.equal(mismatched.length, 1)
  assert.equal(mismatched[0].player, 'Hutchison, Drew')
  assert.equal(mismatched[0].club, 'DET')
  assert.equal(mismatched[0].season, '2020')
  assert.equal(mismatched[0].source_sheet, 'MLB-2022 Arb by club')
})

// ------------------------------------------------------- the 2020 salaries
// This file's header says it does not pin per-season dollar totals, because a
// source fix moves them. These two are the exception, and deliberately so: the
// doc quotes both figures verbatim AS the evidence that 2020 records contracted
// salary rather than what the 60-game season paid. If either number moves, the
// doc's sentence is wrong and has to move with it.

test('2020 records the contracted salary, not what the 60-game season paid', () => {
  const total = (year) =>
    salaries.filter((r) => r.year === year && isNumber(r.salary)).reduce((sum, r) => sum + Number(r.salary), 0)
  assert.equal(total('2020'), 3987209077)
  assert.equal(total('2019'), 3887858407)
  // A season that paid about 37% of contracted salary cannot total MORE than
  // the season before it. That relation is the finding; the two figures above
  // are how it is read off the file.
  assert.ok(total('2020') > total('2019'), '2020 no longer exceeds 2019 — re-read the doc before editing either')
})
