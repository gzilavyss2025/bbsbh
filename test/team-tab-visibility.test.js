// Coverage for hiddenTeamTabs (src/screens/team/data/shared.js) — which of the
// team hub's six tab buttons a club with a thin feed should not render, per
// .scratch/team-page-ia/issues/08-polish-and-tests.md. Decided cheaply off the
// `team` object every tab's loadTeamIdentity already fetches, never a tab's own
// payload.
import assert from 'node:assert/strict'
import test from 'node:test'
import { hiddenTeamTabs } from '../src/screens/team/data/shared.js'

test('an MLB club never hides a tab', () => {
  const team = { sport: { id: 1 }, league: { id: 103 }, parentOrgId: null }
  assert.deepEqual(hiddenTeamTabs(team), new Set())
})

// Contracts is the one tab hidden for a reason that has nothing to do with a
// thin feed: Cot's covers the major leagues only, so every MiLB club's ledger
// would be empty. A tab that is always empty is not a tab.
test('every MiLB club hides the Contracts tab, however complete its feed', () => {
  const team = { sport: { id: 11 }, league: { id: 117 }, parentOrgId: 158 }
  assert.deepEqual(hiddenTeamTabs(team), new Set(['contracts']))
})

test('a MiLB team with no parent org hides the Minors tab', () => {
  const team = { sport: { id: 11 }, league: { id: 117 }, parentOrgId: null }
  assert.deepEqual(hiddenTeamTabs(team), new Set(['contracts', 'minors']))
})

test('a MiLB team with no league at all hides the Numbers tab', () => {
  const team = { sport: { id: 11 }, league: null, parentOrgId: 158 }
  assert.deepEqual(hiddenTeamTabs(team), new Set(['contracts', 'numbers']))
})

test('a MiLB team missing both hides both, and Roster/Games never hide', () => {
  const team = { sport: { id: 16 }, league: null, parentOrgId: null }
  assert.deepEqual(hiddenTeamTabs(team), new Set(['contracts', 'minors', 'numbers']))
})
