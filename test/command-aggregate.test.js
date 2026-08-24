// Unit coverage for gen-pitch-arsenal.mjs's aggregateGameCommand — the command
// map's per-cell counting rules, driven by a synthetic feed so the exact
// behaviour is pinned without a network call.
//
// This sweep reads four more fields off playEvents the arsenal sweep is already
// holding, so the counting rules are where the whole feature can go quietly
// wrong: a missing location silently becoming middle-middle, a switch-hitter
// counted on the wrong side, a home run charged to the wrong pitch.
import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateGameCommand } from '../scripts/gen-pitch-arsenal.mjs'
import { WHIFF_CODES, FOUL_CODES } from '../src/api/playbyplay/pitchInfo.js'
import { commandCell, normalizePitch } from '../src/lib/zone/zoneGeometry.js'

const TOP = 3.4
const BOT = 1.6
// A pitch event at a location, with a call code.
const pitch = (pX, pZ, call) => ({
  isPitch: true,
  details: { type: { code: 'FF', description: 'Four-Seam Fastball' }, call: { code: call } },
  pitchData: { coordinates: { pX, pZ }, strikeZoneTop: TOP, strikeZoneBottom: BOT },
})
const play = (stand, events, eventType = 'strikeout') => ({
  matchup: { pitcher: { id: 1, fullName: 'Arm' }, batter: { id: 9 }, batSide: { code: stand } },
  result: { eventType },
  playEvents: events,
})
const feed = (plays) => ({ liveData: { plays: { allPlays: plays } } })
const at = (pX, pZ) => commandCell(normalizePitch(pX, pZ, TOP, BOT)).index
const bucket = (out, key = 'FF:R') => out.get(1).get(key)

test('every located pitch lands in exactly one cell, split by the batter\'s hand', () => {
  const out = aggregateGameCommand(feed([
    play('R', [pitch(0, 2.5, 'C'), pitch(0, 2.5, 'B')]),
    play('L', [pitch(0, 2.5, 'C')]),
  ]))
  const mid = at(0, 2.5)
  assert.equal(bucket(out, 'FF:R').cells[mid], 2)
  assert.equal(bucket(out, 'FF:L').cells[mid], 1)
  // Nothing leaks into a neighbouring cell.
  assert.equal(bucket(out, 'FF:R').cells.reduce((a, b) => a + b, 0), 2)
})

test('the hand comes from the MATCHUP, so a switch-hitter counts on the side he batted', () => {
  // Same batter id, two at-bats, two sides. Reading his listed bats instead
  // would file both against one hand and quietly halve a lefty split.
  const out = aggregateGameCommand(feed([
    play('R', [pitch(0, 2.5, 'C')]),
    play('L', [pitch(0, 2.5, 'C')]),
  ]))
  assert.equal(bucket(out, 'FF:R').cells[at(0, 2.5)], 1)
  assert.equal(bucket(out, 'FF:L').cells[at(0, 2.5)], 1)
})

test('a pitch with no tracking is dropped, never counted middle-middle', () => {
  const untracked = { isPitch: true, details: { type: { code: 'FF' }, call: { code: 'C' } }, pitchData: {} }
  const out = aggregateGameCommand(feed([play('R', [untracked, pitch(0, 2.5, 'C')])]))
  assert.equal(bucket(out).cells.reduce((a, b) => a + b, 0), 1)
})

test('outcomes are counted in the cell the pitch was thrown to', () => {
  const up = [0, 3.3]
  const low = [0, 1.7]
  const out = aggregateGameCommand(feed([
    play('R', [pitch(...up, 'S'), pitch(...low, 'C'), pitch(...up, 'F'), pitch(...low, 'X')]),
  ]))
  const b = bucket(out)
  assert.equal(b.whiffs[at(...up)], 1)          // swinging strike
  assert.equal(b.calledStrikes[at(...low)], 1)  // taken
  // A whiff is a swing; so is a foul and a ball in play. A take is not.
  assert.equal(b.swings[at(...up)], 2)          // the whiff and the foul
  assert.equal(b.swings[at(...low)], 1)         // the ball in play, not the take
  assert.equal(b.calledStrikes[at(...up)], 0)
  // The code sets this sweep names itself agree with pitchInfo.js's own.
  assert.equal(WHIFF_CODES.has('S'), true)
  assert.equal(FOUL_CODES.has('F'), true)
})

test('a home run is charged to the pitch that gave it up, not the first of the at-bat', () => {
  const first = [0, 3.3]
  const last = [0, 2.5]
  const out = aggregateGameCommand(feed([
    play('R', [pitch(...first, 'C'), pitch(...last, 'X')], 'home_run'),
  ]))
  const b = bucket(out)
  assert.equal(b.homers[at(...last)], 1)
  assert.equal(b.homers[at(...first)], 0)
  // And an at-bat that ended any other way charges nothing.
  const outK = aggregateGameCommand(feed([play('R', [pitch(...last, 'S')], 'strikeout')]))
  assert.equal(bucket(outK).homers.reduce((a, b2) => a + b2, 0), 0)
})

test('first-pitch counts only the first pitch of each at-bat', () => {
  const out = aggregateGameCommand(feed([
    play('R', [pitch(0, 2.5, 'C'), pitch(0, 2.5, 'B'), pitch(0, 2.5, 'S')]),
    play('R', [pitch(0, 2.5, 'B')]),
  ]))
  assert.equal(bucket(out).firstPitch[at(0, 2.5)], 2)
  assert.equal(bucket(out).cells[at(0, 2.5)], 4)
})

test('a play with no pitcher, or an unknown batter side, contributes nothing', () => {
  const noPitcher = { matchup: { batSide: { code: 'R' } }, playEvents: [pitch(0, 2.5, 'C')] }
  const noSide = { matchup: { pitcher: { id: 1 } }, playEvents: [pitch(0, 2.5, 'C')] }
  assert.equal(aggregateGameCommand(feed([noPitcher, noSide])).size, 0)
})
