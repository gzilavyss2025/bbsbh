// A half-inning that was NEVER PLAYED must print `X`, not zeros — on both of
// the box score's grids.
//
// The feed's own way of saying "never batted" is a per-half entry that carries
// hits/errors/leftOnBase but NO `runs` key at all; `runs: 0` is a half that was
// played and scoreless (see selectSkippedBottomHalf's header, and gamePk 823752
// on 2026-08-08, where Milwaukee led entering the 9th and so never came up).
// Both grids tested here read the half OBJECT's existence instead, so that
// never-played bottom half printed a real-looking `0` in the line score and a
// whole row of `0/0/0/0` in the by-inning tally — four figures about an inning
// that did not happen.
//
// Only the presence of the key is ever read, never its value, which is the same
// structural footing selectSkippedBottomHalf stands on.
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectBoxscore } from '../src/api/boxscore.js'
import { computeInningDigest } from '../src/api/derive.js'

// Milwaukee (home) leads entering the 9th, so the bottom half is never played:
// its linescore entry has the other three keys and no `runs`.
const NEVER_BATTED = { hits: 0, errors: 0, leftOnBase: 0 }

function feedThrough9() {
  return {
    gameData: {
      status: { abstractGameState: 'Final' },
      teams: { away: { id: 142, name: 'Minnesota Twins' }, home: { id: 158, name: 'Milwaukee Brewers' } },
      players: {},
    },
    liveData: {
      plays: { allPlays: [] },
      boxscore: {
        info: [],
        teams: {
          away: { team: { id: 142 }, players: {}, info: [], note: [] },
          home: { team: { id: 158 }, players: {}, info: [], note: [] },
        },
      },
      linescore: {
        innings: [
          { num: 8, away: { runs: 0, hits: 0, errors: 0, leftOnBase: 0 }, home: { runs: 1, hits: 2, errors: 0, leftOnBase: 1 } },
          { num: 9, away: { runs: 0, hits: 0, errors: 0, leftOnBase: 0 }, home: NEVER_BATTED },
        ],
      },
    },
  }
}

test('the line score prints X for a bottom half that was never batted', () => {
  const box = selectBoxscore(feedThrough9())
  const ninth = box.innings.find((i) => i.num === 9)
  assert.equal(ninth.away, 0, 'the top half WAS played and was scoreless')
  assert.equal(ninth.home, 'X')
})

test('the by-inning tally carries no row at all for a half that was never batted', () => {
  const rows = computeInningDigest(feedThrough9(), {})
  const ninth = rows.filter((r) => r.inning === 9)
  assert.deepEqual(
    ninth.map((r) => r.side),
    ['away'],
    'only the top of the 9th happened, so only it gets a row',
  )
  // The 8th, played by both clubs, still gets both.
  assert.deepEqual(
    rows.filter((r) => r.inning === 8).map((r) => r.side),
    ['away', 'home'],
  )
})

test('a played-but-scoreless half is still a played half, on both grids', () => {
  const feed = feedThrough9()
  feed.liveData.linescore.innings[1].home = { runs: 0, hits: 0, errors: 0, leftOnBase: 0 }
  assert.equal(selectBoxscore(feed).innings.find((i) => i.num === 9).home, 0)
  assert.deepEqual(
    computeInningDigest(feed, {})
      .filter((r) => r.inning === 9)
      .map((r) => r.side),
    ['away', 'home'],
  )
})
