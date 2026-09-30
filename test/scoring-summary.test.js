// computeScoringSummary (src/api/boxscore/scoringSummary.js) — the box score's
// Scoring summary: every scoring play, grouped by half-inning, each with the
// man responsible, the running score and the terminal pitch's playId.
//
// The shapes below are the real feed's (gamePk 823035, MIL @ STL 2026-07-07):
// `liveData.plays.scoringPlays` is a list of indexes into `allPlays`, matched
// on `about.atBatIndex`; a run scores when a runner's `movement.end` is
// 'score'.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeScoringSummary } from '../src/api/boxscore/scoringSummary.js'

function play({ idx, inning, half = 'top', event = 'Single', desc = '', rbi = 0, batter = { id: 1, fullName: 'Bat Ter' }, scorers = [], away = 0, home = 0, playId = `p${idx}` }) {
  return {
    about: { atBatIndex: idx, inning, halfInning: half, isTopInning: half === 'top', isScoringPlay: true },
    result: { event, description: desc, rbi, awayScore: away, homeScore: home },
    matchup: { batter },
    runners: scorers.map((s) => ({
      movement: { end: 'score' },
      details: { runner: { id: s.id, fullName: s.fullName ?? `Runner ${s.id}` } },
    })),
    playEvents: [
      { isPitch: true, playId: `early${idx}` },
      { isPitch: true, playId },
      { isPitch: false },
    ],
  }
}

function makeFeed(plays, scoring) {
  return {
    gameData: {
      teams: {
        away: { id: 158, abbreviation: 'MIL' },
        home: { id: 138, abbreviation: 'STL' },
      },
    },
    liveData: {
      plays: {
        scoringPlays: scoring ?? plays.map((p) => p.about.atBatIndex),
        allPlays: [{ about: { atBatIndex: 0 }, result: {}, matchup: {}, runners: [], playEvents: [] }, ...plays],
      },
    },
  }
}

test('one group per half-inning, in game order, with the team that batted', () => {
  const feed = makeFeed([
    play({ idx: 3, inning: 2, half: 'top', event: 'Home Run', rbi: 1, scorers: [{ id: 1 }], away: 1, home: 0 }),
    play({ idx: 9, inning: 4, half: 'bottom', away: 1, home: 1, scorers: [{ id: 7 }], rbi: 1, batter: { id: 2, fullName: 'Two' } }),
    play({ idx: 11, inning: 4, half: 'bottom', away: 1, home: 2, scorers: [{ id: 8 }], rbi: 1, batter: { id: 3, fullName: 'Three' } }),
  ])
  const groups = computeScoringSummary(feed)
  assert.equal(groups.length, 2)
  assert.deepEqual(
    groups.map((g) => [g.inning, g.half, g.teamId, g.abbr, g.plays.length]),
    [[2, 'top', 158, 'MIL', 1], [4, 'bottom', 138, 'STL', 2]],
  )
  // The group carries the score AFTER its last play.
  assert.deepEqual([groups[1].awayScore, groups[1].homeScore], [1, 2])
})

test('a play reads: who, what, the feed\'s own words, the score after, the terminal pitch', () => {
  const feed = makeFeed([
    play({ idx: 5, inning: 3, event: 'Groundout', desc: 'Yelich grounds out. Pratt scores.', rbi: 1, batter: { id: 592885, fullName: 'Christian Yelich' }, scorers: [{ id: 806198 }], away: 1, home: 0 }),
  ])
  const [p] = computeScoringSummary(feed)[0].plays
  assert.equal(p.playerId, 592885)
  assert.equal(p.playerName, 'Christian Yelich')
  assert.equal(p.event, 'Groundout')
  assert.equal(p.desc, 'Yelich grounds out. Pratt scores.')
  assert.deepEqual([p.awayScore, p.homeScore], [1, 0])
  assert.equal(p.atBatIndex, 5)
  // The LAST pitch, not the first — the join key to that play's clip.
  assert.equal(p.playId, 'p5')
})

test('an RBI-less run credits the man who scored, not the batter who struck out', () => {
  const feed = makeFeed([
    play({ idx: 2, inning: 6, event: 'Strikeout', rbi: 0, batter: { id: 10, fullName: 'Whiffer' }, scorers: [{ id: 20, fullName: 'Stealer' }], away: 1, home: 0 }),
  ])
  const [p] = computeScoringSummary(feed)[0].plays
  assert.equal(p.playerId, 20)
  assert.equal(p.playerName, 'Stealer')
})

test('the batter stays the credited man when he scores with no RBI', () => {
  // An error that lets the batter come all the way around: rbi 0, batter among the scorers.
  const feed = makeFeed([
    play({ idx: 2, inning: 1, event: 'Field Error', rbi: 0, batter: { id: 10, fullName: 'Runs Home' }, scorers: [{ id: 10 }, { id: 11 }], away: 2, home: 0 }),
  ])
  assert.equal(computeScoringSummary(feed)[0].plays[0].playerId, 10)
})

test('no playId when the feed carries no pitches (the pruned past-game feed)', () => {
  const p = play({ idx: 1, inning: 1, scorers: [{ id: 1 }], rbi: 1 })
  p.playEvents = []
  assert.equal(computeScoringSummary(makeFeed([p]))[0].plays[0].playId, null)
})

test('a scoring index with no matching play is skipped, not a crash', () => {
  const feed = makeFeed([play({ idx: 4, inning: 1, rbi: 1, scorers: [{ id: 1 }] })], [4, 99])
  assert.equal(computeScoringSummary(feed)[0].plays.length, 1)
})

test('a scoreless game, or a feed with no plays, is an empty list', () => {
  assert.deepEqual(computeScoringSummary(makeFeed([], [])), [])
  assert.deepEqual(computeScoringSummary({}), [])
  assert.deepEqual(computeScoringSummary(null), [])
})
