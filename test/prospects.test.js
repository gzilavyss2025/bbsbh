import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  prospectRankById,
  orgProspectRankById,
  prospectBadge,
  countProspectsByTeam,
  orgProspectsForTeam,
  prospectAffiliateMap,
} from '../src/api/prospects.js'

const SNAPSHOT = {
  generatedAt: '2026-08-01',
  players: [{ playerId: 111, rank: 10 }],
  orgProspects: [
    { playerId: 111, orgRank: 3, teamId: 112, team: 'Cubs' },
    { playerId: 222, orgRank: 16, teamId: 139, team: 'Rays' },
  ],
}

// --- prospectRankById / orgProspectRankById ---------------------------------

test('prospectRankById returns the Top 100 rank for a known playerId', () => {
  assert.equal(prospectRankById(SNAPSHOT.players, 111), 10)
})

test('prospectRankById returns null for an unranked player', () => {
  assert.equal(prospectRankById(SNAPSHOT.players, 999), null)
})

test('orgProspectRankById returns the farm-system rank for a known playerId', () => {
  assert.equal(orgProspectRankById(SNAPSHOT.orgProspects, 222), 16)
})

// --- prospectBadge -----------------------------------------------------------

test('prospectBadge resolves org rank + team when no currentOrgTeamId is passed', () => {
  assert.deepEqual(prospectBadge(SNAPSHOT, 222), {
    rank: null,
    orgRank: 16,
    orgTeamId: 139,
    orgTeamName: 'Rays',
  })
})

test('prospectBadge keeps the org badge when currentOrgTeamId matches the snapshot row', () => {
  assert.deepEqual(prospectBadge(SNAPSHOT, 222, 139), {
    rank: null,
    orgRank: 16,
    orgTeamId: 139,
    orgTeamName: 'Rays',
  })
})

test('prospectBadge suppresses a stale org badge when currentOrgTeamId disagrees with the snapshot row (trade since the last scrape)', () => {
  // player 222 was scraped under the Rays (139) but has since been traded —
  // his current parent org is now team 146.
  assert.deepEqual(prospectBadge(SNAPSHOT, 222, 146), {
    rank: null,
    orgRank: null,
    orgTeamId: null,
    orgTeamName: null,
  })
})

test('prospectBadge is unaffected by currentOrgTeamId for a player unranked in orgProspects', () => {
  assert.deepEqual(prospectBadge(SNAPSHOT, 999, 146), {
    rank: null,
    orgRank: null,
    orgTeamId: null,
    orgTeamName: null,
  })
})

test('prospectBadge degrades to all-null fields on a missing/empty snapshot', () => {
  assert.deepEqual(prospectBadge(null, 111, 112), {
    rank: null,
    orgRank: null,
    orgTeamId: null,
    orgTeamName: null,
  })
})

// --- countProspectsByTeam ----------------------------------------------------

test('countProspectsByTeam counts ranked players per roster', () => {
  const rosterIdsByTeam = { 112: [111, 999], 139: [222] }
  const prospectPlayerIds = new Set([111, 222])
  assert.deepEqual(countProspectsByTeam(rosterIdsByTeam, prospectPlayerIds), { 112: 1, 139: 1 })
})

// --- orgProspectsForTeam -----------------------------------------------------

test('orgProspectsForTeam filters to one org and sorts by rank', () => {
  const orgProspects = [
    { playerId: 1, orgRank: 2, teamId: 112 },
    { playerId: 2, orgRank: 1, teamId: 112 },
    { playerId: 3, orgRank: 1, teamId: 139 },
  ]
  assert.deepEqual(
    orgProspectsForTeam(orgProspects, 112).map((p) => p.playerId),
    [2, 1],
  )
})

// --- prospectAffiliateMap -----------------------------------------------------

test('prospectAffiliateMap flips team->ids into playerId->teamId', () => {
  const map = prospectAffiliateMap({ 501: [1, 2], 502: [3] })
  assert.equal(map.get(1), 501)
  assert.equal(map.get(3), 502)
  assert.equal(map.get(999), undefined)
})
