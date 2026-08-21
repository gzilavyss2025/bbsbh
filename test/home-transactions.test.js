import assert from 'node:assert/strict'
import test from 'node:test'
import { groupLeagueWide, leagueCandidateIds } from '../src/api/transactions/league.js'
import { feedWindow, shapeLeagueFeed } from '../src/api/transactions/leagueFeed.js'

// ---------------------------------------------------------------------------
// The home slate's 48-hour roster-move card (issue #772, segment 3).
//
// Segment 2 settled what the league-wide pass returns; this covers what a
// BROWSER has to do to feed it live, which is a different problem from the
// nightly generator's. Two facts drive everything here, both measured on
// 2026-08-20 over a 30-day league-wide pull (8,184 raw rows) by
// .scratch/home-transactions/probe-card-fetch.mjs and probe-card-shape.mjs:
//
//   1. The endpoint filters on `date`; the grouper buckets by `txnDate`
//      (`effectiveDate || date`). 108 of 8,184 rows carry a different
//      effectiveDate, so a 48-hour card has to fetch WIDER than 48 hours and
//      trim afterwards. Backtested over 22 consecutive windows: a 4-day fetch
//      is the narrowest that misses nothing (3 days misses 1 story, 2 days
//      misses 12).
//   2. The `/people` call cannot start until the transactions call lands, so
//      it sets the chain's depth. Asking only about rows that survive the
//      storyworthy filter with NO debut set cuts 3,086 ids to 1,095 and
//      produces byte-identical stories — the debut set only ever SUPPRESSES,
//      so that filter is a superset of the final one.
//
// Every fixture below is verbatim from that pull.
// ---------------------------------------------------------------------------

const GUARDIANS = { id: 114, name: 'Cleveland Guardians' }
const ROCKIES = { id: 115, name: 'Colorado Rockies' }
const REDS = { id: 113, name: 'Cincinnati Reds' }
const GIANTS = { id: 137, name: 'San Francisco Giants' }
const BREWERS = { id: 158, name: 'Milwaukee Brewers' }
const COLUMBUS = { id: 445, name: 'Columbus Clippers' }
const LOUISVILLE = { id: 416, name: 'Louisville Bats' }
const SACRAMENTO = { id: 105, name: 'Sacramento River Cats' }
const BISONS = { id: 422, name: 'Buffalo Bisons' }

const MLB_TEAM_IDS = [113, 114, 115, 137, 158]
const AFFIL_TO_ORG = new Map([[445, 114], [416, 113], [105, 137]])

// Filed 2026-08-01, effective 2026-08-02. This exact row is why the fetch is
// wider than the window: a card standing on 2026-08-02 asking the endpoint
// for [08-01, 08-02] finds it, one asking for [08-02, 08-02] does not.
const PERKINS_OPTION = {
  id: 934031,
  person: { id: 663368, fullName: 'Blake Perkins' },
  fromTeam: GUARDIANS,
  toTeam: COLUMBUS,
  date: '2026-08-01',
  effectiveDate: '2026-08-02',
  typeCode: 'OPT',
  typeDesc: 'Optioned',
  description: 'Cleveland Guardians optioned CF Blake Perkins to Columbus Clippers.',
}

// The other direction — filed 2026-08-18, backdated to 2026-08-15. 78 of the
// 101 rows in this shape over a month say "retroactive", and they are almost
// all injured-list placements. The card files it under the day it took
// effect, same as the team page does, so a window ending 08-19 does not carry
// it even though the wire announced it inside those 48 hours.
const GOODMAN_RETRO_IL = {
  id: 938210,
  person: { id: 696100, fullName: 'Hunter Goodman' },
  toTeam: ROCKIES,
  date: '2026-08-18',
  effectiveDate: '2026-08-15',
  resolutionDate: '2026-08-15',
  typeCode: 'SC',
  typeDesc: 'Status Change',
  description:
    'Colorado Rockies placed C Hunter Goodman on the 10-day injured list retroactive to August 15, 2026. Left shoulder strain.',
}

const EMANUEL_OUTRIGHT = {
  id: 938627,
  person: { id: 592288, fullName: 'Kent Emanuel' },
  fromTeam: REDS,
  toTeam: LOUISVILLE,
  date: '2026-08-20',
  effectiveDate: '2026-08-20',
  typeCode: 'OUT',
  typeDesc: 'Outrighted',
  description: 'Cincinnati Reds sent LHP Kent Emanuel outright to Louisville Bats.',
}

