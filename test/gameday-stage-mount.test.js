// Gameday's stage mount (#2573, #2568 slice 4): the tap rule, the spoiler footing of the mounted
// stage, and the zone map's per-game dismiss. Real data: gamePk 824716 (SEA @ BOS, Fenway), top 2nd,
// atBatIndex 13 (Arozarena's home run).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { disarm, replay, rest, saw, tap } from '../src/screens/gameday/next/stage/tapRule.js'
import { GamedayStage, restBatter, restZones } from '../src/screens/gameday/next/stage/GamedayStage.js'
import { stageActors } from '../src/screens/gameday/next/stage/actors.js'
import { wallFn } from '../src/screens/gameday/next/stage/scene.js'
import { battingSide } from '../src/screens/gameday/next/stage/battingSide.js'
import { dismissZoneMap, zoneMapDismissed } from '../src/screens/gameday/next/zonemap/zoneMapFlag.js'

const F = JSON.parse(readFileSync(new URL('./fixtures/game-824716.gameday.json', import.meta.url)))
const wall = wallFn(null)
const VIEW = 2 // top 2nd

// ---- The tap rule ------------------------------------------------------------------------------

test('a cold load or a return visit rests: nothing plays, nothing is shown', () => {
  const s = rest(12, VIEW)
  assert.equal(s.shown, null)
  assert.equal(s.playing, false)
  // The same cursor on the next render (a poll) changes nothing.
  assert.equal(saw(s, 12, VIEW), s)
})

test('a poll or a force-reveal that moves the last at-bat without a tap does not play', () => {
  const s = saw(rest(12, VIEW), 13, VIEW)
  assert.equal(s.shown, null)
  assert.equal(s.playing, false)
})

test('the reveal tap plays the play it revealed, once', () => {
  const [armed, advance] = tap(rest(12, VIEW), true, false)
  assert.equal(advance, true)
  // The engine reports the new last at-bat a render or two later.
  assert.equal(saw(armed, 12, VIEW), armed)
  const s = saw(armed, 13, VIEW)
  assert.equal(s.shown, 13)
  assert.equal(s.playing, true)
  // A poll mid-play changes nothing.
  assert.equal(saw(s, 13, VIEW), s)
})

// Review finding 5: a trail-card replay tapped between the reveal tap and the engine's report must not
// cancel the reveal; the revealed play still plays when it arrives.
test('a replay tapped while a reveal tap waits keeps it armed: the revealed play still plays', () => {
  const [armed] = tap(rest(12, VIEW), true, false)
  const r = replay(armed, 10, false)
  assert.equal(r.shown, 10)
  assert.ok(r.armed, 'the pending reveal survives the replay')
  const s = saw(r, 13, VIEW)
  assert.equal(s.shown, 13)
  assert.equal(s.playing, true)
})

test('a tap while playing finishes the play and does not advance; the next tap advances', () => {
  const playing = saw(tap(rest(12, VIEW), true, false)[0], 13, VIEW)
  const [done, advance] = tap(playing, true, false)
  assert.equal(advance, false)
  assert.equal(done.shown, 13)
  assert.equal(done.playing, false)
  assert.equal(tap(done, true, false)[1], true)
})

test('Motion: Reduced shows the end state with no animation, and one tap advances', () => {
  const s = saw(tap(rest(12, VIEW), true, true)[0], 13, VIEW)
  assert.equal(s.shown, 13)
  assert.equal(s.playing, false)
  assert.equal(tap(s, true, true)[1], true)
})

test('a tap that is not a reveal (a page forward) never plays; a new half rests', () => {
  assert.equal(saw(tap(rest(12, VIEW), false, false)[0], 13, VIEW).shown, null)
  // Armed, but the reader went to another half before the play arrived.
  const s = saw(tap(rest(12, VIEW), true, false)[0], 20, VIEW + 1)
  assert.equal(s.shown, null)
  assert.equal(s.view, VIEW + 1)
})

test('while the checkpoint covers the stage, a tap always advances and arms nothing', () => {
  // The third out's reveal arms and plays, then the checkpoint takes the slot: the canvas never mounts.
  const playing = saw(tap(rest(14, VIEW), true, false)[0], 15, VIEW)
  assert.equal(playing.playing, true)
  const [s, advance] = tap(playing, false, false, true)
  assert.equal(advance, true)
  assert.equal(s.playing, false)
  assert.equal(tap(rest(15, VIEW), true, false, true)[0].armed, null)
})

test('a reveal tap that settles without a new last at-bat disarms: a later poll does not play', () => {
  const [armed] = tap(rest(12, VIEW), true, false)
  const s = saw(disarm(armed), 13, VIEW)
  assert.equal(s.shown, null)
  assert.equal(s.playing, false)
})

