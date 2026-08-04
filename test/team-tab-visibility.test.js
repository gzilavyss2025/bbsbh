// Coverage for hiddenTeamTabs (src/screens/team/data/shared.js) — which of the
// team hub's five tab buttons a club with a thin feed should not render, per
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

test('a normal MiLB affiliate (parent org + a real league) hides nothing', () => {
  const team = { sport: { id: 11 }, league: { id: 117 }, parentOrgId: 158 }
  assert.deepEqual(hiddenTeamTabs(team), new Set())
})

test('a MiLB team with no parent org hides the Minors tab', () => {
  const team = { sport: { id: 11 }, league: { id: 117 }, parentOrgId: null }
  assert.deepEqual(hiddenTeamTabs(team), new Set(['minors']))
})

test('a MiLB team with no league at all hides the Numbers tab', () => {
  const team = { sport: { id: 11 }, league: null, parentOrgId: 158 }
  assert.deepEqual(hiddenTeamTabs(team), new Set(['numbers']))
})

test('a MiLB team missing both hides both, and Roster/Games never hide', () => {
  const team = { sport: { id: 16 }, league: null, parentOrgId: null }
  assert.deepEqual(hiddenTeamTabs(team), new Set(['minors', 'numbers']))
})
