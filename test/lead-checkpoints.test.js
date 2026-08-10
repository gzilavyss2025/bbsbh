import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { buildLeadHeldNote, buildLeadReversalNote } from '../src/api/callout-notes.js'
import { LEAD_CHECKPOINTS, TIED_CHECKPOINTS } from '../src/api/callout-notes/checkpoints.js'

// The lead-after-inning notes rest on one fact about baseball: leading after
// nine completed innings is not a situation, it is a win. A checkpoint there
// can only ever tally N-0, and the note built from it says nothing:
//
//   "The Brewers moved to 22-0 when leading after the 9th"
//
// Worse, it was the note EVERY road win got. A home winner's ninth is never
// completed (he does not bat), so the walk stops at the 8th and the sensible
// note survives; a road winner's ninth always is, and the 9th checkpoint —
// checked first, being the latest — took the note every time.

// A nine-inning road win: the away club leads from the 5th on, the home club
// bats in the bottom of the ninth and makes three outs.
function roadWinFeed() {
  const innings = [
    { num: 1, away: { runs: 0 }, home: { runs: 0 } },
    { num: 2, away: { runs: 0 }, home: { runs: 1 } },
    { num: 3, away: { runs: 0 }, home: { runs: 0 } },
    { num: 4, away: { runs: 1 }, home: { runs: 0 } },
    { num: 5, away: { runs: 2 }, home: { runs: 0 } },
    { num: 6, away: { runs: 0 }, home: { runs: 0 } },
    { num: 7, away: { runs: 0 }, home: { runs: 0 } },
    { num: 8, away: { runs: 1 }, home: { runs: 0 } },
    { num: 9, away: { runs: 0 }, home: { runs: 0 } },
  ]
  return {
    liveData: {
      linescore: { innings, teams: { away: { runs: 4 }, home: { runs: 1 } } },
      // Three outs in the bottom half, so this is not a walk-off — the ninth
      // counts as a completed inning.
      plays: { allPlays: [{ about: { halfInning: 'bottom', inning: 9 }, count: { outs: 3 } }] },
    },
  }
}

// Carries a 9th-inning tally on purpose: a file committed before this change
// still has one, and the note layer must have no checkpoint that can read it.
const BUNDLE = {
  away: { teamId: 1, name: 'Brewers' },
  home: { teamId: 2, name: 'Pirates' },
  teamRecords: {
    away: {
      leadAfterFull: { 6: { w: 20, l: 4 }, 7: { w: 20, l: 3 }, 8: { w: 21, l: 2 }, 9: { w: 22, l: 0 } },
      leadAfter: { 8: '21-2', 9: '22-0' },
    },
    home: {},
  },
}

test('a road win takes its lead-held note from the 8th, not the vacuous 9th', () => {
  const note = buildLeadHeldNote(roadWinFeed(), BUNDLE, { final: true, winnerSide: 'away' })
  assert.ok(note, 'expected a lead-held note')
  assert.equal(note.text, 'The Brewers moved to 22-2 when leading after the 8th')
})

test('the reversal note cannot fire at the 9th either — a club leading there won', () => {
  assert.equal(buildLeadReversalNote(roadWinFeed(), BUNDLE), null)
})

test('no checkpoint list reaches the 9th inning', () => {
  assert.ok(!LEAD_CHECKPOINTS.includes(9), 'leading after the 9th is a win, not a checkpoint')
  assert.ok(!TIED_CHECKPOINTS.includes(9), 'tied after the 9th is extra innings (ADR-0008)')
  // Latest first, so the most dramatic checkpoint wins.
  assert.deepEqual([...LEAD_CHECKPOINTS].sort((a, b) => b - a), LEAD_CHECKPOINTS)
  assert.deepEqual([...TIED_CHECKPOINTS].sort((a, b) => b - a), TIED_CHECKPOINTS)
})

test('no committed callouts bundle carries a 9th-inning lead tally', () => {
  const root = new URL('../public/data/callouts/', import.meta.url)
  const dates = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())
  assert.ok(dates.length, 'no callouts dates on file')
  for (const d of dates) {
    const dir = new URL(`${d.name}/`, root)
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const bundle = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
      for (const side of ['away', 'home']) {
        const rec = bundle.teamRecords?.[side] ?? {}
        assert.ok(!rec.leadAfterFull?.[9], `${d.name}/${f}: ${side} carries leadAfterFull[9]`)
        assert.ok(!rec.leadAfter?.[9], `${d.name}/${f}: ${side} carries leadAfter[9]`)
      }
    }
  }
})
