// A substitution is its own step (Gary, 2026-10-28): a pitching change, a defensive change, a pinch
// hitter or a pinch runner shows on its own sub-step of the at-bat it leads, and the hidden engine's
// cap (band, Pitcher rail, Due up, stage) follows that sub-step. Before, the trailing sweep
// (nextStepBoundary, ADR-0016) put a between-batters change under the PREVIOUS batter's result tap,
// so the band switched pitchers a tap early and the change was shown again as the next at-bat's first
// sub-step; a mid-at-bat change waited for the at-bat's result. stepCapAt moves only the engine's
// cap; the persisted count, the scorecard's sweep and the sub-step lists are unchanged.
//
// 824716 top 4th ab35 (read off the live feed, 2026-10-26): a mound visit, then a pitching change,
// both before the first pitch, so both trail ab34's step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { openAtBat } from '../src/api/gameday/subSteps.js'
import { computeHalfInningFeed, deriveLiveState, nextStepBoundary } from '../src/api/playbyplay.js'
import { openingChangeHeld, stepCapAt } from '../src/screens/gameday/next/steps/subStep.js'
import { selectMoundPitcher } from '../src/api/select.js'

const load = () => JSON.parse(readFileSync(new URL('./fixtures/game-824716.gameday.json', import.meta.url), 'utf8'))

// The stored count whose open at-bat is `atBatIndex`: walk the step boundaries the app stores
// (PlayByPlay's nextCap, nextStepBoundary) until one opens it.
const countFor = (feed, inning, half, atBatIndex) => {
  const raw = computeHalfInningFeed(feed, inning, half, 'away', 0)
  for (let c = nextStepBoundary(raw, 0); c < raw.length; c = nextStepBoundary(raw, c)) {
    if (openAtBat(feed, inning, half, c)?.card.atBatIndex === atBatIndex) return c
  }
  throw Error(`no count opens ab${atBatIndex}`)
}
const entriesAt = (feed, cap) => computeHalfInningFeed(feed, 4, 'top', 'away', cap).slice(0, cap)
const reliever = (feed, cap) => deriveLiveState(entriesAt(feed, cap), cap)?.midHalfPitcherId ?? null
const changeId = (feed, ab) => feed.liveData.plays.allPlays.find((p) => p.about.atBatIndex === ab)
  .playEvents.find((e) => e.details?.eventType === 'pitching_substitution').player.id

test('a between-batters change stays off the previous result tap until its own sub-step', () => {
  const feed = load()
  const count = countFor(feed, 4, 'top', 35)
  const o = openAtBat(feed, 4, 'top', count)
  assert.equal(o.steps[0].kind, 'change', 'the change is the at-bat\'s first sub-step')
  const before = stepCapAt(feed, 4, 'top', count, 0)
  assert.ok(before < count, 'the swept change is held back from the result tap')
  assert.equal(entriesAt(feed, count)[before].eventType, 'pitching_substitution')
  assert.notEqual(reliever(feed, before), changeId(feed, 35), 'the band still names the old pitcher')
  const on = stepCapAt(feed, 4, 'top', count, 1)
  assert.equal(on, count, 'its sub-step reveals it')
  assert.equal(reliever(feed, on), changeId(feed, 35))
})

test('a mid-at-bat change reaches the band on its own sub-step, not on the result', () => {
  const feed = load()
  const play = feed.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 35)
  // Move the change after the at-bat's second pitch: the same play, now interrupted by it.
  const ev = play.playEvents
  const at = ev.findIndex((e) => e.details?.eventType === 'pitching_substitution')
  const [change] = ev.splice(at, 1)
  const second = ev.findIndex((e, i) => e.isPitch && ev.slice(0, i).filter((x) => x.isPitch).length === 1)
  ev.splice(second + 1, 0, change)
  ev.forEach((e, i) => { e.index = i })
  const count = countFor(feed, 4, 'top', 35)
  const o = openAtBat(feed, 4, 'top', count)
  const sub = o.steps.findIndex((s) => s.kind === 'change') + 1
  assert.ok(sub > 1, 'the change follows pitches now')
  assert.equal(stepCapAt(feed, 4, 'top', count, sub - 1), count, 'before it: nothing new')
  const on = stepCapAt(feed, 4, 'top', count, sub)
  assert.ok(on > count, 'its sub-step brings the change entry under the cap')
  assert.equal(reliever(feed, on), changeId(feed, 35))
})

