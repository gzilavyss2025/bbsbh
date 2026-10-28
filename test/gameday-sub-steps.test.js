// Sub-steps inside one at-bat (ADR-0123; #2570 pitch mode, #2571 event taps).
// Pinned on trimmed real games (built by .scratch/gameday-engine/build-fixture.mjs;
// every play below was read off the live feed on 2026-10-26):
//  - 824716 bottom 6th ab57: *B, mound visit, S, F, *B, B, wild pitch, then the out.
//  - 816025 bottom 2nd ab14: Vázquez steals 2nd on strike three (the same-pitch fold).
//  - 823764 bottom 7th ab51: a caught stealing ends the half with Lara 1-2.
//  - 815625 bottom 10th ab74: an intentional walk (four VB entries).
//  - 823035 top 8th ab63: five changes before the first pitch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { subSteps } from '../src/api/gameday/subSteps.js'
import { caughtUpAdvance } from '../src/screens/gameday/next/steps/subStep.js'
import { visibleAtBatCards } from '../src/api/gameday/stepCut.js'

const load = (pk) =>
  JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url), 'utf8'))
const games = Object.fromEntries([824716, 816025, 823764, 815625, 823035, 778442].map((pk) => [pk, load(pk)]))

const cardAt = (feed, atBatIndex) => {
  const play = feed.liveData.plays.allPlays.find((p) => p.about.atBatIndex === atBatIndex)
  return visibleAtBatCards(feed, play.about.inning, play.about.halfInning, null).find(
    (c) => c.atBatIndex === atBatIndex,
  )
}
const shape = (steps) => steps.map((s) => `${s.kind}:${s.index}`)
const stops = (steps) => steps.filter((s) => s.stop)

test('824716 ab57: each pitch, the wild pitch, then the result; a mound visit is no step', () => {
  const steps = subSteps(games[824716], cardAt(games[824716], 57))
  assert.deepEqual(shape(steps), [
    'pitch:0', 'pitch:2', 'pitch:3', 'pitch:4', 'pitch:5', 'event:6', 'result:7',
  ])
  assert.deepEqual(steps.slice(0, 5).map((s) => s.pitch.code), ['*B', 'S', 'F', '*B', 'B'])
  assert.deepEqual(steps[0].riders.map((r) => r.eventType), ['mound_visit'])
  // The wild pitch moves Durbin 2nd to 3rd, and nothing else (decision 5).
  assert.equal(steps[5].eventType, 'wild_pitch')
  assert.deepEqual(steps[5].legs, [{ runnerId: 702332, from: '2B', to: '3B', out: false }])
  assert.deepEqual(shape(stops(steps)), ['event:6', 'result:7'])
})

test('816025 ab14: the steal on strike three is its own step, before the result', () => {
  const steps = subSteps(games[816025], cardAt(games[816025], 14))
  assert.deepEqual(shape(steps), ['pitch:0', 'pitch:1', 'pitch:2', 'event:3', 'result:3'])
  assert.equal(steps[3].eventType, 'stolen_base_2b')
  assert.equal(steps[3].playerId, 676679)
  // Only Vázquez's own legs; Fabian's strikeout stays with the result.
  assert.ok(steps[3].legs.every((l) => l.runnerId === 676679))
  assert.equal(steps[4].pitch.code, 'S')
  assert.deepEqual(shape(stops(steps)), ['event:3', 'result:3'])
})

test('823764 ab51: a caught stealing ends the half and the at-bat has no result', () => {
  const steps = subSteps(games[823764], cardAt(games[823764], 51))
  assert.deepEqual(shape(steps), [
    'change:0', 'change:1', 'change:3', 'pitch:4', 'pitch:5', 'pitch:7', 'pitch:8', 'event:8',
  ])
  assert.ok(!steps.some((s) => s.kind === 'result'))
  assert.deepEqual(steps[1].riders.map((r) => r.eventType), ['mound_visit'])
  assert.deepEqual(steps[4].riders.map((r) => r.eventType), ['batter_timeout'])
  const cs = steps.at(-1)
  assert.equal(cs.eventType, 'caught_stealing_2b')
  assert.deepEqual(cs.legs, [{ runnerId: 806198, from: '1B', to: null, out: true }])
  assert.deepEqual(shape(stops(steps)), ['change:0', 'change:1', 'change:3', 'event:8'])
})

