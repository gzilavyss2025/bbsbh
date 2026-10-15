import test from 'node:test'
import assert from 'node:assert/strict'

// The Money band's pure shapes (#1107, row 6e): the four tiles and the jump-bar count.
const { moneyTiles, moneyCount, MONEY_NOTE } = await import('../src/screens/team/next/money/moneyData.js')

const fmt = (n) => `$${n / 1e6}M`
const ledger = {
  season: 2026,
  payroll: 150_000_000,
  committedAfter: 90_000_000,
  years: [2026, 2027, 2028],
  counts: { option: 2, arbitration: 3 },
  totals: [{ year: 2026, players: 40, committed: 150_000_000 }],
}

test('payroll is the lead tile and carries the rank mark', () => {
  const [lead, after, option, arb] = moneyTiles({ ledger, standing: { rank: 22 }, clubCount: 30 }, fmt)
  assert.equal(lead.lead, true)
  assert.deepEqual(lead.rank, { rank: 22, of: 30 })
  assert.equal(lead.label, '2026 payroll')
  assert.equal(lead.value, '$150M')
  assert.equal(after.caption, 'Through 2028')
  assert.equal(option.value, '2')
  assert.equal(arb.value, '3')
})

test('no standing: the lead tile counts players instead and has no rank', () => {
  const [lead] = moneyTiles({ ledger, standing: null, clubCount: null }, fmt)
  assert.equal(lead.rank, undefined)
  assert.equal(lead.caption, '40 players')
})

test('count is the players on the ledger; none without a ledger', () => {
  assert.equal(moneyCount({ ledger }), 40)
  assert.equal(moneyCount({ ledger: null }), undefined)
  assert.equal(moneyCount(null), undefined)
})

test('the note says the figures do not move with a date', () => {
  assert.match(MONEY_NOTE, /do not move with a date/)
})
