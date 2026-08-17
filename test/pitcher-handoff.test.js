// Unit coverage for the pitching-handoff derivations in src/api/pitchers.js
// (pitcherHandoffs, pitcherLineAt, isLastHalfOfGame, handoffsResolvingAt,
// halfClosingPitcher) —
// the departing pitcher's line frozen at the moment he's pulled, and the
// resolution tracking that decides WHEN his settled line may show and WHERE
// (in-feed vs. a leading card on the team's next defensive half). Hand-built
// minimal feeds, same idiom as reveal-only.test.js's mini-game.js — small
// enough that one assertion pins one behavior, field-path fidelity is the
// point (verified against real gamePk shapes in src/api/pitchers.js itself).
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  pitcherHandoffs,
  pitcherLineAt,
  isLastHalfOfGame,
  handoffsResolvingAt,
  halfClosingPitcher,
} from '../src/api/pitchers.js'
import { halfIndex } from '../src/api/select.js'

function play({ inning, half, pitcherId, atBatIndex, outs, events = [], runners = [] }) {
  return {
    about: { inning, halfInning: half, atBatIndex },
    matchup: { pitcher: { id: pitcherId } },
    result: { type: 'atBat', eventType: 'field_out' },
    count: { outs },
    playEvents: events,
    runners,
  }
}
const pitchEvent = () => ({ isPitch: true })
const subEvent = (incomingId) => ({ details: { eventType: 'pitching_substitution' }, player: { id: incomingId } })
function runnerLeg(id, start, end, { scores = false, earned = false, isOut = false, chargedTo = null } = {}) {
  return {
    details: { runner: { id }, isScoringEvent: scores, earned, responsiblePitcher: chargedTo ? { id: chargedTo } : undefined },
    movement: { start, end, isOut },
  }
}

// Minimal feed: just enough of gameData.players / boxscore.teams for
// computePitcherLines (which pitcherLineAt calls) to resolve a pitcher's
// identity and find him in his side's `pitchers` list. Runner ids never need
// a player record — none of this code reads runner identity.
function makeFeed(plays, { homePitcherIds = [], awayPitcherIds = [] } = {}) {
  const players = {}
  const boxPitcher = (id, jersey) => {
    players[`ID${id}`] = { id, lastName: `P${id}`, firstName: `F${id}`, pitchHand: { code: 'R' } }
    return { person: { id }, jerseyNumber: String(jersey), position: { abbreviation: 'P' }, stats: { pitching: {} } }
  }
  const homePlayers = {}
  homePitcherIds.forEach((id, i) => (homePlayers[`ID${id}`] = boxPitcher(id, 40 + i)))
  const awayPlayers = {}
  awayPitcherIds.forEach((id, i) => (awayPlayers[`ID${id}`] = boxPitcher(id, 50 + i)))
  return {
    gameData: { players },
    liveData: {
      boxscore: {
        teams: {
          home: { players: homePlayers, pitchers: homePitcherIds },
          away: { players: awayPlayers, pitchers: awayPitcherIds },
        },
      },
      plays: { allPlays: plays },
    },
  }
}

// ---------------------------------------------------------------- scenario A
// Mid-half resolution: home relievers 500 -> 501 in the top 5th, away
// batting. 500 leaves two runners on (90 on 2B, 91 on 1B). 501's first batter
// singles, scoring 90 (charged to 500) and advancing 91 to 2B; the next play
// picks 91 off at 3rd, resolving him too — with three more plays still left
// in the half afterward, so resolution lands MID-half, not at its end.
function scenarioA() {
  const plays = [
    play({ inning: 5, half: 'top', pitcherId: 500, atBatIndex: 10, outs: 0, events: [pitchEvent()], runners: [runnerLeg(90, null, '1B')] }),
    play({ inning: 5, half: 'top', pitcherId: 500, atBatIndex: 11, outs: 0, events: [pitchEvent()], runners: [runnerLeg(90, '1B', '2B'), runnerLeg(91, null, '1B')] }),
    play({
      inning: 5,
      half: 'top',
      pitcherId: 501,
      atBatIndex: 12,
      outs: 0,
      events: [subEvent(501), pitchEvent()],
      runners: [runnerLeg(90, '2B', 'score', { scores: true, earned: true, chargedTo: 500 }), runnerLeg(91, '1B', '2B')],
    }),
    play({ inning: 5, half: 'top', pitcherId: 501, atBatIndex: 13, outs: 1, events: [pitchEvent()], runners: [runnerLeg(91, '2B', '3B', { isOut: true })] }),
    play({ inning: 5, half: 'top', pitcherId: 501, atBatIndex: 14, outs: 2, events: [pitchEvent()] }),
    play({ inning: 5, half: 'top', pitcherId: 501, atBatIndex: 15, outs: 3, events: [pitchEvent()] }),
  ]
  return makeFeed(plays, { homePitcherIds: [500, 501] })
}