test('815625 ab74: the intentional walk is one step, and it is the result', () => {
  const steps = subSteps(games[815625], cardAt(games[815625], 74))
  // The step's index is the LAST VB, the entry the walk's runner leg carries.
  assert.deepEqual(shape(steps), ['change:0', 'result:5'])
  assert.deepEqual(steps[0].riders.map((r) => r.eventType), ['runner_placed'])
})

test('823035 top 8th: five changes before the first pitch are five steps', () => {
  const steps = subSteps(games[823035], cardAt(games[823035], 63))
  assert.deepEqual(shape(steps), [
    'change:0', 'change:1', 'change:2', 'change:3', 'change:4', 'pitch:5', 'result:6',
  ])
  assert.deepEqual(steps.slice(0, 5).map((s) => s.eventType), [
    'defensive_switch', 'defensive_switch', 'pitching_substitution', 'defensive_switch', 'defensive_substitution',
  ])
})

test('no step before the result holds any of the result (decision 2), in five whole games', () => {
  const RESULT_KEYS = ['card', 'code', 'descSegments', 'basesAfter', 'outNumber', 'reached', 'scored', 'isOut', 'isInPlay', 'hitData']
  let checked = 0
  for (const feed of Object.values(games)) {
    for (const play of feed.liveData.plays.allPlays) {
      const card = cardAt(feed, play.about.atBatIndex)
      if (!card || card.interrupted || card.live) continue
      const steps = subSteps(feed, card)
      const r = steps.findIndex((s) => s.kind === 'result')
      assert.ok(r >= 0, `ab${card.atBatIndex} has a result`)
      const last = card.pitchDetails.at(-1)
      const batterId = play.matchup.batter.id
      for (const s of steps.slice(0, r)) {
        for (const k of RESULT_KEYS) assert.ok(!(k in s), `ab${card.atBatIndex} ${s.kind}:${s.index} carries ${k}`)
        if (s.pitch && last) assert.notEqual(s.pitch.no, last.no, `ab${card.atBatIndex} shows its last pitch early`)
        for (const l of s.legs ?? []) assert.notEqual(l.runnerId, batterId, `ab${card.atBatIndex} moves the batter early`)
      }
      assert.equal(steps[r].card, card)
      checked += 1
    }
  }
  assert.ok(checked > 300)
})

test("778442 ab51: the umpire's No Pitch (N) changes no count, so it is no step", () => {
  const steps = subSteps(games[778442], cardAt(games[778442], 51))
  assert.equal(steps.some((s) => s.call === 'N'), false)
  assert.deepEqual(steps.filter((s) => s.kind === 'pitch' || s.kind === 'result').map((s) => s.index), [0, 3, 4])
})

// Gary, 2026-10-28: following a live game pitch by pitch, the caught-up advance fetches instead of
// waiting on the minute poll. It reveals nothing (reveal: false); at-bat mode keeps "Caught up".
test('the caught-up advance refreshes in pitch mode and stays a held "Caught up" otherwise', () => {
  const reload = () => 'reloaded'
  const pitch = caughtUpAdvance(true, false, reload)
  assert.equal(pitch.label, 'Refresh')
  assert.equal(pitch.refresh, true)
  assert.equal(pitch.disabled, false)
  assert.equal(pitch.caughtUp, true)
  assert.equal(pitch.reveal, false)
  assert.equal(pitch.onClick(), 'reloaded')
  const busy = caughtUpAdvance(true, true, reload)
  assert.equal(busy.label, 'Refreshing…')
  assert.equal(busy.disabled, true)
  const atBat = caughtUpAdvance(false, false, reload)
  assert.equal(atBat.label, 'Caught up')
  assert.equal(atBat.disabled, true)
  assert.equal(caughtUpAdvance(true, false, undefined).label, 'Caught up', 'no reload: nothing to tap')
})
