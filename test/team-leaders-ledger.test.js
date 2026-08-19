// The team hub's leader ledger lists (src/api/teamLeaders.js's LEDGER_HITTING /
// LEDGER_PITCHING).
//
// computeLeaders itself is not retested here — it is the same ranking function
// the card board has always used. What is pinned is the property the ledger
// exists for and that a one-line edit to either list could silently break: the
// two blocks are BALANCED and each is PURE, so no reordering or swap can put a
// hitter under "Pitching" or leave a caller's prefix all-offence. That is the
// exact regression this replaced — the mixed six the hub used to render was
// balanced in the file and hitters-only on the page, because the Overview took
// the first three of it.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEDGER_HITTING,
  LEDGER_PITCHING,
  computeLeaders,
} from '../src/api/teamLeaders.js'

// The depth the Overview's door takes from each list.
const PREVIEW = 3

test('each ledger list is six categories of its own group', () => {
  assert.equal(LEDGER_HITTING.length, 6)
  assert.equal(LEDGER_PITCHING.length, 6)
  // A key that no longer exists in ALL_CATEGORIES maps to undefined rather
  // than throwing, so assert the descriptors resolved at all.
  for (const c of LEDGER_HITTING) assert.equal(c?.group, 'hitting')
  for (const c of LEDGER_PITCHING) assert.equal(c?.group, 'pitching')
})

test('a preview prefix of each list is still that group, and still balanced', () => {
  const hitting = LEDGER_HITTING.slice(0, PREVIEW)
  const pitching = LEDGER_PITCHING.slice(0, PREVIEW)
  assert.equal(hitting.length, PREVIEW)
  assert.equal(pitching.length, PREVIEW)
  assert.equal(hitting.length, pitching.length)
  for (const c of hitting) assert.equal(c.group, 'hitting')
  for (const c of pitching) assert.equal(c.group, 'pitching')
})

test('no category is listed twice, within a block or across the two', () => {
  const keys = [...LEDGER_HITTING, ...LEDGER_PITCHING].map((c) => c.key)
  assert.equal(new Set(keys).size, keys.length)
})

// One hitter and one pitcher, both with enough playing time to clear the
// roster-relative qualifier on a pool this small.
const POOL = [
  {
    id: 1,
    name: 'Slugger',
    teamId: 158,
    teamAbbr: 'MIL',
    position: '1B',
    hitting: {
      avg: '.302', ops: '.899', homeRuns: 22, rbi: 75, hits: 106,
      stolenBases: 4, plateAppearances: 480,
    },
    pitching: null,
  },
  {
    id: 2,
    name: 'Ace',
    teamId: 158,
    teamAbbr: 'MIL',
    position: 'P',
    hitting: null,
    pitching: {
      era: '1.75', whip: '0.75', strikeOuts: 210, wins: 13, saves: 0,
      inningsPitched: '139.0',
    },
  },
]

test('every ledger category yields exactly the leader of its own group', () => {
  for (const category of LEDGER_HITTING) {
    const [leader] = computeLeaders(POOL, category, { limit: 1 })
    assert.equal(leader?.id, 1, `${category.key} should rank the hitter`)
  }
  for (const category of LEDGER_PITCHING) {
    const [leader] = computeLeaders(POOL, category, { limit: 1 })
    // Saves is 0 for this pool's only arm, and a "most-of-a-good-thing"
    // category drops a zero rather than padding the block with it — the row
    // is absent, which is what TeamLeadersLedger filters on.
    if (category.key === 'sv') {
      assert.equal(leader, undefined)
      continue
    }
    assert.equal(leader?.id, 2, `${category.key} should rank the pitcher`)
  }
})
