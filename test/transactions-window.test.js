import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transactionsSeason, transactionsWindow } from '../scripts/lib/time/transactions-window.mjs'

// Season rows as statsapi gives them (checked live 2026-10-06).
const r2025 = { seasonId: '2025', regularSeasonStartDate: '2025-03-18', seasonEndDate: '2025-11-01' }
const r2026 = { seasonId: '2026', regularSeasonStartDate: '2026-03-25', seasonEndDate: '2026-10-31' }
const r2027 = { seasonId: '2027', regularSeasonStartDate: '2027-03-25', seasonEndDate: '2027-10-31' }

const dayAfter = (iso) => new Date(Date.parse(iso) + 864e5).toISOString().slice(0, 10)

test('a season starts the day after the previous seasonEndDate (#1477)', () => {
  assert.equal(transactionsWindow(r2026, r2025, '2026-10-06').start, '2025-11-02')
})

test('no previous row: fall back to regularSeasonStartDate', () => {
  assert.equal(transactionsWindow(r2026, null, '2026-10-06').start, '2026-03-25')
})

test('a year-end previous seasonEndDate rolls into the next year', () => {
  assert.equal(transactionsWindow(r2027, { seasonEndDate: '2026-12-31' }, '2027-01-02').start, '2027-01-01')
})

test('a move on the old seasonEndDate is in the old file, the next day in the new one', () => {
  const old = transactionsWindow(r2025, null, '2026-10-06')
  const next = transactionsWindow(r2026, r2025, '2026-10-06')
  const owns = (w, end, d) => d >= w.start && d <= end
  assert.ok(owns(old, r2025.seasonEndDate, '2025-11-01'))
  assert.ok(!owns(next, r2026.seasonEndDate, '2025-11-01'))
  assert.ok(owns(next, r2026.seasonEndDate, '2025-11-02'))
  assert.ok(!owns(old, r2025.seasonEndDate, '2025-11-02'))
})

test('windows never overlap and never leave a gap', () => {
  const b = transactionsWindow(r2027, r2026, '2027-01-05')
  assert.equal(b.start, dayAfter(r2026.seasonEndDate))
})

test('final follows the season own end date, not the next season', () => {
  assert.equal(transactionsWindow(r2026, r2025, '2026-10-31').final, false)
  assert.equal(transactionsWindow(r2026, r2025, '2026-11-01').final, true)
  assert.equal(transactionsWindow({ seasonId: '2027' }, r2026, '2027-01-05').final, false)
})

test('the file chosen in November 2026 is 2027, and it holds a 2026-11-15 move', () => {
  assert.equal(transactionsSeason('2026-11-15', r2026), 2027)
  const w = transactionsWindow(r2027, r2026, '2026-11-15')
  assert.ok('2026-11-15' >= w.start)
  assert.equal(w.final, false)
})

test('the season in play stays this year through its end date and turns the day after', () => {
  assert.equal(transactionsSeason('2026-10-31', r2026), 2026)
  assert.equal(transactionsSeason('2026-11-01', r2026), 2027)
  assert.equal(transactionsSeason('2027-01-05', r2027), 2027)
  assert.equal(transactionsSeason('2026-04-01', r2026), 2026)
})

test('no season row: the calendar year', () => {
  assert.equal(transactionsSeason('2026-11-15', null), 2026)
})
