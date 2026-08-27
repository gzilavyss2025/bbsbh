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
  // The same men appear without the asterisk in earlier seasons, so a raw name
  // join splits one player in two.
  const bare = new Set(starred.map((r) => r.player.replace('*', '')))
  assert.ok(salaries.some((r) => !r.player.includes('*') && bare.has(r.player)))
})