test('pitcherHandoffs finds the mid-half change, its inherited runners, and where they resolve', () => {
  const feed = scenarioA()
  const handoffs = pitcherHandoffs(feed, 5, 'top', 'away')
  assert.equal(handoffs.length, 1)
  const h = handoffs[0]
  assert.equal(h.departingPitcherId, 500)
  assert.equal(h.incomingPitcherId, 501)
  assert.equal(h.side, 'home')
  assert.equal(h.snapshotAtBatIndex, 11) // the play right before the change
  assert.equal(h.inheritedCount, 2) // 90 and 91, both on base at the moment he left
  assert.equal(h.resolutionAtBatIndex, 13) // both runners' fates known: 90 scored@12, 91 out@13
  assert.equal(h.resolvedAtHalfEnd, false) // the half continues three more plays afterward
})

test('the departure snapshot excludes a run that scores off an inherited runner later', () => {
  const feed = scenarioA()
  const h = pitcherHandoffs(feed, 5, 'top', 'away')[0]
  const snapshot = pitcherLineAt(feed, h.side, h.departingPitcherId, h.snapshotAtBatIndex, halfIndex(5, 'top'))
  assert.equal(snapshot.r, 0)
  assert.equal(snapshot.er, 0)
})

test('a pitcher\'s R/ER only reach their final value once the exact resolving play is within the cut — never earlier', () => {
  const feed = scenarioA()
  const h = pitcherHandoffs(feed, 5, 'top', 'away')[0]
  // Before the scoring play (atBatIndex 12) is in the cut: still 0.
  const before = pitcherLineAt(feed, h.side, h.departingPitcherId, 11, halfIndex(5, 'top'))
  assert.equal(before.r, 0)
  // The scoring play itself is what moves it — not a step earlier, not later.
  const atScore = pitcherLineAt(feed, h.side, h.departingPitcherId, 12, halfIndex(5, 'top'))
  assert.equal(atScore.r, 1)
  assert.equal(atScore.er, 1)
  // The finalized card's own cut (resolutionAtBatIndex, once every inherited
  // runner is individually settled) agrees — no further change waits for it.
  const finalLine = pitcherLineAt(feed, h.side, h.departingPitcherId, h.resolutionAtBatIndex, halfIndex(5, 'top'))
  assert.equal(finalLine.r, 1)
  assert.equal(finalLine.er, 1)
})

test('a mid-half resolution is picked up by PlayByPlay\'s in-feed pass at the exact resolving play', () => {
  const feed = scenarioA()
  const handoffs = pitcherHandoffs(feed, 5, 'top', 'away')
  const renderedFinal = new Set()
  // Not yet — the resolving play (13) hasn't been reached.
  assert.deepEqual(handoffsResolvingAt(handoffs, 12, renderedFinal, false), [])
  // Now — and it renders exactly once even if checked again.
  const matches = handoffsResolvingAt(handoffs, 13, renderedFinal, false)
  assert.equal(matches.length, 1)
  assert.equal(handoffsResolvingAt(handoffs, 13, renderedFinal, false).length, 0)
})

// ---------------------------------------------------------------- scenario B
// Bases empty: home reliever 600 -> 601 with nobody on. The book is already
// closed at the moment he leaves — nothing to defer, nothing to wait for.
test('a bases-empty substitution resolves immediately, inheritedCount 0, not deferred', () => {
  const plays = [
    play({ inning: 3, half: 'bottom', pitcherId: 600, atBatIndex: 0, outs: 1, events: [pitchEvent()] }),
    play({ inning: 3, half: 'bottom', pitcherId: 601, atBatIndex: 1, outs: 2, events: [subEvent(601), pitchEvent()] }),
    play({ inning: 3, half: 'bottom', pitcherId: 601, atBatIndex: 2, outs: 3, events: [pitchEvent()] }),
  ]
  const feed = makeFeed(plays, { awayPitcherIds: [600, 601] })
  const h = pitcherHandoffs(feed, 3, 'bottom', 'home')[0]
  assert.equal(h.inheritedCount, 0)
  assert.equal(h.resolutionAtBatIndex, h.snapshotAtBatIndex)
  assert.equal(h.resolvedAtHalfEnd, false)
})

