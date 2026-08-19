import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cellFor,
  positionGroup,
  playerRow,
  yearsCovered,
  clubLedger,
  leagueRollup,
  rollUpSalaries,
} from '../scripts/lib/salaries.mjs'
import { payrollScale, commitmentCliff, salaryBoard, clubStanding } from '../src/api/salaries.js'

// THE INVARIANT THESE EXIST FOR: a dollar is committed only when Cot's states a
// dollar. Every out-year is either a figure or a CODE — A1..A4 for an
// arbitration year nobody has settled, OPT for an unexercised option, FA for a
// year the club has no hold at all — and a code is a status, never an amount.
// Get that wrong in either direction and the club ledger's totals, the
// commitment cliff and the league payroll board are all silently wrong together,
// because all three read the same cells.

test('an out-year figure is committed money', () => {
  assert.deepEqual(cellFor(2028, 26_000_000), { year: 2028, kind: 'guaranteed', value: 26_000_000 })
})

test('an arbitration code is a status, never an amount', () => {
  for (const code of ['A1', 'A2', 'A3', 'A4']) {
    const cell = cellFor(2028, code)
    assert.equal(cell.kind, 'arbitration')
    assert.equal(cell.code, code)
    assert.equal(cell.value, undefined, `${code} must not carry a value`)
  }
})

test('an option year is not committed money', () => {
  for (const code of ['OPT', 'cond opt', 'club opt']) {
    const cell = cellFor(2029, code)
    assert.equal(cell.kind, 'option')
    assert.equal(cell.value, undefined)
  }
})

test('a free-agent year carries nothing at all', () => {
  const cell = cellFor(2030, 'FA')
  assert.equal(cell.kind, 'free')
  assert.equal(cell.value, undefined)
})

test('a missing out-year is empty, not zero dollars', () => {
  assert.deepEqual(cellFor(2030, undefined), { year: 2030, kind: 'none' })
  assert.deepEqual(cellFor(2030, ''), { year: 2030, kind: 'none' })
})

test('an unrecognised code is kept and shown rather than dropped', () => {
  const cell = cellFor(2029, 'MIN')
  assert.equal(cell.kind, 'other')
  assert.equal(cell.code, 'MIN')
  assert.equal(cell.value, undefined)
})

test('the contract feed says only "P"; the ledger bands a resolved arm', () => {
  assert.equal(positionGroup('SP'), 'rotation')
  assert.equal(positionGroup('RP'), 'bullpen')
  assert.equal(positionGroup('P'), 'bullpen')
  assert.equal(positionGroup('SS'), 'lineup')
  assert.equal(positionGroup('DH'), 'lineup')
  // No 40-man place is not a hole in the data — it is money owed to a player
  // the club has nobody to show for, which is the whole point of the band.
  assert.equal(positionGroup(null), 'offRoster')
})

const YELICH = {
  playerId: 592885,
  name: 'Christian Yelich',
  clubAbbrev: 'MIL',
  salaryUsd: 26_000_000,
  regime: 'signed',
  outYears: [
    { year: 2027, cash: 26_000_000, cbt: 26_000_000 },
    { year: 2028, cash: 'OPT', cbt: 'OPT' },
    { year: 2029, cash: 'FA', cbt: 'FA' },
  ],
}
const TURANG = {
  playerId: 668930,
  name: 'Brice Turang',
  clubAbbrev: 'MIL',
  salaryUsd: 850_000,
  regime: 'pre_arb',
  outYears: [
    { year: 2027, cash: 'A1', cbt: 'A1' },
    { year: 2028, cash: 'A2', cbt: 'A2' },
    { year: 2029, cash: 'FA', cbt: 'FA' },
  ],
}
const YEARS = [2026, 2027, 2028, 2029]

test('a roster place carries the age the ledger prints beside the name', () => {
  assert.equal(playerRow(YELICH, { pos: 'LF', age: 34 }, 2026, YEARS).age, 34)
  // Money owed to a player with no 40-man place still gets a row; he simply has
  // no age and no position to show.
  const orphan = playerRow(YELICH, null, 2026, YEARS)
  assert.equal(orphan.age, null)
  assert.equal(orphan.pos, null)
})

test("a player's committed total counts figures only", () => {
  const row = playerRow(YELICH, { pos: 'LF', age: 34 }, 2026, YEARS)
  // 26.0 this season + 26.0 guaranteed next. The option and the free-agent year
  // add nothing, which is exactly what makes the club's book fall away.
  assert.equal(row.committed, 52_000_000)
  assert.deepEqual(
    row.cells.map((cell) => cell.kind),
    ['salary', 'guaranteed', 'option', 'free'],
  )
})

test('a pre-arb player commits only the season in hand', () => {
  const row = playerRow(TURANG, { pos: '2B', age: 26 }, 2026, YEARS)
  assert.equal(row.committed, 850_000)
})

test('the year columns come from the data, never a fixed horizon', () => {
  assert.deepEqual(yearsCovered([YELICH, TURANG], 2026), [2026, 2027, 2028, 2029])
  // A club that signs past the current horizon grows a column rather than
  // silently losing the year.
  const long = { outYears: [{ year: 2033, cash: 30_000_000 }] }
  assert.equal(yearsCovered([long], 2026).at(-1), 2033)
})

function ledgerFixture() {
  return clubLedger({
    meta: { season: 2026 },
    team: { id: 158, abbrev: 'MIL', name: 'Milwaukee Brewers' },
    records: [YELICH, TURANG],
    placeFor: (id) =>
      id === YELICH.playerId ? { pos: 'LF', age: 34 } : { pos: '2B', age: 26 },
    season: 2026,
    years: YEARS,
  })
}

