// Unit coverage for src/api/person/contract/history.js — the pure translation
// behind the player page's Contract history card. The card's whole difficulty
// is that one `terms` field carries four different vocabularies and is allowed
// to be empty, so every case below is a real row shape read off the shipped
// shards in public/data/contracts-history/.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  contractHistoryView,
  contractRowView,
  optionLabel,
  shortMoney,
} from '../src/api/person/contract/history.js'

const row = (over) => ({ rowKey: 'salaries#1', sourceFile: 'salaries', season: 2020, teamId: 158, terms: {}, confidence: 'exact', ...over })

// ---- money -----------------------------------------------------------------

test('money reads as money, trimmed, in one unit per size', () => {
  assert.equal(shortMoney(51_000_000), '$51M')
  assert.equal(shortMoney(1_900_000), '$1.9M')
  assert.equal(shortMoney(6_350_000), '$6.35M')
  assert.equal(shortMoney(650_000), '$650K')
  assert.equal(shortMoney(781_150), '$781K')
  assert.equal(shortMoney(1), '$1')
})

test('money says nothing when there is no figure', () => {
  assert.equal(shortMoney(null), null)
  assert.equal(shortMoney(undefined), null)
  assert.equal(shortMoney('outrighted'), null)
  assert.equal(shortMoney(Number.NaN), null)
})

// ---- the four vocabularies -------------------------------------------------

test('a salaries row reads as one season\'s pay', () => {
  const view = contractRowView(row({ rowKey: 'salaries#24271', season: 2004, teamId: null, terms: { salary: 650000 } }))
  assert.equal(view.kind, 'salary')
  assert.equal(view.label, 'Salary')
  assert.equal(view.headline, '$650K')
  assert.equal(view.amount, 650000)
  assert.deepEqual(view.details, [])
  assert.equal(view.note, null)
})

test('an extensions row reads as a deal: length, guarantee, per-year, span, option', () => {
  const view = contractRowView(
    row({
      rowKey: 'extensions#973',
      sourceFile: 'extensions',
      season: 2006,
      teamId: 116,
      terms: { years: 2, guarantee: 1900000, aav: 950000, first_year: 2007, final_year: 2008 },
    }),
  )
  assert.equal(view.kind, 'extension')
  assert.equal(view.label, 'Extension')
  assert.equal(view.headline, '2 yr · $1.9M')
  assert.equal(view.amount, 1900000)
  assert.deepEqual(view.details, [
    { k: 'Per year', v: '$950K' },
    { k: 'Covers', v: '2007-2008' },
  ])
})

test('an extension option code is spelled out, and an unknown one prints as it is', () => {
  const withOption = contractRowView(
    row({ sourceFile: 'extensions', terms: { years: 3, guarantee: 51000000, aav: 17000000, option: 'c', first_year: 2025, final_year: 2027 } }),
  )
  assert.deepEqual(withOption.details.at(-1), { k: null, v: 'club option' })
  assert.equal(optionLabel('c (2)'), '2 club options')
  assert.equal(optionLabel('m v'), 'mutual + vesting options')
  assert.equal(optionLabel('player'), 'player option')
  assert.equal(optionLabel('c (recur)'), 'c (recur)')
  assert.equal(optionLabel('-'), null)
})

test('a free_agency row reads as a signing, with its opt-out', () => {
  const view = contractRowView(
    row({
      rowKey: 'free_agency#366',
      sourceFile: 'free_agency',
      season: 2024,
      teamId: 135,
      terms: { years: 2, guarantee: 32000000, aav: 16000000, term: '2024-25', option: 'player', opt_out: 'Y' },
    }),
  )
  assert.equal(view.kind, 'freeAgency')
  assert.equal(view.label, 'Free agency')
  assert.equal(view.headline, '2 yr · $32M')
  assert.deepEqual(view.details, [
    { k: 'Per year', v: '$16M' },
    { k: 'Covers', v: '2024-25' },
    { k: null, v: 'player option' },
    { k: null, v: 'opt-out' },
  ])
})

test('an arbitration row that settled on a figure says so, and carries the prior salary', () => {
  const view = contractRowView(
    row({
      rowKey: 'arbitration#2175',
      sourceFile: 'arbitration',
      season: 2019,
      teamId: 138,
      terms: { prior_salary: 5300000, settled_salary: 6350000 },
    }),
  )
  assert.equal(view.kind, 'arbitration')
  assert.equal(view.headline, 'Settled $6.35M')
  assert.equal(view.amount, 6350000)
  assert.deepEqual(view.details, [{ k: 'Prior salary', v: '$5.3M' }])
})