// ---------------------------------------------------------------- scenario C
// The Patrick/Ashby shape: away reliever 700 -> 701 in the bottom 8th with 1
// out and a runner on. 701 records the final two outs; the runner is simply
// left on base when the half ends — resolution coincides with the half's own
// last play, so this must be deferred to the team's NEXT defensive half
// (bottom 9th's leading card), never appended in-feed here.
function scenarioC() {
  const plays = [
    play({ inning: 8, half: 'bottom', pitcherId: 700, atBatIndex: 0, outs: 1, events: [pitchEvent()], runners: [runnerLeg(95, null, '1B')] }),
    play({ inning: 8, half: 'bottom', pitcherId: 701, atBatIndex: 1, outs: 2, events: [subEvent(701), pitchEvent()] }),
    play({ inning: 8, half: 'bottom', pitcherId: 701, atBatIndex: 2, outs: 3, events: [pitchEvent()] }),
  ]
  return makeFeed(plays, { awayPitcherIds: [700, 701] })
}

test('a runner still on base when the half ends resolves as stranded, at the half\'s own last play', () => {
  const feed = scenarioC()
  const h = pitcherHandoffs(feed, 8, 'bottom', 'home')[0]
  assert.equal(h.inheritedCount, 1)
  assert.equal(h.resolutionAtBatIndex, 2) // the half's own last play
  assert.equal(h.resolvedAtHalfEnd, true)
  const line = pitcherLineAt(feed, h.side, h.departingPitcherId, h.resolutionAtBatIndex, halfIndex(8, 'bottom'))
  assert.equal(line.r, 0) // left on base, never scored
})

test('a resolvedAtHalfEnd handoff never renders in-feed unless this is the game\'s last half', () => {
  const feed = scenarioC()
  const h = pitcherHandoffs(feed, 8, 'bottom', 'home')[0]
  // A later half exists (the team's own bottom 9th) to carry the leading card.
  assert.deepEqual(handoffsResolvingAt([h], h.resolutionAtBatIndex, new Set(), false), [])
  // No later half exists at all — the in-feed fallback picks it up instead.
  assert.equal(handoffsResolvingAt([h], h.resolutionAtBatIndex, new Set(), true).length, 1)
})

test('halfClosingPitcher names whoever threw the half\'s own last play — the Patrick/Ashby shape', () => {
  // scenarioC's half is closed out by Ashby (701), a completely ordinary
  // pitcher who was never subbed OUT himself — distinct from Patrick (700),
  // who pitcherHandoffs already reports as a deferred departure. Both get
  // their own finalized card at the top of the team's next defensive half
  // (HalfInning.jsx combines the two), unless the closer continues into it.
  const feed = scenarioC()
  const closer = halfClosingPitcher(feed, 8, 'bottom', 'home')
  assert.equal(closer.pitcherId, 701)
  assert.equal(closer.side, 'away') // away pitches the bottom half
  assert.equal(closer.lastAtBatIndex, 2)
  assert.notEqual(closer.pitcherId, pitcherHandoffs(feed, 8, 'bottom', 'home')[0].departingPitcherId)
})

test('isLastHalfOfGame is true only when no play exists for a later inning', () => {
  const feed = scenarioC()
  assert.equal(isLastHalfOfGame(feed, 8, 'bottom'), true)
  // Add one play in a later inning — the same half is no longer the game's last.
  feed.liveData.plays.allPlays.push(play({ inning: 9, half: 'top', pitcherId: 701, atBatIndex: 3, outs: 0, events: [pitchEvent()] }))
  assert.equal(isLastHalfOfGame(feed, 8, 'bottom'), false)
})

test('the half\'s very first, pre-pitch pitching change is not a handoff', () => {
  // Same shape recorded in halfInningFeed.js's own anyPitchInHalf guard — a
  // change nested ahead of this half's first pitch is the half's STARTING
  // arm (selectHalfStartingPitcher/HalfInning's persistent header), not a
  // mid-half handoff.
  const plays = [
    play({ inning: 4, half: 'top', pitcherId: 801, atBatIndex: 0, outs: 0, events: [subEvent(801), pitchEvent()] }),
  ]
  const feed = makeFeed(plays, { homePitcherIds: [801] })
  assert.deepEqual(pitcherHandoffs(feed, 4, 'top', 'away'), [])
})
