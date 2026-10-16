// The pitch-call-code vocabulary: which lane of the at-bat card's ball/strike
// ladder a code lands in, and which counters (whiffs, fouls, two-strike fouls)
// it feeds. One incomplete code set broke all of those at once.
//
// The bug this file was opened on: gamePk 823751 (2026-08-09 MIN@MIL), top 7,
// Austin Martin pinch-hits and strikes out swinging on three pitches — foul
// bunt ('L'), MISSED bunt ('M'), swinging strike ('S'). 'M' was in no set, so
// pitchDotCategory's fallback filed it as a BALL: the card drew a strikeout
// with two marks in the strike lane and one in the ball lane, a strikeout on
// two strikes.
//
// The same hole has a second cause with the identical symptom. Automatic
// strikes and balls (pitch-timer and batter-timeout violations, and the
// automatic balls of an intentional walk) move the count but carry
// `isPitch: false`, so the ladder never saw them at all — gamePk 823430, top 7:
// Brady House takes an automatic strike on the pitch timer, then strikes out on
// three pitches, again two marks for three strikes.
//
// MLB publishes the authoritative table at /api/v1/pitchCodes; PITCH_CODES
// below is that table captured verbatim so this suite stays offline. Anything
// MLB calls a strike belongs in the strike lane and anything it calls a ball in
// the ball lane — that is the invariant the fallback quietly broke.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  pitchLadder,
  pitchDotCategory,
  WHIFF_CODES,
  FOUL_CODES,
  computeHalfInningFeed,
} from '../src/api/playbyplay.js'
import { foulCountsFromCodes } from '../src/api/callout-notes.js'
import { computeDerivedByInning, revealDerived } from '../src/api/derive.js'
import { buildFeed } from './fixtures/mini-game.js'

// https://statsapi.mlb.com/api/v1/pitchCodes, captured 2026-08-10.
// [strikeStatus, ballStatus, pitchStatus] — the third is whether a pitch was
// actually THROWN, false for every automatic ball/strike and for the
// pickoff/step-off rows that reach no card at all.
const PITCH_CODES = {
  A: [true, false, false], // Strike - Automatic
  AB: [true, false, false], // Strike - Automatic (Batter Timeout Violation)
  AC: [true, false, false], // Strike - Automatic (Pitch Timer Violation)
  C: [true, false, true], // Strike - Called
  D: [true, false, true], // Hit Into Play - No Out(s)
  E: [true, false, true], // Hit Into Play - Run(s)
  F: [true, false, true], // Strike - Foul
  J: [true, false, true], // Pitchout Hit Into Play - No Out(s)
  K: [true, false, true], // Strike - Unknown
  L: [true, false, true], // Strike - Foul Bunt
  M: [true, false, true], // Strike - Missed Bunt
  O: [true, false, true], // Strike - Bunt Foul Tip
  Q: [true, false, true], // Strike - Swinging on Pitchout
  R: [true, false, true], // Strike - Foul on Pitchout
  S: [true, false, true], // Strike - Swinging
  T: [true, false, true], // Strike - Foul Tip
  W: [true, false, true], // Strike - Swinging Blocked
  X: [true, false, true], // Hit Into Play - Out(s)
  Y: [true, false, true], // Pitchout Hit Into Play - Out(s)
  Z: [true, false, true], // Pitchout Hit Into Play - Run(s)
  '*B': [false, true, true], // Ball - Ball In Dirt
  B: [false, true, true], // Ball - Called
  H: [false, true, true], // Ball - Hit by Pitch
  I: [false, true, true], // Ball - Intentional
  P: [false, true, true], // Ball - Pitchout
  V: [false, true, false], // Ball - Automatic
  VB: [false, true, false], // Ball - Automatic (IBB)
  VC: [false, true, false], // Ball - Automatic (Pitch Timer Violation - Catcher)
  VP: [false, true, false], // Ball - Automatic (Pitch Timer Violation - Pitcher)
  VS: [false, true, false], // Ball - Automatic (Shift Violation)
  '+1': [false, false, false], // Pickoff Throw 1st - Catcher
  '+2': [false, false, false], // Pickoff Throw 2nd - Catcher
  '+3': [false, false, false], // Pickoff Throw 3rd - Catcher
  '.': [false, false, false], // Non Pitch
  1: [false, false, false], // Pickoff Throw 1st - Pitcher
  2: [false, false, false], // Pickoff Throw 2nd - Pitcher
  3: [false, false, false], // Pickoff Throw 3rd - Pitcher
  N: [false, false, false], // No Pitch
  PSO: [false, false, false], // Pitcher Step Off
}

// --- the invariant: every code lands on the side MLB says it does -----------

test('every MLB strike code takes a strike-lane mark, every ball code a ball-lane one', () => {
  for (const [code, [isStrike, isBall]] of Object.entries(PITCH_CODES)) {
    if (!isStrike && !isBall) continue // pickoffs and step-offs: no mark at all
    const side = isStrike ? 'strike' : 'ball'
    assert.equal(pitchLadder([code])[0].side, side, `${code} belongs in the ${side} lane`)
  }
})

test('a ball put in play is marked X, whatever kind of pitch it came on', () => {
  // Including the three PITCHOUT-in-play codes, which fell to the ball lane.
  for (const code of ['D', 'X', 'E', 'Y', 'J', 'Z']) {
    assert.deepEqual(pitchLadder([code]), [{ side: 'strike', label: 'X' }], code)
  }
})