// ---- The mounted stage -------------------------------------------------------------------------

// Stand-ins: a .jsx file cannot load here. The SealBox calls its render function, as the real one
// does with forceRevealed; the canvas prints what it was handed.
const SealBox = ({ children }) => children()
const StageCanvas = ({ play, t, start, zones }) =>
  h('i', { 'data-batter': play.batter, 'data-pitcher': play.pitcher, 'data-pitches': play.pitches.length, 'data-ball': play.ball ? play.ball.kind : '', 'data-t': t ?? '', 'data-start': start ?? '', 'data-zones': zones ? 1 : 0 })
// A feed whose plays throw when read: before the reveal the stage must not touch them.
const sealedFeed = { ...F, liveData: { ...F.liveData, plays: new Proxy({}, { get: () => { throw new Error('read a play before the reveal') } }) } }
const html = (props) => renderToStaticMarkup(h(GamedayStage, { SealBox, StageCanvas, wall, batSide: 'R', ...props }))

// The corner field is gone (Gary, 2026-10-28, #2694): at rest the stage mounts no canvas, and the
// batting view (the zone card, useGamedayStage) stands alone over the scene's batter side.
test('before the reveal: no play is read, and the rest frame mounts no canvas', () => {
  const out = html({ feed: sealedFeed, shown: null, zones: { '05': { avg: '.250', temp: 'lukewarm' } } })
  assert.equal(out, '<div class="gdstageScene" data-batter-side="R"></div>')
})

test('at rest a switch hitter stands opposite the pitcher\'s hand; a one-sided hitter keeps his side', () => {
  const at = (batSide, pitchHand) => html({ feed: sealedFeed, shown: null, batSide, pitchHand })
  assert.match(at('S', 'R'), /data-batter-side="L"/)
  assert.match(at('S', 'L'), /data-batter-side="R"/)
  assert.match(at('L', 'L'), /data-batter-side="L"/)
  assert.match(at('R', 'R'), /data-batter-side="R"/)
})

test('after the reveal: the revealed play draws, at its end at rest and from the tap while playing', () => {
  const end = html({ feed: F, shown: 13, playing: false })
  assert.match(end, /data-ball="air"/)
  assert.doesNotMatch(end, /data-t=""/)
  assert.match(end, /data-zones="0"/)
  assert.match(html({ feed: F, shown: 13, playing: true }), /data-t="" data-start="\d/)
})


test('the stage shell has no stadium photo or home-color wash', () => {
  const out = html({ feed: sealedFeed, shown: null })
  assert.match(out, /class="gdstageScene"/)
  assert.doesNotMatch(out, /--park-(art|focus|tint):/)
  assert.doesNotMatch(out, /<i /) // no canvas at rest
})

test('the plate inset and overhead field resolve the same handedness', () => {
  for (const [bat, pitch, side] of [['R', 'R', 'R'], ['L', 'L', 'L'], ['S', 'L', 'R'], ['S', 'R', 'L'], [undefined, undefined, 'R']]) {
    assert.equal(battingSide(bat, pitch), side)
    assert.match(html({ feed: sealedFeed, shown: null, batSide: bat, pitchHand: pitch }), new RegExp('data-batter-side="' + side + '"'))
  }
})

test('stage actors identify all nine defenders and the batter', () => {
  const cursor = { inning: 2, half: 'top', mark: 1, step: 0 }
  const batter = restBatter(F, { ...cursor, view: 2, last: 12 })
  const actors = stageActors(F, { ...cursor, batter })
  for (const pos of ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF']) {
    assert.ok(actors.fielders[pos]?.id, pos + ' has an actual player')
  }
  assert.equal(actors.batterId, batter.id)
})

test('stage actors fail closed for an unreached half', () => {
  assert.equal(stageActors(sealedFeed, { inning: 9, half: 'top', mark: -1, step: 0 }), null)
})

test('a trail replay keeps the defense from that play, before later substitutions', () => {
  const feed = structuredClone(F)
  const cursor = { inning: 2, half: 'top', mark: 2, step: null }
  const original = stageActors(F, cursor).fielders
  const later = feed.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 14)
  later.playEvents.unshift({ index: -1, details: { eventType: 'defensive_switch', description: 'Defensive switch' }, player: { id: original.RF.id }, position: { abbreviation: 'LF' } })
  assert.equal(stageActors(feed, { ...cursor, shown: 13 }).fielders.LF.id, original.LF.id)
  assert.equal(stageActors(feed, { ...cursor, shown: 14 }).fielders.LF.id, original.RF.id)
})
