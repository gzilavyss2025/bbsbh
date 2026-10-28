import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { checkpointPhase, dismissCheckpoint, emptyCheckpointGate, recordCheckpoint } from '../src/screens/gameday/next/cutscene/integration/checkpointGate.js'
import { GamedayStage } from '../src/screens/gameday/next/stage/GamedayStage.js'
import { wallFn } from '../src/screens/gameday/next/stage/scene.js'

test('a qualifying ending play holds until Next, including after its animation finishes', () => {
  const gate = recordCheckpoint(emptyCheckpointGate(), 'game:half:77', true)
  assert.equal(checkpointPhase(true, gate.key, gate), 'celebration')
  assert.equal(checkpointPhase(true, gate.key, gate), 'celebration', 'no clock or playing flag can advance the presentation')
  assert.equal(checkpointPhase(true, gate.key, dismissCheckpoint(gate)), 'checkpoint', 'one Next dismisses into the checkpoint')
  assert.equal(checkpointPhase(false, gate.key, gate), 'stage')
})

test('polls preserve dismissal; another result must make its own decision', () => {
  const shown = recordCheckpoint(emptyCheckpointGate(), 'game:half:77', true)
  const dismissed = dismissCheckpoint(shown)
  assert.equal(recordCheckpoint(dismissed, shown.key, true), dismissed)
  assert.equal(checkpointPhase(true, 'game:next:90', dismissed), 'pending')
  assert.equal(checkpointPhase(true, null, shown), 'checkpoint', 'cold/return visit does not replay')
  assert.equal(checkpointPhase(true, shown.key, emptyCheckpointGate()), 'pending', 'a fresh reveal resets the decision even for a previously scored key')
  assert.equal(checkpointPhase(true, shown.key, shown, true), 'pending', 'wait for the result armed by this tap, not an older celebration')
  const ordinary = recordCheckpoint(shown, 'game:half:78', false)
  assert.equal(checkpointPhase(true, ordinary.key, ordinary), 'checkpoint')
})

const feedOf = (pk) => JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url)))
const checkpoint = h('b', { 'data-checkpoint': true }, 'Inning summary')
const StageCanvas = ({ celebration, checkpointHeld, playing }) => h('i', { 'data-scene': celebration?.scene ?? '', 'data-held': !!checkpointHeld, 'data-playing': !!playing })
const html = (feed, play, extra = {}) => renderToStaticMarkup(h(GamedayStage, {
  SealBox: ({ children }) => children(), StageCanvas, feed, checkpoint,
  inning: play.about.inning, half: play.about.halfInning,
  wall: wallFn(null), shown: play.about.atBatIndex, playing: true, ...extra,
}))

test('the walk-off grand slam appears before the game-end checkpoint and persists at its final pose', () => {
  const f = feedOf(777747), p = f.liveData.plays.allPlays.find((p) => p.result.eventType === 'home_run' && p.result.rbi === 4)
  assert.match(html(f, p), /data-scene="grandSlam" data-held="true"/)
  assert.doesNotMatch(html(f, p, { playing: false }), /data-checkpoint/)
  assert.match(html(f, p, { checkpointDismissed: true, playing: false }), /data-checkpoint="true"/)
})

test('the third-out hard-hit catch appears before the checkpoint; Next releases it', () => {
  const f = feedOf(815625), p = f.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 102)
  assert.equal(p.count.outs, 3)
  assert.match(html(f, p), /data-scene="catch" data-held="true"/)
  assert.match(html(f, p, { checkpointDismissed: true }), /data-checkpoint/)
})

test('ordinary ending plays, old results and cold checkpoint visits do not get an extra hold', () => {
  const f = feedOf(824716), ps = f.liveData.plays.allPlays
  const final = ps.find((p) => p.about.inning === 1 && p.about.halfInning === 'top' && p.count.outs === 3)
  assert.match(html(f, final), /data-checkpoint/)
  const earlierHomer = ps.find((p) => p.about.inning === 1 && p.about.halfInning === 'top' && p.result.eventType === 'home_run')
  assert.match(html(f, earlierHomer), /data-checkpoint/, 'never hold an older result while the engine reports the new last play')
  assert.match(html(f, final, { shown: null }), /data-checkpoint/)
  assert.match(html(f, final, { shown: { count: 5, sub: 2, last: 1 } }), /data-checkpoint/, 'an interrupted at-bat is not its future result')
})

// Review of the #2676 stack: a half end with no celebration first renders the checkpoint from
// Played (inside the SealBox) while the gate is pending. Once Next dismisses it, the checkpoint must
// stay at that position. If GamedayStage returned it from the top instead, React would remount it
// and the summary's fetches and ledger marks would run twice.
test('the checkpoint keeps one position in the tree from pending to dismissed', () => {
  const f = feedOf(824716)
  const final = f.liveData.plays.allPlays.find((p) => p.about.inning === 1 && p.about.halfInning === 'top' && p.count.outs === 3)
  const sealed = (extra) => renderToStaticMarkup(h(GamedayStage, {
    SealBox: ({ children }) => h('s', null, children()), StageCanvas, feed: f, checkpoint,
    inning: 1, half: 'top', wall: wallFn(null), shown: final.about.atBatIndex, playing: true, ...extra,
  }))
  assert.match(sealed({}), /<s><b data-checkpoint/)
  assert.match(sealed({ checkpointDismissed: true }), /<s><b data-checkpoint/)
})

// Gary, 2026-10-28: a finished celebration offers Replay; a held ending scene leaves Next in charge.
test('a finished celebration offers Replay of its own at-bat, but not while it is held for the checkpoint', () => {
  const f = feedOf(824716), ps = f.liveData.plays.allPlays
  const hr = ps.find((p) => p.result.eventType === 'home_run')
  const asked = []
  const Probe = ({ onReplay }) => { onReplay?.(); return h('i', { 'data-replay': !!onReplay }) }
  const render = (play, extra) => renderToStaticMarkup(h(GamedayStage, {
    SealBox: ({ children }) => children(), StageCanvas: Probe, feed: f, inning: play.about.inning, half: play.about.halfInning,
    wall: wallFn(null), shown: play.about.atBatIndex, playing: false, onReplay: (idx) => asked.push(idx), ...extra,
  }))
  assert.match(render(hr), /data-replay="true"/)
  assert.deepEqual(asked, [hr.about.atBatIndex])
  const slam = feedOf(777747).liveData.plays.allPlays.find((p) => p.result.eventType === 'home_run' && p.result.rbi === 4)
  assert.match(render(slam, { feed: feedOf(777747), checkpoint }), /data-replay="false"/)
})
