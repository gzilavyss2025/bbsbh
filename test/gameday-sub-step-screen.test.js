// Sub-step stepping on screen (ADR-0123; #2570 slices 3-4, #2571 slices 3-5): the cursor, the switch's
// flag, the words, the open box, the event card and the stage's one pitch. On trimmed real games:
//  - 824716 bottom 6th ab57: five pitches, Durbin to 3rd on a wild pitch, then the out.
//  - 823169: top 1st ab1 is one pitch; bottom 1st ab5 is Davidson's nine-pitch single.
//  - 823764 bottom 7th ab51: a caught stealing ends the half.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { nextStepBoundary } from '../src/api/playbyplay/entriesView.js'
import { openAtBat } from '../src/api/gameday/subSteps.js'
import { formatAtBatMark, parseAtBatMark } from '../src/hooks/revealProgressCore.js'
import { heroMarkup } from '../src/screens/gameday/next/hero/heroMarkup.js'
import { playLine } from '../src/screens/gameday/next/hero/heroModel.js'
import { eventCardMarkup } from '../src/screens/gameday/next/steps/eventCardMarkup.js'
import { nextSub, readPitchMode, stageKey, stepWords, subTap, writePitchMode } from '../src/screens/gameday/next/steps/subStep.js'
import { GamedayStage } from '../src/screens/gameday/next/stage/GamedayStage.js'
import { wallFn } from '../src/screens/gameday/next/stage/scene.js'
import { rest, saw, tap } from '../src/screens/gameday/next/stage/tapRule.js'

const load = (pk) => JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url), 'utf8'))
const F824 = load(824716)
const F823 = load(823169)
const F764 = load(823764)
const side = (half) => (half === 'top' ? 'away' : 'home')

// The stored step count before each at-bat of a half, as the engine walks it (PlayByPlay's bounds).
function countsOf(feed, inning, half) {
  const entries = computeHalfInningFeed(feed, inning, half, side(half), null)
  const out = [0]
  for (let c = nextStepBoundary(entries, 0); c < entries.length; c = nextStepBoundary(entries, c)) out.push(c)
  return out
}
const countFor = (feed, inning, half, ab) => countsOf(feed, inning, half).find((c) => openAtBat(feed, inning, half, c)?.card.atBatIndex === ab)

const SealBox = ({ children }) => children()
const hero = (feed, inning, half, open) =>
  renderToStaticMarkup(heroMarkup(h, { SealBox, feed, inning, half, mark: -1, last: null, stepAtBatIndex: null, open }))
const card = (feed, inning, half, count, sub) =>
  renderToStaticMarkup(h('div', null, eventCardMarkup(h, { SealBox, feed, inning, half, count, sub })))

test('the cursor stores {halfIdx}:{count}:{sub}, and keeps the two-field form with no sub-step', () => {
  assert.deepEqual(parseAtBatMark('11:5:3'), { halfIdx: 11, count: 5, sub: 3 })
  assert.deepEqual(parseAtBatMark('11:5'), { halfIdx: 11, count: 5, sub: 0 })
  assert.deepEqual(parseAtBatMark('11:5:-1'), { halfIdx: -1, count: 0, sub: 0 })
  assert.deepEqual(parseAtBatMark('11:5:x'), { halfIdx: -1, count: 0, sub: 0 })
  assert.equal(formatAtBatMark({ halfIdx: 11, count: 5, sub: 3 }), '11:5:3')
  assert.equal(formatAtBatMark({ halfIdx: 11, count: 5, sub: 0 }), '11:5')
})

test('824716 ab57: at-bat mode stops at the wild pitch, then the result tap reveals the at-bat', () => {
  const c = countFor(F824, 6, 'bottom', 57)
  assert.equal(nextSub(F824, 6, 'bottom', c, 0, false), 6) // five pitches and the wild pitch on screen
  assert.equal(nextSub(F824, 6, 'bottom', c, 6, false), null) // the result: revealAtBat
})

