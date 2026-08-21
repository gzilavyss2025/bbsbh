// The player hover card's pure logic: which four stat fields a role shows
// (the user's own rule — a starter or a reliever under 5 saves leads with
// W-L, a reliever at/above 5 saves leads with SV), and the current-level /
// rehab-scoping resolver — a rehab assignment keeps the stat line pinned to
// MLB even though the player's own current club is the rehab affiliate,
// mirroring loadPlayer.js's onRehab/currentActivitySportId reasoning
// (test/career-register.test.js locks the player-page half of that same
// rule; this file locks the hover card's own, narrower resolver).
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  pitcherHoverFields,
  hitterHoverFields,
  resolveHoverIdentity,
} from '../src/api/playerHoverCard.js'

function pitchingStat(overrides = {}) {
  return {
    gamesPlayed: 60, gamesStarted: 0, wins: 4, losses: 2, saves: 0,
    inningsPitched: '58.0', earnedRuns: 17, hits: 45, baseOnBalls: 20,
    strikeOuts: 71, era: '2.64', whip: '1.12',
    ...overrides,
  }
}

test('pitcherHoverFields: a starter leads with W-L, never SV', () => {
  const stat = pitchingStat({ gamesPlayed: 24, gamesStarted: 24, saves: 0, wins: 12, losses: 5, era: '1.75', strikeOuts: 210, whip: '0.75' })
  assert.deepEqual(pitcherHoverFields(stat), [
    { k: 'W–L', v: '12–5' },
    { k: 'ERA', v: '1.75' },
    { k: 'K', v: '210' },
    { k: 'WHIP', v: '0.75' },
  ])
})

test('pitcherHoverFields: a reliever under 5 saves leads with W-L', () => {
  const stat = pitchingStat({ saves: 4, wins: 4, losses: 2 })
  const fields = pitcherHoverFields(stat)
  assert.equal(fields[0].k, 'W–L')
  assert.equal(fields[0].v, '4–2')
})

test('pitcherHoverFields: a reliever at exactly 5 saves leads with SV', () => {
  const stat = pitchingStat({ saves: 5 })
  const fields = pitcherHoverFields(stat)
  assert.equal(fields[0].k, 'SV')
  assert.equal(fields[0].v, '5')
})

test('pitcherHoverFields: a reliever well past 5 saves leads with SV', () => {
  const stat = pitchingStat({ saves: 32, era: '2.94', strikeOuts: 68, whip: '1.08' })
  assert.deepEqual(pitcherHoverFields(stat), [
    { k: 'SV', v: '32' },
    { k: 'ERA', v: '2.94' },
    { k: 'K', v: '68' },
    { k: 'WHIP', v: '1.08' },
  ])
})

test('pitcherHoverFields: null stat dashes every field, never an empty array', () => {
  assert.deepEqual(pitcherHoverFields(null), [
    { k: 'W–L', v: '—' },
    { k: 'ERA', v: '—' },
    { k: 'K', v: '—' },
    { k: 'WHIP', v: '—' },
  ])
})

test('hitterHoverFields: null stat dashes every field, never an empty array', () => {
  assert.deepEqual(hitterHoverFields(null), [
    { k: 'AVG', v: '—' },
    { k: 'HR', v: '—' },
    { k: 'RBI', v: '—' },
    { k: 'OPS', v: '—' },
  ])
})

test('hitterHoverFields: always AVG / HR / RBI / OPS, in order', () => {
  const stat = { avg: '.284', homeRuns: 22, rbi: 78, ops: '.812' }
  assert.deepEqual(hitterHoverFields(stat), [
    { k: 'AVG', v: '.284' },
    { k: 'HR', v: '22' },
    { k: 'RBI', v: '78' },
    { k: 'OPS', v: '.812' },
  ])
})

test('hitterHoverFields: a dash rate (no at-bats yet) passes through, not a zero', () => {
  const stat = { avg: '—', homeRuns: 0, rbi: 0, ops: '—' }
  const fields = hitterHoverFields(stat)
  assert.equal(fields[0].v, '—')
  assert.equal(fields[3].v, '—')
})