test('a club total is the sum of its committed cells, year by year', () => {
  const ledger = ledgerFixture()
  assert.deepEqual(
    ledger.totals.map((entry) => [entry.year, entry.committed]),
    [
      [2026, 26_850_000],
      [2027, 26_000_000],
      [2028, 0],
      [2029, 0],
    ],
  )
  assert.equal(ledger.payroll, 26_850_000)
  assert.equal(ledger.committedAfter, 26_000_000)
})

test('the ledger counts what each kind of cell is, for the stat wall', () => {
  const ledger = ledgerFixture()
  assert.equal(ledger.counts.option, 1)
  assert.equal(ledger.counts.arbitration, 2)
  assert.equal(ledger.counts.free, 2)
  assert.equal(ledger.counts.guaranteed, 3)
})

test('players band by position and sort by what the club is paying them', () => {
  const ledger = ledgerFixture()
  assert.deepEqual(
    ledger.groups.map((group) => group.key),
    ['lineup'],
  )
  assert.deepEqual(
    ledger.groups[0].players.map((player) => player.name),
    ['Christian Yelich', 'Brice Turang'],
  )
})

test('an empty band is left out rather than rendered empty', () => {
  const ledger = ledgerFixture()
  assert.equal(
    ledger.groups.some((group) => group.players.length === 0),
    false,
  )
})

function leagueFixture() {
  const byClub = new Map([
    ['MIL', [YELICH, TURANG]],
    ['NYM', [{ playerId: 1, name: 'A Star', clubAbbrev: 'NYM', salaryUsd: 51_000_000, outYears: [] }]],
  ])
  return leagueRollup({
    meta: { season: 2026 },
    teams: [
      { id: 158, abbrev: 'MIL', name: 'Milwaukee Brewers' },
      { id: 121, abbrev: 'NYM', name: 'New York Mets' },
    ],
    byClub,
    placeFor: (id) =>
      ({ [YELICH.playerId]: { pos: 'LF' }, [TURANG.playerId]: { pos: '2B' }, 1: { pos: 'RF' } })[id] ??
      null,
    season: 2026,
    years: YEARS,
  })
}

test('clubs rank by payroll, biggest first', () => {
  const league = leagueFixture()
  assert.deepEqual(
    league.clubs.map((club) => [club.abbrev, club.rank]),
    [
      ['NYM', 1],
      ['MIL', 2],
    ],
  )
  assert.equal(league.totals.payroll, 77_850_000)
})

test('"still owed" is committed money across the years the source covers', () => {
  const league = leagueFixture()
  // Yelich's 52.0 beats the Mets star's single 51.0 season, which is the whole
  // reason this board is separate from the highest-paid one.
  assert.deepEqual(
    league.owed.map((entry) => [entry.name, entry.remaining]),
    [
      ['Christian Yelich', 52_000_000],
      ['A Star', 51_000_000],
      ['Brice Turang', 850_000],
    ],
  )
})

test('position spend covers only players with a roster place, and says so', () => {
  const league = leagueFixture()
  assert.deepEqual(
    league.positions.map((entry) => entry.pos),
    ['RF', 'LF', '2B'],
  )
  assert.equal(league.totals.covered, league.totals.payroll)
})

test('a player with no salary is left out of the board entirely', () => {
  const league = leagueRollup({
    meta: {},
    teams: [{ id: 158, abbrev: 'MIL', name: 'Milwaukee Brewers' }],
    byClub: new Map([['MIL', [{ playerId: 9, name: 'No Terms', clubAbbrev: 'MIL', salaryUsd: null, outYears: [] }]]]),
    placeFor: () => ({ pos: 'C' }),
    season: 2026,
    years: YEARS,
  })
  assert.equal(league.players.length, 0)
  assert.equal(league.totals.payroll, 0)
})

test('one pass builds both files, and they agree on a club payroll', () => {
  const { clubs, league } = rollUpSalaries({
    meta: { season: 2026 },
    players: [YELICH, TURANG],
    places: new Map([
      [158, new Map([[YELICH.playerId, { pos: 'LF', age: 34 }], [TURANG.playerId, { pos: '2B', age: 26 }]])],
    ]),
    teams: [{ id: 158, abbrev: 'MIL', name: 'Milwaukee Brewers' }],
    season: 2026,
  })
  assert.equal(clubs[0].payroll, league.clubs[0].payroll)
})

// ------------------------------------------------------- the app's selectors

test('the bar scale never divides by zero on an empty book', () => {
  assert.equal(payrollScale([{ year: 2026, committed: 0 }]), 1)
})

test('the cliff is the drop from the season in hand to the last year covered', () => {
  const ledger = ledgerFixture()
  assert.deepEqual(commitmentCliff(ledger.totals), { from: 2026, to: 2029, drop: 26_850_000 })
  assert.equal(commitmentCliff([{ year: 2026, committed: 1 }]), null)
})

test('the board filters by club and by position, and both resets mean "all"', () => {
  const league = leagueFixture()
  assert.equal(salaryBoard(league, {}).length, 3)
  assert.deepEqual(
    salaryBoard(league, { team: 158 }).map((player) => player.name),
    ['Christian Yelich', 'Brice Turang'],
  )
  assert.deepEqual(
    salaryBoard(league, { pos: 'RF' }).map((player) => player.name),
    ['A Star'],
  )
  assert.deepEqual(salaryBoard(league, { team: 121, pos: '2B' }), [])
  assert.deepEqual(salaryBoard(null, {}), [])
})

test('a club can find its own rank without knowing the whole table', () => {
  const league = leagueFixture()
  assert.equal(clubStanding(league, 158).rank, 2)
  assert.equal(clubStanding(league, 999), null)
})
