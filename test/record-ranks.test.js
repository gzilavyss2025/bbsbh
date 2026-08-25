import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rankRecords,
  rankAllLevels,
  rankClause,
  withRank,
  RANK_MIN_FIELD,
} from '../src/api/callout-notes/rank.js'
import { buildAfterInningNote, weekdayFromDate } from '../src/api/callout-notes/checkpoints.js'
import { buildDayOfWeekNotes } from '../src/api/callout-notes/heldNotes.js'
import { rankWorthPrinting } from '../src/api/callout-notes/rank.js'

// A league rank is an ADDITION to a record callout, never a replacement. Three
// things have to hold, and each of them was a way to get this wrong:
//   1. the record itself survives, whatever the rank says;
//   2. a bundle with no ranks reads exactly as it read before ranks shipped;
//   3. a mid-table rank says nothing at all, so the clause stays worth reading.

const rows = (pairs) => pairs.map(([teamId, w, l]) => ({ teamId, w, l }))

// Ten clubs, win% descending, with a tie at .500.
const FIELD = rows([
  [1, 9, 1], [2, 8, 2], [3, 7, 3], [4, 6, 4], [5, 5, 5],
  [6, 5, 5], [7, 4, 6], [8, 3, 7], [9, 2, 8], [10, 1, 9],
])

test('rankRecords ranks best-first, shares a rank on a tie, and skips past it', () => {
  const ranked = rankRecords(FIELD, 1)
  assert.equal(ranked.size, 10)
  assert.deepEqual(ranked.get(1), { r: 1, of: 10 })
  assert.deepEqual(ranked.get(5), { r: 5, of: 10, t: 1 })
  assert.deepEqual(ranked.get(6), { r: 5, of: 10, t: 1 })
  // Standard competition ranking: the tie's width is skipped, so no club is 6th.
  assert.equal(ranked.get(7).r, 7)
  assert.equal(ranked.get(10).r, 10)
})

test('rankRecords applies the sample floor to every club alike', () => {
  const thin = rows([[1, 9, 1], [2, 1, 1], [3, 2, 2]])
  const ranked = rankRecords(thin, 5)
  assert.equal(ranked.size, 1)
  assert.equal(ranked.get(1).of, 1) // the field is only who cleared the floor
  assert.equal(ranked.has(2), false)
  assert.equal(ranked.has(3), false)
})

test('rankClause names both ends of the field and stays quiet in the middle', () => {
  assert.equal(rankClause({ r: 1, of: 30 }, 1), 'the best mark in the majors')
  assert.equal(rankClause({ r: 1, of: 30, t: 1 }, 1), 'tied for the best mark in the majors')
  assert.equal(rankClause({ r: 2, of: 30 }, 1), '2nd of 30 in the majors')
  assert.equal(rankClause({ r: 30, of: 30 }, 1), 'the worst mark in the majors')
  assert.equal(rankClause({ r: 29, of: 30, t: 1 }, 1), 'tied for 29th of 30 in the majors')
  assert.equal(rankClause({ r: 14, of: 30 }, 1), null)
  // The level word follows the club's own level.
  assert.equal(rankClause({ r: 2, of: 30 }, 11), '2nd of 30 in Triple-A')
  // A field too thin to be a standing, and a level with no name, say nothing.
  assert.equal(rankClause({ r: 1, of: RANK_MIN_FIELD - 1 }, 1), null)
  assert.equal(rankClause({ r: 1, of: 30 }, 16), null)
})

test('the rank display rule holds — no "#" anywhere in a clause', () => {
  for (const r of [1, 2, 3, 28, 29, 30]) {
    for (const t of [undefined, 1]) {
      const clause = rankClause({ r, of: 30, t }, 1)
      if (clause) assert.equal(clause.includes('#'), false, clause)
    }
  }
})

test('withRank never drops the sentence it decorates', () => {
  const bundle = { sportId: 1, teamRecords: { home: { ranks: { leadAfter: { 7: { r: 2, of: 30 } } } } } }
  assert.equal(
    withRank('The Brewers are 12-3 when leading after the 7th', bundle, 'home', 'leadAfter', 7),
    'The Brewers are 12-3 when leading after the 7th — 2nd of 30 in the majors',
  )
  // Wrong checkpoint, wrong side, no ranks at all: the sentence is unchanged.
  assert.equal(
    withRank('The Brewers are 12-3 when leading after the 7th', bundle, 'home', 'leadAfter', 8),
    'The Brewers are 12-3 when leading after the 7th',
  )
  assert.equal(withRank('x', bundle, 'away', 'leadAfter', 7), 'x')
  assert.equal(withRank('x', {}, 'home', 'leadAfter', 7), 'x')
})

// The three-branch card needs ALL THREE records; a bundle written before
// trailAfterFull shipped has a hole in it, so it gets no card rather than a
// card that silently omits a branch.
test('a bundle missing the behind record builds no card at all', () => {
  const legacy = {
    sportId: 1,
    home: { name: 'Brewers' },
    teamRecords: { home: { leadAfterFull: { 7: { w: 12, l: 3 } }, tiedAfterFull: { 7: { w: 9, l: 13 } } } },
  }
  assert.equal(buildAfterInningNote(legacy, 'home', 7), null)
})