test('824716 ab57: pitch mode reveals one sub-step a tap; a switch mid-at-bat keeps the place', () => {
  const c = countFor(F824, 6, 'bottom', 57)
  const taps = []
  for (let sub = 0; sub != null; sub = nextSub(F824, 6, 'bottom', c, sub, true)) taps.push(sub)
  assert.deepEqual(taps, [0, 1, 2, 3, 4, 5, 6])
  // Two pitches in, the switch goes off: the next tap runs to the wild pitch, not to the result.
  assert.equal(nextSub(F824, 6, 'bottom', c, 2, false), 6)
  // At the wild pitch in at-bat mode, the switch goes on: the next tap is the result (the last pitch).
  assert.equal(nextSub(F824, 6, 'bottom', c, 6, true), null)
})

test('823764 ab51: the caught stealing that ends the half is the tap that reveals the at-bat', () => {
  const c = countFor(F764, 7, 'bottom', 51)
  const steps = openAtBat(F764, 7, 'bottom', c).steps
  assert.equal(steps.at(-1).eventType, 'caught_stealing_2b')
  assert.equal(subTap(steps, steps.length - 1, true), null)
  assert.equal(subTap(steps, 3, false), null) // past the three changes, the next stop ends the half
})

test('a 1-pitch and a 9-pitch at-bat: the same sealed hero and the same words on every tap', () => {
  const one = countFor(F823, 1, 'top', 1)
  const nine = countFor(F823, 1, 'bottom', 5)
  assert.equal(openAtBat(F823, 1, 'top', one).steps.length, 1)
  assert.equal(openAtBat(F823, 1, 'bottom', nine).steps.length, 9)
  // Sealed (sub 0) the box is the same markup, whatever the at-bat holds (the due-up strip is the lineup's).
  const top = (s) => s.match(/<div class="gdhero__top">.*?<\/div><\/div>/)[0]
  assert.equal(top(hero(F823, 1, 'top', { count: one, sub: 0 })), top(hero(F823, 1, 'bottom', { count: nine, sub: 0 })))
  for (const pitch of [false, true]) {
    const words = new Set()
    for (const [half, c] of [['top', one], ['bottom', nine]]) {
      for (let sub = 0; sub != null; sub = nextSub(F823, 1, half, c, sub, pitch)) words.add(stepWords(pitch))
    }
    assert.equal(words.size, 1)
  }
  assert.equal(stepWords(false), 'Next play')
  assert.equal(stepWords(true), 'Next pitch')
  // Open, the box is the same one box (one height per tier, hero.css): only its pips differ.
  const box = (s) => s.match(/<div class="gdhero__box"[^>]*>/)?.[0]
  assert.equal(box(hero(F823, 1, 'bottom', { count: nine, sub: 8 })), box(hero(F823, 1, 'bottom', { count: nine, sub: 1 })))
})

test('the open box: each pitch adds its number to B or S; the code stays under tape', () => {
  const c = countFor(F823, 1, 'bottom', 5)
  const out = hero(F823, 1, 'bottom', { count: c, sub: 8 })
  assert.match(out, /<i>B<\/i><span class="gdhero__pip">3<\/span><span class="gdhero__pip">4<\/span><span class="gdhero__pip">6<\/span><\/div>/)
  assert.match(out, /<i>S<\/i><span class="gdhero__pip">1<\/span><span class="gdhero__pip">2<\/span><span class="gdhero__pip">5<\/span><span class="gdhero__pip">7<\/span><span class="gdhero__pip">8<\/span><\/div>/)
  assert.match(out, /class="gdhero__code is-taped">Sealed</)
  assert.match(out, /Pitch 8: /)
})

