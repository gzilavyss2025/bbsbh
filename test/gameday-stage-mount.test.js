// Gameday's stage mount (#2573, #2568 slice 4): the tap rule, the spoiler footing of the mounted
// stage, and the zone map's per-game dismiss. Real data: gamePk 824716 (SEA @ BOS, Fenway), top 2nd,
// atBatIndex 13 (Arozarena's home run).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { rest, saw, tap } from '../src/screens/gameday/next/stage/tapRule.js'
import { GamedayStage } from '../src/screens/gameday/next/stage/GamedayStage.js'
import { wallFn } from '../src/screens/gameday/next/stage/scene.js'
import { stagePlay, stateAt } from '../src/screens/gameday/next/stage/play.js'
import { drawStage } from '../src/screens/gameday/next/stage/drawStage.js'
import { S } from '../src/screens/gameday/next/stage/pixels.js'
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

// ---- The mounted stage -------------------------------------------------------------------------

// Stand-ins: a .jsx file cannot load here. The SealBox calls its render function, as the real one
// does with forceRevealed; the canvas prints what it was handed.
const SealBox = ({ children }) => children()
const StageCanvas = ({ play, t, start, zones }) =>
  h('i', { 'data-batter': play.batter, 'data-pitcher': play.pitcher, 'data-pitches': play.pitches.length, 'data-ball': play.ball ? play.ball.kind : '', 'data-t': t ?? '', 'data-start': start ?? '', 'data-zones': zones ? 1 : 0 })
// A feed whose plays throw when read: before the reveal the stage must not touch them.
const sealedFeed = { ...F, liveData: { ...F.liveData, plays: new Proxy({}, { get: () => { throw new Error('read a play before the reveal') } }) } }
const html = (props) => renderToStaticMarkup(h(GamedayStage, { SealBox, StageCanvas, wall, batSide: 'R', ...props }))

test('before the reveal: no play is read, and the stage draws the rest frame only', () => {
  const out = html({ feed: sealedFeed, shown: null, zones: { '05': { avg: '.250', temp: 'lukewarm' } } })
  assert.match(out, /data-pitches="0"/)
  assert.match(out, /data-ball=""/)
  assert.match(out, /data-zones="1"/)
})

test('at rest a switch hitter stands opposite the pitcher\'s hand; a one-sided hitter keeps his side', () => {
  const at = (batSide, pitchHand) => html({ feed: sealedFeed, shown: null, batSide, pitchHand })
  assert.match(at('S', 'R'), /data-batter="L" data-pitcher="R"/)
  assert.match(at('S', 'L'), /data-batter="R" data-pitcher="L"/)
  assert.match(at('L', 'L'), /data-batter="L"/)
  assert.match(at('R', 'R'), /data-batter="R"/)
})

test('after the reveal: the revealed play draws, at its end at rest and from the tap while playing', () => {
  const end = html({ feed: F, shown: 13, playing: false })
  assert.match(end, /data-ball="air"/)
  assert.doesNotMatch(end, /data-t=""/)
  assert.match(end, /data-zones="0"/)
  assert.match(html({ feed: F, shown: 13, playing: true }), /data-t="" data-start="\d/)
})

test('the zone tint: zone 1 top left as the catcher sees it, zone 9 bottom right, only at rest', () => {
  const play = stagePlay({ matchup: { batSide: { code: 'R' } } }, wall)
  const where = (fb, c) => {
    const xs = [], ys = []
    fb.px.forEach((v, i) => { if (v === c) { xs.push(i % fb.w); ys.push(Math.floor(i / fb.w)) } })
    return xs.length ? [Math.max(...xs), Math.max(...ys), Math.min(...xs), Math.min(...ys)] : null
  }
  const fb = drawStage(stateAt(play, 0), 256, 300, { '01': { temp: 'cold' }, '09': { temp: 'hot' } })
  const cold = where(fb, S.zoneCold), hot = where(fb, S.zoneHot)
  assert.ok(cold && hot)
  assert.ok(cold[0] < hot[2] && cold[1] < hot[3])
  assert.equal(where(drawStage(stateAt(play, 0), 256, 300), S.zoneCold), null)
})

// ---- The zone map's dismiss --------------------------------------------------------------------

test('the dismiss survives a reload and resets for another game', () => {
  const store = new Map()
  globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) } }
  try {
    assert.equal(zoneMapDismissed(824716), false)
    dismissZoneMap(824716)
    assert.equal(zoneMapDismissed(824716), true)
    assert.deepEqual([...store.keys()], ['bbsbh:zonemap:824716'])
    assert.equal(zoneMapDismissed(823169), false)
  } finally {
    delete globalThis.window
  }
})