test('an arbitration case that ended some other way prints the outcome word', () => {
  const view = contractRowView(
    row({ sourceFile: 'arbitration', terms: { prior_salary: 2000000, settled_salary: 'non-tendered' } }),
  )
  assert.equal(view.headline, 'non-tendered')
  assert.equal(view.amount, null)
})

test('both filings show when the case is still a pair of numbers', () => {
  const view = contractRowView(
    row({ sourceFile: 'arbitration', terms: { prior_salary: 900000, club_offer: 2000000, player_request: 2200000 } }),
  )
  assert.equal(view.headline, null)
  assert.equal(view.note, 'Outcome not recorded')
  assert.deepEqual(view.details, [
    { k: 'Prior salary', v: '$900K' },
    { k: 'Club filed', v: '$2M' },
    { k: 'Player filed', v: '$2.2M' },
  ])
})

// ---- `note` is never rendered ----------------------------------------------

test('an arbitration note never reaches the card, as a salary or as anything else', () => {
  const view = contractRowView(
    row({
      rowKey: 'arbitration#1227',
      sourceFile: 'arbitration',
      season: 2020,
      teamId: 116,
      terms: { club_offer: 'outrighted', note: 850000 },
    }),
  )
  // The club_offer word IS the outcome on a row shaped like this one.
  assert.equal(view.headline, 'outrighted')
  const printed = JSON.stringify(view)
  assert.equal(printed.includes('850000'), false)
  assert.equal(printed.includes('$850K'), false)
  assert.equal(view.details.some((d) => d.k === 'Club filed'), false)
})

// ---- the awkward rows ------------------------------------------------------

test('an empty terms object renders an honest sentence, never a blank row', () => {
  const freeAgent = contractRowView(row({ rowKey: 'free_agency#3506', sourceFile: 'free_agency', season: 2006, teamId: 118, terms: {} }))
  assert.equal(freeAgent.headline, null)
  assert.deepEqual(freeAgent.details, [])
  assert.equal(freeAgent.note, 'Terms not recorded')

  const salary = contractRowView(row({ terms: {} }))
  assert.equal(salary.headline, null)
  assert.equal(salary.note, 'Salary not recorded')
})

test('a missing or non-object terms field is treated as an empty one', () => {
  assert.equal(contractRowView(row({ terms: null })).note, 'Salary not recorded')
  assert.equal(contractRowView(row({ terms: undefined })).note, 'Salary not recorded')
  assert.equal(contractRowView(row({ terms: '1 yr $5M' })).note, 'Salary not recorded')
  assert.equal(contractRowView(null), null)
})

test('a null teamId survives as null — every salaries row has one', () => {
  const view = contractRowView(row({ teamId: null, terms: { salary: 510000 } }))
  assert.equal(view.teamId, null)
  assert.equal(view.headline, '$510K')
})

test('a free-agency guarantee of 1 reads as the minor-league deal it marks, never as $1', () => {
  // The sentinel: 1,156 rows, a fifth of free_agency.csv, 1,153 of them with
  // `years: 0` beside it. It is the source's mark for a minor-league deal, not
  // one dollar and not a missing value (docs/contracts-data-caveats.md).
  const view = contractRowView(
    row({ rowKey: 'free_agency#631', sourceFile: 'free_agency', season: 2023, teamId: 144, terms: { years: 0, guarantee: 1, term: 2023 } }),
  )
  assert.equal(view.headline, 'Minor-league deal')
  assert.equal(view.amount, null)
  // The terms WERE recorded; the row must not claim otherwise.
  assert.equal(view.note, null)
  assert.deepEqual(view.details, [{ k: 'Covers', v: '2023' }])
  const printed = JSON.stringify(view)
  assert.equal(printed.includes('$1'), false)
})

test('the sentinel drops the per-year figure derived from it', () => {
  // 39 of the 40 sentinel rows carrying an `aav` repeat the sentinel there too.
  const view = contractRowView(
    row({ rowKey: 'free_agency#1000', sourceFile: 'free_agency', season: 2021, teamId: 109, terms: { years: 0, guarantee: 1, aav: 1, term: 2021 } }),
  )
  assert.equal(view.headline, 'Minor-league deal')
  assert.equal(view.details.some((d) => d.k === 'Per year'), false)
  assert.equal(JSON.stringify(view).includes('$1'), false)
})