const WILKINSON_SELECTED = {
  id: 938455,
  person: { id: 683363, fullName: 'Matt Wilkinson' },
  fromTeam: SACRAMENTO,
  toTeam: GIANTS,
  date: '2026-08-19',
  effectiveDate: '2026-08-19',
  typeCode: 'SE',
  typeDesc: 'Selected',
  description:
    'San Francisco Giants selected the contract of LHP Matt Wilkinson from Sacramento River Cats.',
}

// An anonymous minor-league signing — the family the debut set exists to
// suppress. Without that set the feed grows 45% and is nearly all of these.
const HAGEDORN_SIGNING = {
  id: 933552,
  person: { id: 844366, fullName: 'Kendall Hagedorn' },
  toTeam: BREWERS,
  date: '2026-08-19',
  effectiveDate: '2026-08-19',
  resolutionDate: '2026-08-19',
  typeCode: 'SFA',
  typeDesc: 'Signed as Free Agent',
  description: 'Milwaukee Brewers signed free agent C Kendall Hagedorn to a minor league contract.',
}

// Affiliate-to-affiliate, touching no major-league org at all — 3,883 of the
// 16,211 rows in segment 2's window looked like this.
const AFFILIATE_ONLY = {
  id: 938700,
  person: { id: 700001, fullName: 'Someone Else' },
  fromTeam: BISONS,
  toTeam: { id: 424, name: 'New Hampshire Fisher Cats' },
  date: '2026-08-19',
  effectiveDate: '2026-08-19',
  typeCode: 'ASG',
  typeDesc: 'Assigned',
  description: 'OF Someone Else assigned to New Hampshire Fisher Cats from Buffalo Bisons.',
}

const ctx = {
  mlbTeamIds: MLB_TEAM_IDS,
  affilToOrg: AFFIL_TO_ORG,
  positions: {},
  debutedIds: new Set([663368, 696100, 592288, 683363]),
}

// ---------------------------------------------------------------------------
// feedWindow — how far back to fetch, and how far back to show
// ---------------------------------------------------------------------------

test('feedWindow shows three days and fetches five', () => {
  const w = feedWindow('2026-08-20')
  assert.equal(w.endDate, '2026-08-20')
  // Three, not two. The wire carries dates and never a time
  // (docs/transactions-wire.md §1), so the window is counted in whole days —
  // and two days is "the last 48 hours" only late in the evening. Three is the
  // narrowest that clears 48 hours at every hour (it runs 48 to 72).
  assert.equal(w.windowStart, '2026-08-18')
  // Two days further back than the window, because the endpoint filters on
  // `date` and the grouper buckets by `effectiveDate`. Backtested, not derived
  // — see leagueFeed.js.
  assert.equal(w.fetchStart, '2026-08-16')
})

test('feedWindow crosses a month boundary without drifting', () => {
  const w = feedWindow('2026-09-01')
  assert.equal(w.windowStart, '2026-08-30')
  assert.equal(w.fetchStart, '2026-08-28')
})

test('the window reaches two days back, not one', () => {
  // The behaviour the widening exists for, pinned on a row that a two-day
  // window would drop: filed and effective on the 18th, read on the 20th.
  // Measured on a Friday morning, the old window showed 10 stories while the
  // day it excluded held 31.
  const twoDaysBack = { ...EMANUEL_OUTRIGHT, date: '2026-08-18', effectiveDate: '2026-08-18' }
  const days = shapeLeagueFeed([twoDaysBack], ctx, feedWindow('2026-08-20'))
  assert.equal(days.length, 1)
  assert.equal(days[0].date, '2026-08-18')
  assert.equal(days[0].stories.length, 1)

  // ...and the day before that is still out, so the window has an edge.
  const threeDaysBack = { ...EMANUEL_OUTRIGHT, date: '2026-08-17', effectiveDate: '2026-08-17' }
  assert.deepEqual(shapeLeagueFeed([threeDaysBack], ctx, feedWindow('2026-08-20')), [])
})

// ---------------------------------------------------------------------------
// shapeLeagueFeed — the trim, which is the whole reason the fetch is wider
// ---------------------------------------------------------------------------

test('a row filed before the window but effective inside it is kept', () => {
  // Blake Perkins, filed 08-01 and effective 08-02. A window ending 08-02
  // must carry him; the fetch that found him reached back to 07-29.
  const days = shapeLeagueFeed([PERKINS_OPTION], ctx, feedWindow('2026-08-02'))
  const stories = days.flatMap((d) => d.stories)
  assert.equal(stories.length, 1)
  assert.equal(days[0].date, '2026-08-02')
  assert.equal(stories[0].teamId, 114)
})

