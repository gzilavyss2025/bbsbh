// Gameday's hero and its scorebook box (#2576, #2568): the box's model, the spoiler footing of the
// hero's markup (server-rendered, the real component) and the one sealed size per tier.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { deriveLiveState } from '../src/api/playbyplay/entriesView.js'
import { boxModel, contactLine, ordinal } from '../src/screens/gameday/next/hero/heroModel.js'
import { heroMarkup } from '../src/screens/gameday/next/hero/heroMarkup.js'
import { stripComments, ruleBody } from './helpers/css.js'

const feed = (pk) => JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url)))
const F824 = feed(824716)
const F823 = feed(823169)
const half = (f, inning, h, cap = null) => computeHalfInningFeed(f, inning, h, h === 'top' ? 'away' : 'home', cap)
const at = (entries, atBatIndex) => entries.find((e) => e.kind === 'atbat' && e.atBatIndex === atBatIndex)

test('box model: Davidson\'s 9-pitch single (823169) lands in two columns, X for the ball in play', () => {
  const e = at(half(F823, 1, 'bottom'), 5)
  const m = boxModel(e)
  assert.deepEqual(m.balls, ['3', '4', '6'])
  assert.deepEqual(m.strikes, ['1', '2', '5', '7', '8', 'X'])
  assert.equal(m.code, '1B')
  assert.equal(m.looking, false)
})

test('box model: the legs the batter ran are as of the cursor, not the end of the half', () => {
  const all = half(F824, 2, 'top')
  const rodden = all.indexOf(at(all, 12))
  const through = half(F824, 2, 'top', rodden + 1)
  assert.equal(boxModel(at(through, 12)).legs, 1)
  assert.equal(boxModel(at(all, 12)).legs, 4)
  assert.equal(boxModel(at(all, 13)).legs, 4)
})

test('box model: the RBI and the out number', () => {
  const all = half(F824, 2, 'top')
  assert.equal(boxModel(at(all, 13)).rbi, 3)
  assert.equal(boxModel(at(all, 12)).out, null)
  assert.equal(boxModel(at(all, 14)).out, 2)
})

test('box model: a called third strike draws the backwards K from calledLooking', () => {
  const looking = ['top', 'bottom'].flatMap((h) => Array.from({ length: 9 }, (_, i) => half(F824, i + 1, h)).flat())
    .find((e) => e.kind === 'atbat' && e.calledLooking)
  assert.ok(looking, 'fixture has a looking strikeout')
  assert.ok(!looking.code, 'its code is empty by design')
  const m = boxModel(looking)
  assert.equal(m.code, 'K')
  assert.equal(m.looking, true)
})

test('contact line: ground balls drop the distance', () => {
  const all = half(F824, 2, 'top')
  assert.equal(contactLine(at(all, 13)), '103 mph · 30° · 382 ft')
  assert.equal(contactLine(at(all, 12)), '84 mph · -25°')
  assert.equal(contactLine(at(all, 15)), '')
})

test('ordinal slots', () => {
  assert.deepEqual([1, 2, 3, 4, 9].map(ordinal), ['1st', '2nd', '3rd', '4th', '9th'])
})

const live = (entries, cap) => deriveLiveState(entries, cap).last
const heroProps = { feed: F824, inning: 2, half: 'top', mark: 1, stepAtBatIndex: null }
// SealBox stand-in: a .jsx file cannot load here. Like the real one with forceRevealed, it calls the
// render function; a sealed hero never mounts it.
const SealBox = ({ children }) => children()
const html = (props) => renderToStaticMarkup(heroMarkup(createElement, { SealBox, ...heroProps, ...props }))

test('hero: the last result shows the batter once, the code and the contact; the next at-bat is nowhere', () => {
  const all = half(F824, 2, 'top')
  const cap = all.indexOf(at(all, 12)) + 1
  const out = html({ last: live(half(F824, 2, 'top', cap), cap), stepAtBatIndex: 12 })
  assert.match(out, /#90 Brenden Rodden|#90[\s\S]*Rodden/)
  assert.equal(out.split('Rodden').length - 1, 1, 'the batter is named once')
  assert.match(out, /3rd/, 'slot as an ordinal')
  assert.match(out, /1B/)
  assert.match(out, /84 mph/)
  // Arozarena is the next at-bat: his code, line and contact do not exist yet. His name may stand
  // in the due-up strip (a pre-pitch lineup fact), but nowhere else.
  for (const secret of ['HR', 'Homers', '103 mph', '382']) assert.ok(!out.includes(secret), secret)
})

test('hero: before any at-bat is revealed, no at-bat value of the half is in the DOM', () => {
  const out = html({ last: null })
  assert.match(out, /gdhero__box is-sealed/)
  for (const secret of ['1B', 'Singles', 'Homers', 'mph', 'Rodden', 'Doubles']) assert.ok(!out.includes(secret), secret)
})

test('hero: the sealed box and a revealed 1-pitch and 9-pitch box carry no size of their own', () => {
  const nine = html({ feed: F823, inning: 1, half: 'bottom', last: live(half(F823, 1, 'bottom'), 6) })
  const one = html({ last: live(half(F824, 2, 'top'), null) })
  for (const s of [html({ last: null }), nine, one]) {
    assert.ok(!/style=/.test(s), 'no inline size: the tier names it in hero.css')
    assert.match(s, /class="gdhero__box/)
  }
})

test('hero.css: the box has one fixed height at every tier, whatever the pitch count', () => {
  const css = stripComments(readFileSync(new URL('../src/styles/gameday-next/hero.css', import.meta.url), 'utf8'))
  for (const tier of ['P', 'T', 'L', 'D']) {
    const body = ruleBody(css, `.gdnext[data-tier='${tier}'] .gdhero__box`)
    assert.match(body ?? '', /height:\s*\d+px/, `tier ${tier}`)
  }
})

test('live snapshot: `last` is the last finished at-bat inside the cap, never one past it', () => {
  const all = half(F824, 2, 'top')
  const cap = all.indexOf(at(all, 12)) + 1
  assert.equal(deriveLiveState(all, cap).last.atBatIndex, 12)
  assert.equal(deriveLiveState(all, 0).last, null)
})

test('hero: the due-up strip follows the last result even with no step cursor (a committed half)', () => {
  const all = half(F824, 2, 'top')
  const cap = all.indexOf(at(all, 12)) + 1
  const out = html({ last: live(half(F824, 2, 'top', cap), cap), stepAtBatIndex: null })
  const strip = out.slice(out.indexOf('gdhero__due'))
  assert.match(strip, /1st · #56 Arozarena/, 'Arozarena is due after Rodden')
  assert.ok(!strip.includes('Naylor'), 'not the half\'s leadoff batters')
})

test('hero: no due-up strip while the checkpoint shows (it names the next half; the hero would name the wrong side)', () => {
  const all = half(F824, 2, 'top')
  const out = html({ last: live(all, all.length), stepAtBatIndex: null, checkpoint: true })
  assert.ok(!out.includes('gdhero__due'), 'the checkpoint carries the due-up')
  assert.match(out, /Rodr/, 'the third out\'s box stays')
})
