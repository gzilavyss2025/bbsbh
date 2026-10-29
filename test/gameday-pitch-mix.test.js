import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { tonightPitches, mixOf, pitchOutcome } from '../src/api/gameday/pitchMix.js'
import { pitcherDayLine } from '../src/api/gameday/dayLine.js'

const feed = JSON.parse(fs.readFileSync(new URL('./fixtures/game-777747.gameday.json', import.meta.url), 'utf8'))
const starter = feed.liveData.plays.allPlays[0].matchup.pitcher.id

test("tonight's pitches agree with his line's pitch count at every step", () => {
  for (const [inning, step] of [[1, 2], [3, null], [5, 1]]) {
    const at = { inning, half: 'top', step, revealedThrough: (inning - 1) * 2 }
    assert.equal(tonightPitches(feed, starter, at).length, pitcherDayLine(feed, starter, at).pitches)
  }
})

test('step 0 of the first half has no pitch on screen, and a half past the reach answers null', () => {
  assert.deepEqual(tonightPitches(feed, starter, { inning: 1, half: 'top', step: 0, revealedThrough: -1 }), [])
  assert.equal(tonightPitches(feed, starter, { inning: 6, half: 'top', step: null, revealedThrough: 2 }), null)
})

test('the mix counts and shares each pitch type, most thrown first', () => {
  const rows = mixOf([{ type: 'FF' }, { type: 'SL' }, { type: 'FF' }, { type: 'FF' }])
  assert.deepEqual(rows.map((r) => [r.type, r.n, r.share]), [['FF', 3, 0.75], ['SL', 1, 0.25]])
})

test('a pitch lands in one outcome bucket', () => {
  assert.equal(pitchOutcome({ call: { code: 'C' } }), 'called')
  assert.equal(pitchOutcome({ call: { code: 'S' } }), 'whiff')
  assert.equal(pitchOutcome({ call: { code: 'F' } }), 'foul')
  assert.equal(pitchOutcome({ call: { code: 'X' }, isInPlay: true }), 'inplay')
  assert.equal(pitchOutcome({ call: { code: 'B' } }), 'ball')
})

test("each pitch type's speed is the average of its timed pitches", () => {
  const rows = mixOf([{ type: 'FF', mph: 94 }, { type: 'FF', mph: 96 }, { type: 'FF', mph: null }, { type: 'CH' }])
  assert.equal(rows[0].mph, 95)
  assert.equal(rows[1].mph, null)
})

test('pitch mode: a change in the middle of the open at-bat gives the reliever only the pitches after it', () => {
  const f = structuredClone(feed)
  const play = f.liveData.plays.allPlays.find((p) => p.about.inning === 1 && p.about.halfInning === 'top')
  const pitches = play.playEvents.filter((e) => e.isPitch)
  assert.ok(pitches.length >= 3, 'the fixture at-bat has at least three pitches')
  // The starter throws two, then a reliever (a made-up id) finishes the at-bat.
  const at = play.playEvents.indexOf(pitches[1]) + 1
  play.playEvents.splice(at, 0, { isPitch: false, index: 900, details: { eventType: 'pitching_substitution' }, player: { id: 9999 } })
  play.matchup.pitcher = { id: 9999 }
  const open = { count: 0, sub: 99 }
  const reliever = tonightPitches(f, 9999, { inning: 1, half: 'top', step: 0, revealedThrough: -1, open })
  assert.equal(reliever.length, pitches.length - 2)
})
