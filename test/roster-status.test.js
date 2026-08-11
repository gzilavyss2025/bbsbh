import assert from 'node:assert/strict'
import test from 'node:test'
import { rosterStatusView } from '../src/api/person/identity.js'

// ---------------------------------------------------------------------------
// rosterStatusView — the "Free Agent" / "Retired" hero fact and its "Last
// Team". Fixture entries below are trimmed from the live
// https://statsapi.mlb.com/api/v1/people/669060?hydrate=...,rosterEntries
// response for Bryse Wilson, pulled 2026-08-11.
// ---------------------------------------------------------------------------

const ON_DATE = '2026-08-11'

test('an outright assignment to his own org\'s affiliate still reads as that MLB org', () => {
  // Wilson's newest ended stint is Triple-A Nashville (a Brewers affiliate,
  // parentOrgId 158) — he elected free agency the same day he was sent
  // there. The older Phillies stint underneath it must not win just because
  // Nashville itself isn't one of the 30 current MLB team ids.
  const status = rosterStatusView(
    {
      active: true,
      rosterEntries: [
        {
          team: { id: 556, name: 'Nashville Sounds', parentOrgId: 158 },
          status: { code: 'FA' },
          startDate: '2026-08-10',
          endDate: '2026-08-10',
        },
        {
          team: { id: 451, name: 'Iowa Cubs', parentOrgId: 112 },
          status: { code: 'FA' },
          startDate: '2026-07-07',
          endDate: '2026-07-07',
        },
        {
          team: { id: 143, name: 'Philadelphia Phillies' },
          status: { code: 'CL' },
          startDate: '2026-06-18',
          endDate: '2026-06-22',
        },
      ],
    },
    ON_DATE,
  )
  assert.equal(status.state, 'free-agent')
  assert.deepEqual(status.lastTeam, { id: 158, name: 'Milwaukee Brewers' })
})

test('an ended stint at a current MLB club still names that club directly', () => {
  const status = rosterStatusView(
    {
      active: true,
      rosterEntries: [
        {
          team: { id: 143, name: 'Philadelphia Phillies' },
          status: { code: 'RL' },
          startDate: '2026-06-18',
          endDate: '2026-06-22',
        },
      ],
    },
    ON_DATE,
  )
  assert.deepEqual(status.lastTeam, { id: 143, name: 'Philadelphia Phillies' })
})

test('a winter-league stint with no parent org falls through to the affiliated stint under it', () => {
  const status = rosterStatusView(
    {
      active: true,
      rosterEntries: [
        {
          // Independent winter-league club — no parentOrgId, not an MLB id.
          team: { id: 9001, name: 'Águilas Cibaeñas' },
          status: { code: 'FA' },
          startDate: '2021-01-05',
          endDate: '2021-02-01',
        },
        {
          team: { id: 143, name: 'Philadelphia Phillies' },
          status: { code: 'RL' },
          startDate: '2020-08-01',
          endDate: '2020-08-31',
        },
      ],
    },
    ON_DATE,
  )
  assert.deepEqual(status.lastTeam, { id: 143, name: 'Philadelphia Phillies' })
})

test('no ended stint resolving to any org still falls back to the most recent stint of any kind', () => {
  const status = rosterStatusView(
    {
      active: true,
      rosterEntries: [
        {
          team: { id: 9001, name: 'Águilas Cibaeñas' },
          status: { code: 'FA' },
          startDate: '2021-01-05',
          endDate: '2021-02-01',
        },
      ],
    },
    ON_DATE,
  )
  assert.deepEqual(status.lastTeam, { id: 9001, name: 'Águilas Cibaeñas' })
})