test('the sentinel is read by its meaning, not by its size', () => {
  // A real one-dollar figure anywhere else is still nothing anyone signed, so
  // the magnitude floor stays — but it is no longer what catches the sentinel,
  // and it never reaches an extension row's guarantee.
  const extension = contractRowView(
    row({ sourceFile: 'extensions', season: 2006, teamId: 116, terms: { years: 2, guarantee: 1, aav: 1, first_year: 2007, final_year: 2008 } }),
  )
  assert.equal(extension.headline, '2 yr')
  assert.equal(extension.amount, null)
  // A free-agency guarantee that is small but NOT the sentinel is not a
  // minor-league deal, and does not borrow its wording.
  const notSentinel = contractRowView(
    row({ sourceFile: 'free_agency', season: 2019, teamId: 158, terms: { years: 1, guarantee: 2, term: 2019 } }),
  )
  assert.equal(notSentinel.headline, '1 yr')
})

test('a money field holding a word prints the word, and a placeholder prints nothing', () => {
  assert.equal(contractRowView(row({ terms: { salary: 'forfeited' } })).headline, 'forfeited')
  assert.equal(contractRowView(row({ terms: { salary: 'n/a' } })).note, 'Salary not recorded')
})

test('an unknown source file still renders its season and club', () => {
  const view = contractRowView(row({ rowKey: 'bonuses#7', sourceFile: 'bonuses', season: 2019, teamId: 158, terms: { anything: 1 } }))
  assert.equal(view.kind, 'unknown')
  assert.equal(view.label, 'Contract')
  assert.equal(view.season, 2019)
  assert.equal(view.teamId, 158)
})

// ---- grouping --------------------------------------------------------------

test('seasons group newest first, deal above the salary it explains', () => {
  const view = contractHistoryView([
    row({ rowKey: 'salaries#90', season: 2026, teamId: null, terms: { salary: 18000000 } }),
    row({ rowKey: 'salaries#2589', season: 2024, teamId: null, terms: { salary: 16000000 } }),
    row({ rowKey: 'extensions#935', sourceFile: 'extensions', season: 2024, teamId: 118, terms: { years: 3, guarantee: 51000000, aav: 17000000, first_year: 2025, final_year: 2027 } }),
  ])
  assert.deepEqual(view.seasons.map((s) => s.season), [2026, 2024])
  assert.equal(view.rows, 3)
  assert.deepEqual(view.seasons[1].rows.map((r) => r.kind), ['extension', 'salary'])
  // The season's club comes from the deal, since a salaries row carries none.
  assert.equal(view.seasons[1].teamId, 118)
  assert.equal(view.seasons[0].teamId, null)
})

test('grouping never reads rowKey as a number, whatever shape the key takes', () => {
  const hashed = [
    row({ rowKey: 'salaries#3f0c7a1e58d4b269', season: 2019, terms: { salary: 1000000 } }),
    row({ rowKey: 'salaries#0001', season: 2021, terms: { salary: 2000000 } }),
    row({ rowKey: 'extensions#deadbeefdeadbeef', sourceFile: 'extensions', season: 2021, teamId: 158, terms: { years: 2, guarantee: 9000000, aav: 4500000, first_year: 2021, final_year: 2022 } }),
  ]
  const view = contractHistoryView(hashed)
  assert.deepEqual(view.seasons.map((s) => s.season), [2021, 2019])
  assert.deepEqual(view.seasons[0].rows.map((r) => r.kind), ['extension', 'salary'])
  assert.deepEqual(view.seasons[0].rows.map((r) => r.key), ['extensions#deadbeefdeadbeef', 'salaries#0001'])
})

test('an empty history is an empty view, and no history at all does not throw', () => {
  assert.deepEqual(contractHistoryView([]), { seasons: [], rows: 0 })
  assert.deepEqual(contractHistoryView(null), { seasons: [], rows: 0 })
  assert.deepEqual(contractHistoryView(undefined), { seasons: [], rows: 0 })
})

test('a row with no season sorts below every dated one', () => {
  const view = contractHistoryView([
    row({ rowKey: 'salaries#a', season: null, terms: { salary: 500000 } }),
    row({ rowKey: 'salaries#b', season: 1998, terms: { salary: 600000 } }),
  ])
  assert.deepEqual(view.seasons.map((s) => s.season), [1998, null])
})