test('all three branches read on one card', () => {
  const full = {
    sportId: 1,
    home: { name: 'Brewers' },
    teamRecords: {
      home: {
        leadAfterFull: { 7: { w: 12, l: 3 } },
        tiedAfterFull: { 7: { w: 9, l: 13 } },
        trailAfterFull: { 7: { w: 4, l: 21 } },
      },
    },
  }
  assert.equal(
    buildAfterInningNote(full, 'home', 7).text,
    'After the 7th, the Brewers are 12-3 ahead, 9-13 tied, 4-21 behind',
  )
})

test('the league rank rides on the branch it ranks, not the whole card', () => {
  const ranked = {
    sportId: 1,
    home: { name: 'Brewers' },
    teamRecords: {
      home: {
        leadAfterFull: { 7: { w: 12, l: 3 } },
        tiedAfterFull: { 7: { w: 9, l: 13 } },
        trailAfterFull: { 7: { w: 4, l: 21 } },
        ranks: { leadAfter: { 7: { r: 2, of: 30 } } },
      },
    },
  }
  assert.equal(
    buildAfterInningNote(ranked, 'home', 7).text,
    'After the 7th, the Brewers are 12-3 ahead (2nd of 30 in the majors), 9-13 tied, 4-21 behind',
  )
})

test('rankAllLevels keeps each level in its own field and drops what cannot print', () => {
  // Ten MLB clubs (ids 1-10) with FIELD's win%, plus one AAA club on its own.
  const tallies = Object.fromEntries(
    FIELD.map((row) => [row.teamId, { tiedAfter: { 7: { w: row.w, l: row.l } } }]),
  )
  tallies[99] = { tiedAfter: { 7: { w: 5, l: 5 } } }
  const ranks = rankAllLevels(
    new Map([[1, FIELD.map((r) => r.teamId)], [11, [99]]]),
    (id) => tallies[id] ?? null,
    { tiedAfter: 5 },
  )
  assert.deepEqual(ranks.get(1).tiedAfter[7], { r: 1, of: 10 })
  assert.deepEqual(ranks.get(10).tiedAfter[7], { r: 10, of: 10 })
  // Mid-table ranks are dropped at write time — they could never print.
  assert.equal(ranks.has(4), false)
  assert.equal(ranks.has(5), false)
  // A field of one is below RANK_MIN_FIELD, so the AAA club carries nothing.
  assert.equal(ranks.has(99), false)
  // The standings splits are ranked nowhere — their notes are always folded.
  assert.equal(ranks.get(1).oneRun, undefined)
})

// --- the two invariants the rank must never break ------------------------------

test('rankWorthPrinting keeps only what a clause could say', () => {
  assert.equal(rankWorthPrinting({ r: 1, of: 30 }), true)
  assert.equal(rankWorthPrinting({ r: 3, of: 30 }), true)
  assert.equal(rankWorthPrinting({ r: 28, of: 30 }), true)
  assert.equal(rankWorthPrinting({ r: 4, of: 30 }), false)
  assert.equal(rankWorthPrinting({ r: 27, of: 30 }), false)
  assert.equal(rankWorthPrinting({ r: 1, of: RANK_MIN_FIELD - 1 }), false)
  assert.equal(rankWorthPrinting(null), false)
  // Every kept rank prints; every dropped one would have printed nothing.
  for (let r = 1; r <= 30; r++) {
    assert.equal(rankWorthPrinting({ r, of: 30 }), rankClause({ r, of: 30 }, 1) != null)
  }
})

test('a folded, result-aware sentence carries no rank clause', () => {
  const GAME_DATE = '2026-07-07'
  const dow = weekdayFromDate(GAME_DATE)
  const bundle = {
    sportId: 1,
    away: { name: 'Cubs' },
    home: { name: 'Brewers' },
    teamRecords: {
      home: {
        dayOfWeek: { [dow]: { w: 11, l: 1 } },
        ranks: { dayOfWeek: { [dow]: { r: 1, of: 30 } } },
      },
    },
  }
  const feed = { gameData: { datetime: { officialDate: GAME_DATE } } }

  // Entering tense: the clause is there.
  const entering = buildDayOfWeekNotes(feed, bundle, null).find((n) => n.side === 'home')
  assert.equal(entering.text, 'The Brewers are 11-1 on Tuesdays this season — the best mark in the majors')

  // Final: the sentence restates TONIGHT's record, which the rank was not
  // computed against, so it stays bare.
  const folded = buildDayOfWeekNotes(feed, bundle, { final: true, winnerSide: 'home' })
    .find((n) => n.side === 'home')
  assert.equal(folded.text.includes('—'), false)
  assert.equal(folded.text.includes('majors'), false)
})
