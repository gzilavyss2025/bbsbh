import assert from 'node:assert/strict'
import test from 'node:test'
import { collectPending, runSweep } from '../scripts/lib/sweep/retry.mjs'

const game = (gamePk, date, extra = {}) => ({ gamePk, officialDate: date, status: { abstractGameState: 'Final' }, ...extra })
const schedule = (...days) => ({ dates: days.map(([date, ...games]) => ({ date, games })) })
const take = (g, d) => ({ gamePk: g.gamePk, date: g.officialDate })

test('collectPending takes the window first, then older un-ingested Finals', () => {
  const s = schedule(['2026-05-01', game(1, '2026-05-01')], ['2026-10-12', game(2, '2026-10-12')], ['2026-10-13', game(3, '2026-10-13')])
  const rows = collectPending(s, { startDate: '2026-10-12', accept: take })
  assert.deepEqual(rows.map((r) => r.gamePk), [2, 3, 1])
})

test('collectPending skips non-Finals, replay duplicates and what accept refuses', () => {
  const s = schedule(
    ['2026-10-12', game(1, '2026-10-12', { status: { abstractGameState: 'Live' } }), game(2, '2026-10-11'), game(3, '2026-10-12'), game(4, '2026-10-12')],
  )
  const rows = collectPending(s, { startDate: '2026-10-01', accept: (g, d) => (g.gamePk === 4 ? null : take(g, d)) })
  assert.deepEqual(rows.map((r) => r.gamePk), [3])
})

test('collectPending caps the older games but never the window', () => {
  const old = Array.from({ length: 5 }, (_, i) => game(10 + i, '2026-05-01'))
  const win = Array.from({ length: 3 }, (_, i) => game(20 + i, '2026-10-13'))
  const rows = collectPending(schedule(['2026-05-01', ...old], ['2026-10-13', ...win]), { startDate: '2026-10-12', cap: 2, accept: take })
  assert.deepEqual(rows.map((r) => r.gamePk), [20, 21, 22, 10, 11])
})

const sweep = async (pending, ingest, failedBefore = new Set()) => {
  const log = { ok: [], bad: [] }
  const out = await runSweep({ pending, ingest, failedBefore, keyOf: (g) => g.gamePk, onOk: (g) => log.ok.push(g.gamePk), onFail: (g) => log.bad.push(g.gamePk) })
  return { ...out, log }
}

test('a game that fails once is kept for the next run and does not fail the run', async () => {
  const r = await sweep([{ gamePk: 1 }, { gamePk: 2 }], async (g) => { if (g.gamePk === 2) throw new Error('boom') })
  assert.deepEqual(r.failed.map((g) => g.gamePk), [2])
  assert.deepEqual(r.again, [])
  assert.deepEqual(r.log, { ok: [1], bad: [2] })
})

test('the same game failing on two runs in a row fails the run', async () => {
  const r = await sweep([{ gamePk: 2 }], async () => { throw new Error('boom') }, new Set([2]))
  assert.deepEqual(r.again.map((g) => g.gamePk), [2])
})

test('a game that succeeds after a failure is reported ok, so the caller drops it from the failed list', async () => {
  const r = await sweep([{ gamePk: 2 }], async () => {}, new Set([2]))
  assert.deepEqual(r.again, [])
  assert.deepEqual(r.log.ok, [2])
})

test('the checkpoint runs every N games', async () => {
  let n = 0
  await runSweep({ pending: Array.from({ length: 5 }, (_, i) => ({ gamePk: i })), ingest: async () => {}, failedBefore: new Set(), keyOf: (g) => g.gamePk, every: 2, checkpoint: async () => { n += 1 } })
  assert.equal(n, 2)
})

import { acceptArsenalGame } from '../scripts/lib/pitch/arsenal-sweep.mjs'

test('arsenal: a game is owed until all three ledgers have it; the hitter pass is MLB only', () => {
  const ledgers = { arsenal: new Set(['1:mlb']), command: new Set(), hitter: new Set(['1:mlb']) }
  const g = game(1, '2026-05-01', { gameType: 'R', season: '2026' })
  assert.deepEqual(acceptArsenalGame(g, 'mlb', ledgers).need, { arsenal: false, command: true, hitter: false })
  assert.equal(acceptArsenalGame(game(2, '2026-05-01'), 'aaa', { arsenal: new Set(['2:aaa']), command: new Set(['2:aaa']), hitter: new Set() }), null)
})

import { acceptSprayGame, ledgerOf } from '../scripts/gen-spray.mjs'

test('spray: decided games of the season only, none already on file, no cancelled', () => {
  const ctx = { ingested: new Set([5]), season: 2026, today: '2026-10-15' }
  const ok = acceptSprayGame(game(1, '2026-10-14', { gameType: 'R' }), 'mlb', ctx)
  assert.deepEqual(ok, { gamePk: 1, level: 'mlb', date: '2026-10-14', post: false })
  assert.equal(acceptSprayGame(game(2, '2026-10-15'), 'mlb', ctx), null, 'never today')
  assert.equal(acceptSprayGame(game(3, '2025-09-01'), 'mlb', ctx), null, 'another season')
  assert.equal(acceptSprayGame(game(5, '2026-10-01'), 'mlb', ctx), null, 'on file')
  assert.equal(acceptSprayGame(game(4, '2026-10-01', { status: { abstractGameState: 'Final', detailedState: 'Cancelled' } }), 'aaa', ctx), null)
})

test('spray: the ledger lists failed games only when there are some', () => {
  assert.deepEqual(ledgerOf(2026, new Set([3, 1]), new Set()), { season: 2026, games: [1, 3] })
  assert.deepEqual(ledgerOf(2026, new Set([1]), new Set([9, 7])), { season: 2026, games: [1], failed: [7, 9] })
})