// --- resolveHoverIdentity ---------------------------------------------------

function person({ currentTeam, debut = '2022-04-07', rosterEntries, active = true }) {
  return {
    id: 1,
    fullName: 'Test Player',
    primaryNumber: '61',
    primaryPosition: { abbreviation: 'RP', type: 'Pitcher', code: '1' },
    pitchHand: { code: 'R' },
    batSide: { code: 'R' },
    mlbDebutDate: debut,
    active,
    currentTeam,
    rosterEntries: rosterEntries ?? [],
  }
}

const BREWERS = { id: 158, name: 'Milwaukee Brewers', sport: { id: 1 }, parentOrgId: null, parentOrgName: '' }
const NASHVILLE = { id: 4956, name: 'Nashville Sounds', sport: { id: 11 }, parentOrgId: 158, parentOrgName: 'Milwaukee Brewers' }

test('resolveHoverIdentity: a current MLB player — stats and team both MLB, no level chip', () => {
  const p = person({ currentTeam: BREWERS })
  const r = resolveHoverIdentity({ person: p, transactions: [], endDate: '2026-08-15' })
  assert.equal(r.statSportId, 1)
  assert.equal(r.onRehab, false)
  assert.equal(r.teamLevelLabel, null)
  assert.equal(r.team.id, 158)
})

test('resolveHoverIdentity: a debuted player currently demoted to AAA — current level only, not blended with his MLB line', () => {
  const p = person({ currentTeam: NASHVILLE })
  const r = resolveHoverIdentity({ person: p, transactions: [], endDate: '2026-08-15' })
  assert.equal(r.statSportId, 11)
  assert.equal(r.onRehab, false)
  assert.equal(r.teamLevelLabel, 'AAA')
  assert.equal(r.team.id, 4956)
})

test('resolveHoverIdentity: a rehab assignment pins the stat line to MLB but the crest stays the affiliate', () => {
  const p = person({ currentTeam: NASHVILLE })
  const transactions = [
    {
      typeCode: 'SC', effectiveDate: '2026-08-01',
      description: 'Milwaukee Brewers placed RHP Test Player on the 15-day injured list. Right forearm tightness.',
      toTeam: { id: 158, name: 'Milwaukee Brewers' },
    },
    {
      typeCode: 'ASG', effectiveDate: '2026-08-10',
      description: 'Milwaukee Brewers sent RHP Test Player on a rehab assignment to Nashville Sounds.',
      toTeam: { id: 4956, name: 'Nashville Sounds' },
    },
  ]
  const r = resolveHoverIdentity({ person: p, transactions, endDate: '2026-08-15' })
  assert.equal(r.statSportId, 1, 'stat line pinned to MLB despite the live club being AAA')
  assert.equal(r.onRehab, true)
  assert.equal(r.teamLevelLabel, 'AAA', 'the chip still names the level he is physically at')
  assert.equal(r.team.id, 4956, 'the crest follows his current club, not the parent org')
})

test('resolveHoverIdentity: a rehab ASG with no matching IL placement does not count as rehab', () => {
  const p = person({ currentTeam: NASHVILLE })
  const transactions = [
    {
      typeCode: 'ASG', effectiveDate: '2026-08-10',
      description: 'Milwaukee Brewers sent RHP Test Player on a rehab assignment to Nashville Sounds.',
      toTeam: { id: 4956, name: 'Nashville Sounds' },
    },
  ]
  const r = resolveHoverIdentity({ person: p, transactions, endDate: '2026-08-15' })
  assert.equal(r.onRehab, false)
  assert.equal(r.statSportId, 11)
})

test('resolveHoverIdentity: a released/retired player — the crest is nulled, not a stale club', () => {
  const p = person({
    currentTeam: BREWERS,
    active: false,
    rosterEntries: [
      { startDate: '2018-04-01', endDate: '2025-09-30', status: { code: 'RL' }, team: { id: 158 } },
    ],
  })
  const r = resolveHoverIdentity({ person: p, transactions: [], endDate: '2026-08-15' })
  assert.equal(r.team, null)
})
