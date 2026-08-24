// Coverage for issue #856: scripts/gen-milb-history.mjs's LEVELS constant
// widened from [11, 12, 13, 14] (full-season AAA/AA/A+/A only) to also
// include 16 (Rookie-level ACL/FCL/DSL clubs), after investigation found the
// "skip rookie/complex/DSL noise" exclusion was unargued — a live sweep of
// every sportId-16 club 2005-2026 found real parentOrgId reassignment on only
// 5 of 147 ids (all pre-2021 Appalachian League clubs, now defunct), a LOWER
// churn rate than full-season affiliates saw across the same 2021 MiLB
// reorganization. See the generator's own header for the full argument.
//
// Two things this file pins: the generated static file actually carries
// Rookie-level coverage now (a regression here means someone reverted LEVELS
// or hand-edited the output), and the reader (src/api/milbHistory.js) surfaces
// a Rookie club's real parent-org eras exactly like it does for any other
// level — the same function, no level-specific branch.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parentOrgHistory } from '../src/api/milbHistory.js'

const dataPath = new URL('../public/data/milb-history.json', import.meta.url)
const fileText = readFileSync(dataPath, 'utf8')
const fileJson = JSON.parse(fileText)

test('milb-history.json coverage includes Rookie level (sportId 16)', () => {
  assert.ok(fileJson.coverage?.sportIds?.includes(16), 'coverage.sportIds is missing 16')
})

test('milb-history.json carries at least one Rookie-level club with real parentHistory', () => {
  const rookieWithHistory = Object.entries(fileJson.clubs).filter(
    ([, c]) => c.sportId === 16 && Array.isArray(c.parentHistory) && c.parentHistory.length > 1,
  )
  assert.ok(rookieWithHistory.length > 0, 'no sportId-16 club has a real (>1 era) parentHistory')
  // Greeneville (id 413) is one of the five known real reassignments (Astros
  // 2005-2017 -> Reds 2018) — pin its exact shape so a future regeneration
  // that silently drops or reorders eras fails loudly here.
  const greeneville = fileJson.clubs['413']
  assert.equal(greeneville.sportId, 16)
  assert.deepEqual(
    greeneville.parentHistory.map((e) => [e.years, e.parentOrgId]),
    [
      [[2005, 2017], 117], // Houston Astros
      [[2018, 2018], 113], // Cincinnati Reds
    ],
  )
})

test('every Rookie-level club in the file only carries a real era list (no length-1 noise)', () => {
  // The generator only files a club at all when its parent org OR its own
  // name changed at least once, and only records `parentHistory` when that
  // list has more than one era (see the header's nameHistory-vs-parentHistory
  // split — cosmetic name churn must never leak into what the Minors tab's
  // affiliation-history strip reads).
  for (const [id, c] of Object.entries(fileJson.clubs)) {
    if (c.sportId !== 16) continue
    if (c.parentHistory) assert.ok(c.parentHistory.length > 1, `club ${id}: parentHistory has <=1 era`)
  }
})

test('parentOrgHistory (the Minors tab affiliation-history reader) surfaces a Rookie club real history', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    assert.equal(url, '/data/milb-history.json')
    return { ok: true, status: 200, json: async () => fileJson }
  }
  try {
    const history = await parentOrgHistory(413) // Greeneville Astros -> Reds
    assert.deepEqual(
      history.map((e) => [e.years, e.parentOrgId]),
      [
        [[2005, 2017], 117],
        [[2018, 2018], 113],
      ],
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('parentOrgHistory returns [] for a Rookie club that never changed org (the common case)', async () => {
  // ACL Brewers (id 406) is a currently-active Rookie club that has belonged
  // to the Brewers for the whole tracked window — no parentHistory entry, so
  // the Minors tab's affiliation-history strip stays hidden for it, same as
  // any full-season affiliate that never switched orgs.
  const history = await parentOrgHistory(406)
  assert.deepEqual(history, [])
})
