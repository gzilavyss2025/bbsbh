import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ruleBody, stripComments } from './helpers/css.js'

// Slice 11 (#2073): the Pitch arsenal menu and Detail panel sit on the shared MenuRail; a pick replays the
// side view; a ghost path fades in, never draws in. Asserted from the source text.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const card = read('src/screens/player/next/modules/arsenal/ArsenalCard.jsx')
const scene = read('src/screens/player/next/modules/arsenal/FlightScene.jsx')
const css = stripComments(read('src/styles/player-next/pitcher/arsenal.css'))
const decl = (body, prop) =>
  body.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('the arsenal menu is a MenuRail, with the Detail as its panel', () => {
  assert.match(card, /import \{ MenuRail \} from '[./]+components\/ui\/control\/MenuRail\.jsx'/)
  assert.match(card, /<MenuRail[\s\S]*panel=\{/)
  assert.match(card, /backLabel="All pitches"/)
  assert.match(card, /railMeta/)
  assert.doesNotMatch(card, /\{one && <Detail/)
  assert.doesNotMatch(card, /arsenal__menu/)
})

test('a pick and an un-pick bump the replay key', () => {
  assert.match(card, /onPick=\{pick\}/)
  assert.match(card, /const pick = \(code\) => \{[\s\S]*?setSolo\(code\)[\s\S]*?setRun\(/)
})

test('the old menu rules are gone: no display:none rail', () => {
  assert.doesNotMatch(css, /\.arsenal__menu/)
  assert.doesNotMatch(css, /\.arsenal__pick/)
  assert.equal(ruleBody(css, '.arsenal__name'), null)
})

test('a ghost path is a class, at 0.22, fading in over --dur-unfold from 300ms', () => {
  assert.match(scene, /arsenal__path--ghost/)
  assert.doesNotMatch(scene, /opacity=\{faint \? 0\.25/)
  const body = ruleBody(css, '.arsenal__path--ghost')
  assert.ok(body, 'no .arsenal__path--ghost rule')
  assert.equal(decl(body, 'opacity'), '0.22')
  assert.equal(
    decl(body, 'animation'),
    'arsenal-ghost var(--dur-unfold) var(--ease-unfold) calc(var(--dur-unfold) * 0.75) backwards',
  )
  assert.match(css, /@keyframes arsenal-ghost\s*\{\s*from\s*\{\s*opacity: 0;/)
})

test('a ghost path does not draw in', () => {
  assert.match(
    css,
    /\.arsenal__side \.arsenal__path--ghost \.arsenal__halo,\s*\.arsenal__side \.arsenal__path--ghost \.arsenal__trail\s*\{\s*animation: none;/,
  )
})