test('no result value in the DOM before the result sub-step, in three whole games', () => {
  let checked = 0
  for (const feed of [F824, F823, F764]) {
    const halves = new Set(feed.liveData.plays.allPlays.map((p) => `${p.about.inning}:${p.about.halfInning}`))
    for (const key of halves) {
      const [inning, half] = [Number(key.split(':')[0]), key.split(':')[1]]
      for (const c of countsOf(feed, inning, half)) {
        const o = openAtBat(feed, inning, half, c)
        if (!o) continue
        const r = o.steps.findIndex((s) => s.kind === 'result')
        const play = feed.liveData.plays.allPlays.find((p) => p.about.atBatIndex === o.card.atBatIndex)
        const lastPitch = play.playEvents.filter((e) => e.isPitch).at(-1)
        const line = playLine(o.card)
        for (let sub = 1; sub <= (r < 0 ? o.steps.length - 1 : r); sub++) {
          const out = hero(feed, inning, half, { count: c, sub }) + card(feed, inning, half, c, sub)
          if (line) assert.ok(!out.includes(line), `ab${o.card.atBatIndex} sub ${sub} shows the result line`)
          for (const t of [lastPitch?.details?.description, lastPitch?.details?.call?.description]) {
            if (t && /in play/i.test(t)) assert.ok(!out.includes(t), `ab${o.card.atBatIndex} sub ${sub} shows "${t}"`)
          }
          if (r >= 0) assert.ok(!out.includes(`Pitch ${o.card.pitchDetails.at(-1)?.no}:`), `ab${o.card.atBatIndex} shows its last pitch`)
          assert.doesNotMatch(out.match(/<div class="gdhero">.*?<\/div><\/div>/)?.[0] ?? '', /class="gdhero__code"/)
          checked += 1
        }
      }
    }
  }
  assert.ok(checked > 400, `checked ${checked}`)
})

test('the event card: Durbin to 3rd on the wild pitch, in his own box, with the result sealed', () => {
  const c = countFor(F824, 6, 'bottom', 57)
  const out = card(F824, 6, 'bottom', c, 6)
  assert.match(out, /class="gdevent__kind">Wild Pitch</)
  assert.match(out, /Caleb Durbin to 3rd/)
  assert.match(out, /aria-label="Scorebook box: E5"/) // his own box (on by an error), run on to 3rd
  assert.equal((out.match(/class="gdhero__leg"/g) ?? []).length, 3)
  assert.equal(card(F824, 6, 'bottom', c, 5), '<div></div>') // a pitch sub-step has no card
})

test('the pitch-mode flag survives a reload and resets for another game', () => {
  const store = new Map()
  const listeners = []
  globalThis.window = {
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    dispatchEvent: (e) => listeners.forEach((fn) => fn(e)),
  }
  globalThis.StorageEvent ??= class { constructor(type, init) { Object.assign(this, { type, ...init }) } }
  try {
    const heard = []
    listeners.push((e) => heard.push(e.key))
    assert.equal(readPitchMode(824716), false)
    writePitchMode(824716, true)
    assert.equal(store.get('bbsbh:pitchmode:824716'), '1')
    assert.equal(readPitchMode(824716), true) // a reload reads the same key
    assert.equal(readPitchMode(823169), false) // another game starts in at-bat mode
    assert.deepEqual(heard, ['bbsbh:pitchmode:824716']) // the same-tab echo the hook listens for
    writePitchMode(824716, false)
    assert.equal(readPitchMode(824716), false)
  } finally {
    delete globalThis.window
  }
})

test('a fast double tap during a pitch reveals one sub-step: the second tap ends the play', () => {
  const VIEW = 11
  let s = rest(stageKey(30, 0, 56), VIEW)
  let advanced = 0
  const press = () => { const [n, go] = tap(s, true, false); s = n; if (go) advanced += 1 }
  press()
  s = saw(s, stageKey(30, 1, 56), VIEW) // the engine shows sub-step 1
  assert.equal(s.shown, '30.1')
  assert.equal(s.playing, true)
  press() // the second tap lands mid-pitch
  assert.equal(advanced, 1)
  assert.equal(s.playing, false)
  press() // at rest, the next tap advances
  assert.equal(advanced, 2)
})

test('the stage plays one pitch for a pitch sub-step, and holds still under an event', () => {
  const wall = wallFn(null)
  const StageCanvas = ({ play, t }) => h('i', { 'data-pitches': play.pitches.length, 'data-last': play.last?.code ?? '', 'data-ball': play.ball ? 1 : 0, 'data-t': t ?? '' })
  const c = countFor(F824, 6, 'bottom', 57)
  const at = (sub) => renderToStaticMarkup(h(GamedayStage, { SealBox, StageCanvas, feed: F824, inning: 6, half: 'bottom', wall, shown: `${c}.${sub}`, playing: false }))
  assert.match(at(3), /data-pitches="3" data-last="F" data-ball="0"/)
  assert.match(at(6), /data-pitches="0" data-last="" data-ball="0" data-t="0"/)
})
