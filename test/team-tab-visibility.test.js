// Coverage for parentOrgIdOf and hiddenTeamSections (src/screens/team/data/shared.js) — which
// bands of the team page a club with a thin feed cannot fill. Decided cheaply off the `team`
// object loadTeamIdentity already fetches, never a band's own payload.
import assert from 'node:assert/strict'
import test from 'node:test'

// ---------------------------------------------------------------------------
// parentOrgIdOf — "who is this club's parent org?", asked once (#1143)
//
// All 30 winter-ball clubs in public/data/teams.json carry
// `parentOrgId: 11` — the Office of the Commissioner, which is not a club and
// is not in teams.json at all. `fetchTeam` therefore falls through to live
// statsapi, which answers `sport.id: 1` and a `league` object with no `id`, so
// `/team/11` renders as an MLB club with all six tabs and one card on it.
//
// Three surfaces asked the question with a bare `team.parentOrgId` read and all
// three answered wrong: the header's Affiliate chip (TeamHubShell), this
// function's Minors gate, and affiliateCardsFrom's parent card. One helper, so
// they cannot disagree.
// ---------------------------------------------------------------------------
import { parentOrgIdOf } from '../src/screens/team/data/shared.js'

const LOS_MOCHIS = {
  id: 675,
  sport: { id: 17 },
  league: { id: 132 },
  parentOrgId: 11,
  parentOrgName: 'Office of the Commissioner',
}

test('a real affiliate keeps its parent org', () => {
  assert.equal(parentOrgIdOf({ sport: { id: 11 }, parentOrgId: 158 }), 158)
  assert.equal(parentOrgIdOf({ sport: { id: 16 }, parentOrgId: 108 }), 108)
})

test('the Office of the Commissioner is not a parent org', () => {
  assert.equal(parentOrgIdOf(LOS_MOCHIS), null)
  // The id is what disqualifies it, not the level — a club at any level
  // pointing at org 11 is pointing at nothing a reader can open.
  assert.equal(parentOrgIdOf({ sport: { id: 11 }, parentOrgId: 11 }), null)
})

test('a club with no parent org at all is unchanged', () => {
  assert.equal(parentOrgIdOf({ sport: { id: 1 }, parentOrgId: null }), null)
  assert.equal(parentOrgIdOf({ sport: { id: 11 } }), null)
  assert.equal(parentOrgIdOf(null), null)
})

// ---------------------------------------------------------------------------
// hiddenTeamSections — the one-scroll page's absent bands (ADR-0082, #1107)
//
// Same rule as the tabs, at band grain: a band a club cannot fill does not
// render and has no jump-bar button. The league test comes before any sport
// test, so a league-less club of ANY sport loses Ranks.
// ---------------------------------------------------------------------------
import { hiddenTeamSections } from '../src/screens/team/data/shared.js'

test('an MLB club with a league keeps all seven bands', () => {
  assert.deepEqual(hiddenTeamSections({ sport: { id: 1 }, league: { id: 103 }, parentOrgId: null }), new Set())
})

test('an affiliate loses Money, and Farm only when it has no parent org', () => {
  assert.deepEqual(hiddenTeamSections({ sport: { id: 11 }, league: { id: 117 }, parentOrgId: 158 }), new Set(['money']))
  assert.deepEqual(
    hiddenTeamSections({ sport: { id: 11 }, league: { id: 117 }, parentOrgId: null }),
    new Set(['money', 'farm']),
  )
})

test('a winter club keeps Ranks and loses Money and Farm: five bands', () => {
  assert.deepEqual(hiddenTeamSections(LOS_MOCHIS), new Set(['money', 'farm']))
})

test('no league id loses Ranks, even on a club whose sport is MLB (#1143)', () => {
  // /team/11: sport.id 1 with a league object that carries no id. The old
  // function returned on !isMilb before it reached this test.
  assert.deepEqual(hiddenTeamSections({ sport: { id: 1 }, league: {}, parentOrgId: 11 }), new Set(['ranks']))
  assert.deepEqual(
    hiddenTeamSections({ sport: { id: 16 }, league: null, parentOrgId: null }),
    new Set(['ranks', 'money', 'farm']),
  )
})

test('Standings, Games, Roster and About are never hidden', () => {
  const worst = hiddenTeamSections({ sport: { id: 16 }, league: null, parentOrgId: null })
  for (const k of ['standings', 'games', 'roster', 'about']) assert.equal(worst.has(k), false, k)
})
