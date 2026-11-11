import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TRANSACTION_FIELDS, shapeLeagueFeed, feedWindow } from '../src/api/transactions/leagueFeed.js'
import { leagueCandidateIds } from '../src/api/transactions/league.js'
import { bucketToOrg, dedupeTransactions, filterStoryworthy, groupIntoStories } from '../src/api/transactions/team.js'
import { SPORT_IDS } from '../src/lib/teams.js'

// #2985: the wire asks the transactions endpoint for TRANSACTION_FIELDS only.
// Shaping the trimmed rows must give exactly what the full rows give.
const fx = JSON.parse(readFileSync(new URL('./fixtures/league-transactions-2026-09-20.json', import.meta.url)))
const mlbTeamIds = Object.keys(JSON.parse(readFileSync(new URL('../src/lib/data/mlb-team-colors.json', import.meta.url)))).map(Number)
const scope = { mlbTeamIds, affilToOrg: new Map(Object.entries(fx.affilToOrg).map(([k, v]) => [Number(k), v])) }
const ctx = { ...scope, positions: fx.positions, debutedIds: new Set(fx.debutedIds) }
const window = feedWindow(fx.endDate)

// What statsapi's `fields=` does: keep a key, at any depth, only if it is named.
function project(value, keep) {
  if (Array.isArray(value)) return value.map((v) => project(v, keep))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).filter(([k]) => keep.has(k)).map(([k, v]) => [k, project(v, keep)]),
  )
}

const shape = (rows) => shapeLeagueFeed(rows, ctx, window)
const trimmed = (fields) => project({ transactions: fx.transactions }, new Set(fields)).transactions
const kept = TRANSACTION_FIELDS.split(',')

test('the trimmed rows shape to the same wire as the full rows', () => {
  const full = shape(fx.transactions)
  assert.ok(full.length > 0 && full.some((d) => d.stories.length > 0))
  assert.deepEqual(shape(trimmed(kept)), full)
  assert.deepEqual(
    [...leagueCandidateIds(trimmed(kept), scope)].sort(),
    [...leagueCandidateIds(fx.transactions, scope)].sort(),
  )
})

test('every kept field is read: dropping any one changes the wire', () => {
  const full = JSON.stringify(shape(fx.transactions))
  for (const field of kept) {
    if (field === 'transactions') continue
    const less = kept.filter((f) => f !== field)
    assert.notEqual(JSON.stringify(shape(trimmed(less))), full, `${field} looks unused`)
  }
})

// The team page's card (clubFeed.js) reads the same trimmed request, one org at a time.
test('every club card shapes the same from trimmed rows', () => {
  const club = (rows, orgId) => {
    const kept = filterStoryworthy(dedupeTransactions(bucketToOrg(rows, orgId, scope.affilToOrg)), { orgId, debutedIds: ctx.debutedIds })
    return groupIntoStories(kept, { positions: ctx.positions, orgId, debutedIds: ctx.debutedIds })
  }
  let stories = 0
  for (const orgId of mlbTeamIds) {
    const full = club(fx.transactions, orgId)
    stories += full.reduce((n, d) => n + d.stories.length, 0)
    assert.deepEqual(club(trimmed(kept), orgId), full, `org ${orgId}`)
  }
  assert.ok(stories > 0)
})

// A MiLB level's wire: its own clubs, no affiliate fold-up, no debut set (leagueFeed.js `scopeFor`).
test('the Triple-A wire shapes the same from trimmed rows', () => {
  const aaa = { mlbTeamIds: fx.aaaTeamIds, positions: fx.positions }
  const w = feedWindow(fx.endDate, SPORT_IDS.AAA)
  const full = shapeLeagueFeed(fx.transactions, aaa, w)
  assert.ok(full.some((d) => d.stories.length > 0))
  assert.deepEqual(shapeLeagueFeed(trimmed(kept), aaa, w), full)
})
