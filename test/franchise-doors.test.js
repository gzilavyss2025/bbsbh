import { test } from 'node:test'
import assert from 'node:assert/strict'
import { teamSeasonPath } from '../src/lib/route.js'
import { eraSeason } from '../src/api/franchiseHistory.js'

// #2779/#2786 review: the one builder for a club-season address, and the era an About row opens.
const now = new Date('2026-11-05T12:00:00Z')

test('teamSeasonPath: a past season is ?y=; the current season is the bare page', () => {
  assert.equal(teamSeasonPath(158, 2018, { name: 'Milwaukee Brewers', now }), '/team/milwaukee-brewers-158?y=2018')
  assert.equal(teamSeasonPath(158, 2026, { name: 'Milwaukee Brewers', now }), '/team/milwaukee-brewers-158')
})

test("teamSeasonPath: the page's own as-of season keeps its as-of date; another season does not", () => {
  assert.equal(teamSeasonPath(158, 2026, { asOf: '2026-06-01', now }), '/team/milwaukee-brewers-158?d=2026-06-01')
  assert.equal(teamSeasonPath(158, 2021, { asOf: '2026-06-01', now }), '/team/milwaukee-brewers-158?y=2021')
})

test('eraSeason: an era opens its last season; the era still running opens the live page (null)', () => {
  assert.equal(eraSeason({ from: 1970, to: 1997 }, 2025), 1997)
  assert.equal(eraSeason({ from: 2001, to: 2025 }, 2025), null)
})
