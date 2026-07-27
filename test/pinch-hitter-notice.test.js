// A pinch hitter announced BEFORE a half's first pitch already gets a staged
// "now batting" card (HalfInning.jsx's PrePitchChanges, selectPrePitchChanges).
// A pinch hitter announced MID-INNING — after the half is already underway —
// used to get no announcement of his own at all: computeHalfInningFeed's
// STOPPAGE_EVENTS deliberately skipped `offensive_substitution` (except the
// pinch-RUNNER branch), so he showed up only as his own at-bat card (tagged
// PH), the one substitution type with no in-feed notice while a defensive
// sub, a defensive switch, a pitching change, and a pinch runner all get one.
//
// Verified rendering asymmetry against gamePk 823759 (three mid-half pinch
// hitters, no notice card for any of them) — filed at
// .scratch/pbp-scoring-review/issues/05-substitution-surface-asymmetries.md.
// This fixture is a minimal two-batter half: a leadoff single (so a pitch has
// already been thrown in the half), then a pinch hitter announced before HIS
// own first pitch.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHalfInningFeed, pinchHittingBatter } from '../src/api/playbyplay.js'

function person(id, last, first, num) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(num) }
}

const LEADOFF = 1
const REPLACED = 2
const PINCH_HITTER = 10
const PITCHER = 9

const PLAYERS = {
  ID1: person(LEADOFF, 'Ashby', 'Aaron', 1),
  ID2: person(REPLACED, 'Bell', 'Ben', 2),
  ID10: person(PINCH_HITTER, 'Judge', 'Jim', 24),
  ID9: { ...person(PITCHER, 'Flores', 'Anthony', 45), pitchHand: { code: 'L' } },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

const LEADOFF_SINGLE = {
  about: { inning: 3, halfInning: 'top', atBatIndex: 20 },
  matchup: { batter: { id: LEADOFF, fullName: 'Aaron Ashby' }, pitcher: { id: PITCHER }, batSide: { code: 'L' } },
  result: { type: 'atBat', eventType: 'single', description: 'Aaron Ashby singles.', rbi: 0 },
  count: { balls: 1, strikes: 0, outs: 0 },
  playEvents: [pitch('B', 1), pitch('D', 2)],
  runners: [
    {
      details: { runner: { id: LEADOFF, fullName: 'Aaron Ashby' }, eventType: 'single' },
      movement: { start: null, end: '1B', isOut: false },
    },
  ],
}

// The mid-inning pinch hitter, announced right before his own first pitch —
// the half is already underway (the leadoff single above threw real pitches).
const PINCH_HIT_PLAY = {
  about: { inning: 3, halfInning: 'top', atBatIndex: 21 },
  matchup: { batter: { id: PINCH_HITTER, fullName: 'Jim Judge' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
  result: { type: 'atBat', eventType: 'strikeout', description: 'Jim Judge strikes out swinging.', rbi: 0 },
  count: { balls: 0, strikes: 3, outs: 1 },
  playEvents: [
    {
      details: { eventType: 'offensive_substitution', description: 'Offensive Substitution: Pinch-hitter Jim Judge replaces Ben Bell.' },
      position: { abbreviation: 'PH' },
      player: { id: PINCH_HITTER },
      replacedPlayer: { id: REPLACED },
    },
    pitch('S', 1),
    pitch('S', 2),
    pitch('S', 3),
  ],
  runners: [
    {
      details: { runner: { id: PINCH_HITTER, fullName: 'Jim Judge' }, eventType: 'strikeout' },
      movement: { start: null, end: null, isOut: true, outNumber: 1 },
    },
  ],
}

function buildFeed() {
  return {
    gamePk: 823759,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 9, innings: [] },
      boxscore: { teams: { away: { players: {} }, home: { players: {} } } },
      plays: { allPlays: [LEADOFF_SINGLE, PINCH_HIT_PLAY] },
    },
  }
}

test('a pinch hitter announced mid-inning gets his own "now batting" notice, same as every other substitution type', () => {
  const entries = computeHalfInningFeed(buildFeed(), 3, 'top', 'away')
  assert.deepEqual(
    entries.map((e) => (e.kind === 'atbat' ? `atbat:${e.batter.last}` : `event:${e.eventType}`)),
    ['atbat:Ashby', 'event:pinch_hitting', 'atbat:Judge'],
  )
  const notice = entries[1]
  assert.equal(notice.playerId, PINCH_HITTER)
  assert.match(notice.text, /Pinch-hitter Jim Judge replaces Ben Bell/)
})

test('pinchHittingBatter resolves the notice card fields the same way the other substitution resolvers do', () => {
  const feed = buildFeed()
  const batter = pinchHittingBatter(feed, PINCH_HITTER)
  assert.deepEqual(batter, { id: PINCH_HITTER, name: 'Judge, Jim', jersey: '24' })
  assert.equal(pinchHittingBatter(feed, null), null)
})