test('no open at-bat, or the half\'s first at-bat: the cap is the count', () => {
  const feed = load()
  assert.equal(stepCapAt(feed, 4, 'top', 0, 1), 0)
  assert.equal(stepCapAt(feed, 4, 'top', 999, 0), 999)
})

// The half's OPENING change (Nick Martinez, 849803 top 6th, live 2026-10-28): before the half's first
// pitch the rail named the new man at once, a tap before his change card. 777747 bottom 9th ab64 has
// the same shape: a defensive substitution, then the pitching change, both before the first pitch.
test('a half-opening pitching change holds the old pitcher until its own sub-step', () => {
  const feed = JSON.parse(readFileSync(new URL('./fixtures/game-777747.gameday.json', import.meta.url), 'utf8'))
  const o = openAtBat(feed, 9, 'bottom', 0)
  assert.equal(o.card.atBatIndex, 64)
  const k = o.steps.findIndex((s) => s.kind === 'change' && s.eventType === 'pitching_substitution')
  assert.equal(k, 1, 'after the defensive substitution')
  assert.equal(openingChangeHeld(feed, 9, 'bottom', 0, 0), true)
  assert.equal(openingChangeHeld(feed, 9, 'bottom', 0, k), true, 'still on the defensive substitution')
  assert.equal(openingChangeHeld(feed, 9, 'bottom', 0, k + 1), false, 'his own card')
  assert.equal(openingChangeHeld(feed, 9, 'bottom', 1, 0), false, 'the at-bat is revealed')
  const held = selectMoundPitcher(feed, 9, 'bottom', 16, { opening: false })
  const open = selectMoundPitcher(feed, 9, 'bottom', 16)
  assert.equal(open.id, feed.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 64).matchup.pitcher.id)
  assert.notEqual(held.id, open.id, 'the old man stands in until the change')
  assert.equal(held.id, feed.liveData.plays.allPlays.findLast((p) => p.about.inning === 8 && p.about.halfInning === 'bottom').matchup.pitcher.id)
})

test('a half that opens with no pitching change holds nothing', () => {
  const feed = load()
  assert.equal(openingChangeHeld(feed, 1, 'top', 0, 0), false)
})

// After the half's FIRST at-bat (849803 top 5th live: Jax's home run, then Kelly for Jax). The app
// stores count 1 for that first tap and PlayByPlay snapped it to the first step boundary, sweeping the
// change back in. 777747 top 6th has the same shape: ab36 leads off, ab37 opens with the change.
test('a change right after the half\'s first at-bat still waits for its own sub-step', () => {
  const feed = JSON.parse(readFileSync(new URL('./fixtures/game-777747.gameday.json', import.meta.url), 'utf8'))
  const raw = computeHalfInningFeed(feed, 6, 'top', 'away', 0)
  const first = raw.findIndex((e) => e.kind === 'atbat')
  const change = raw.findIndex((e) => e.eventType === 'pitching_substitution')
  assert.ok(change > first, 'the change trails the first at-bat')
  const o = openAtBat(feed, 6, 'top', 1)
  assert.equal(o.card.atBatIndex, 37)
  const k = o.steps.findIndex((s) => s.kind === 'change' && s.eventType === 'pitching_substitution') + 1
  assert.equal(stepCapAt(feed, 6, 'top', 1, k - 1), change, 'the first batter, without the change')
  assert.equal(stepCapAt(feed, 6, 'top', 1, k), nextStepBoundary(raw, 0), 'his card: the whole first step')
})