test('a row filed inside the window but effective before it is dropped', () => {
  // Hunter Goodman, filed 08-18 and backdated to 08-15. A window ending 08-19
  // fetches back to 08-15 by `date` and finds the row, and must still leave it
  // out: it belongs to 08-15, one day before the window's own start of 08-17.
  const days = shapeLeagueFeed([GOODMAN_RETRO_IL], ctx, feedWindow('2026-08-19'))
  assert.deepEqual(days, [])
})

test('the same row is kept by a window its effective date lands in', () => {
  const days = shapeLeagueFeed([GOODMAN_RETRO_IL], ctx, feedWindow('2026-08-15'))
  const stories = days.flatMap((d) => d.stories)
  assert.equal(stories.length, 1)
  assert.equal(days[0].date, '2026-08-15')
})

test('days come back newest first and every story names its club', () => {
  const days = shapeLeagueFeed(
    [EMANUEL_OUTRIGHT, WILKINSON_SELECTED],
    ctx,
    feedWindow('2026-08-20'),
  )
  assert.deepEqual(days.map((d) => d.date), ['2026-08-20', '2026-08-19'])
  for (const day of days) {
    for (const story of day.stories) {
      assert.ok(MLB_TEAM_IDS.includes(story.teamId), `story ${story.id} has no club`)
    }
  }
  assert.equal(days[0].stories[0].teamId, 113)
  assert.equal(days[1].stories[0].teamId, 137)
})

test('an affiliate-only row reaches the card as nothing at all', () => {
  const days = shapeLeagueFeed([AFFILIATE_ONLY], ctx, feedWindow('2026-08-19'))
  assert.deepEqual(days, [])
})

test('the debut set still suppresses an anonymous signing on this path', () => {
  const window = feedWindow('2026-08-19')
  assert.deepEqual(shapeLeagueFeed([HAGEDORN_SIGNING], ctx, window), [])
  // ...and it is the debut set doing it, not the window.
  const without = shapeLeagueFeed([HAGEDORN_SIGNING], { ...ctx, debutedIds: null }, window)
  assert.equal(without.flatMap((d) => d.stories).length, 1)
})

// ---------------------------------------------------------------------------
// leagueCandidateIds — the prefilter that keeps the /people call short
// ---------------------------------------------------------------------------

test('leagueCandidateIds asks only about rows that could become a story', () => {
  const rows = [EMANUEL_OUTRIGHT, WILKINSON_SELECTED, AFFILIATE_ONLY]
  const ids = leagueCandidateIds(rows, { mlbTeamIds: MLB_TEAM_IDS, affilToOrg: AFFIL_TO_ORG })
  assert.deepEqual([...ids].sort((a, b) => a - b), [592288, 683363])
})

test('leagueCandidateIds runs without a debut set and covers the one built with it', () => {
  // The property the two-pass fetch rests on: the debut set only ever
  // suppresses, so the id list gathered WITHOUT it must cover every player the
  // final stories name. Measured over a 30-day pull: 1,095 ids instead of
  // 3,086, and byte-identical stories.
  const rows = [
    EMANUEL_OUTRIGHT,
    WILKINSON_SELECTED,
    HAGEDORN_SIGNING,
    PERKINS_OPTION,
    AFFILIATE_ONLY,
  ]
  const candidates = leagueCandidateIds(rows, {
    mlbTeamIds: MLB_TEAM_IDS,
    affilToOrg: AFFIL_TO_ORG,
  })
  const named = new Set()
  for (const day of groupLeagueWide(rows, ctx)) {
    for (const story of day.stories) {
      for (const slot of story.rail) if (slot.playerId != null) named.add(slot.playerId)
    }
  }
  assert.ok(named.size > 0, 'fixture built no stories at all')
  for (const id of named) {
    assert.ok(candidates.has(id), `story names ${id}, which the /people call never asked about`)
  }
})

test('leagueCandidateIds returns a Set, so a caller can batch it directly', () => {
  const ids = leagueCandidateIds([EMANUEL_OUTRIGHT], {
    mlbTeamIds: MLB_TEAM_IDS,
    affilToOrg: AFFIL_TO_ORG,
  })
  assert.ok(ids instanceof Set)
  assert.equal(leagueCandidateIds([], {}).size, 0)
  assert.equal(leagueCandidateIds(null, {}).size, 0)
})