test('the five dot categories cover every thrown pitch code', () => {
  const seen = new Set()
  for (const [code, [, , thrown]] of Object.entries(PITCH_CODES)) {
    if (thrown) seen.add(pitchDotCategory(code))
  }
  // 'ball' is a real category (B, *B, H, I, P) and not the fallback swallowing
  // strikes, so the other four must all be reached as well.
  assert.deepEqual([...seen].sort(), ['ball', 'called', 'foul', 'inplay', 'whiff'])
})

// --- the reported bug: a strikeout that drew two strikes ---------------------

test('a missed bunt is a strike, not a ball (gamePk 823751, Austin Martin)', () => {
  assert.deepEqual(pitchLadder(['L', 'M', 'S']), [
    { side: 'strike', label: '1' },
    { side: 'strike', label: '2' },
    { side: 'strike', label: '3' },
  ])
})

test('a missed bunt counts as a whiff, a bunt foul tip as a foul', () => {
  assert.ok(WHIFF_CODES.has('M'), 'missed bunt: he swung and missed')
  assert.ok(WHIFF_CODES.has('Q'), 'swinging strike on a pitchout: he swung and missed')
  assert.ok(FOUL_CODES.has('O'), 'bunt foul tip')
  assert.ok(FOUL_CODES.has('R'), 'foul on a pitchout')
})

// --- the same symptom, the other cause: automatic ball and strike calls ------

test('an automatic strike takes a strike-lane mark (gamePk 823430, Brady House)', () => {
  // Pitch-timer violation on the batter, then called strike, ball, swinging
  // strike: a three-pitch strikeout that needs THREE strike marks.
  assert.deepEqual(pitchLadder(['AC', 'C', 'B', 'S']), [
    { side: 'strike', label: 'A' },
    { side: 'strike', label: '1' },
    { side: 'ball', label: '2' },
    { side: 'strike', label: '3' },
  ])
})

test('an automatic call does not spend a pitch number', () => {
  // The lane numbers are the at-bat's pitch numbers — the same ones the strike
  // zone plots — and MLB spends none of them on an automatic call. gamePk
  // 824481, Dane Myers: called strike, foul, automatic ball on the pitcher's
  // timer, foul tip for strike three.
  assert.deepEqual(pitchLadder(['C', 'F', 'VP', 'T']), [
    { side: 'strike', label: '1' },
    { side: 'strike', label: '2' },
    { side: 'ball', label: 'A' },
    { side: 'strike', label: '3' },
  ])
})

test('an intentional walk shows all four balls (gamePk 823517, Alec Burleson)', () => {
  // Two pitches, then the walk is called: the count still went to 4-0.
  assert.deepEqual(pitchLadder(['B', 'B', 'VB', 'VB']), [
    { side: 'ball', label: '1' },
    { side: 'ball', label: '2' },
    { side: 'ball', label: 'A' },
    { side: 'ball', label: 'A' },
  ])
})

test('an at-bat card carries automatic calls in its ladder, not in its pitch list', () => {
  // A THROWN pitch is what the strike-zone plot and the numbered pitch list are
  // about (type, velo, location); an automatic call has none of those and takes
  // no row there. The ladder, which is the count, does show it.
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays[0] // top 1, Ashby: C, S, S
  play.playEvents.splice(1, 0, {
    isPitch: false,
    pitchNumber: 1,
    details: { call: { code: 'AC' }, description: 'Automatic Strike - Batter Pitch Timer Violation' },
  })
  const card = computeHalfInningFeed(feed, 1, 'top', 'away').find((e) => e.kind === 'atbat')
  assert.deepEqual(card.pitches, ['C', 'AC', 'S', 'S'])
  assert.deepEqual(
    card.pitchDetails.map((p) => p.code),
    ['C', 'S', 'S'],
  )
  assert.deepEqual(
    pitchLadder(card.pitches).map((m) => m.label),
    ['1', 'A', '2', '3'],
  )
})

// --- the counters those same sets feed --------------------------------------

test('a two-strike foul BUNT ends the at-bat, so it extends nothing', () => {
  // Rule 5.09(a)(4): bunt it foul with two strikes and you are out, the same
  // reason a two-strike foul TIP is already excluded. gamePk 823515, José
  // Caballero, "strikes out on a foul bunt".
  assert.deepEqual(foulCountsFromCodes(['C', 'S', 'L']), { fouls: 1, twoStrikeFouls: 0 })
  assert.deepEqual(foulCountsFromCodes(['C', 'S', 'O']), { fouls: 1, twoStrikeFouls: 0 })
  // A foul bunt BEFORE two strikes is an ordinary foul and stays one.
  assert.deepEqual(foulCountsFromCodes(['L', 'F', 'F']), { fouls: 3, twoStrikeFouls: 1 })
})

test('the at-bat foul simulation counts every kind of strike', () => {
  // Called strike, missed bunt for strike two, then a foul at two strikes.
  assert.deepEqual(foulCountsFromCodes(['C', 'M', 'F']), { fouls: 1, twoStrikeFouls: 1 })
  // Automatic strike, swinging strike on a pitchout, foul at two strikes.
  assert.deepEqual(foulCountsFromCodes(['AC', 'Q', 'F']), { fouls: 1, twoStrikeFouls: 1 })
})

test('the derived Whiffs total counts a missed bunt', () => {
  const feed = buildFeed()
  // Top 1 is C,S,S / X / X / C,S,S — four whiffs. Make Ashby's second pitch a
  // missed bunt: still a swing and a miss, so the total holds.
  feed.liveData.plays.allPlays[0].playEvents[1].details.call.code = 'M'
  assert.equal(revealDerived(computeDerivedByInning(feed), 1, 'top').whiffs, 4)
})
