// Slice 06 of the player-page motion (#2073): the top's stamp-in beat and the age flip,
// pinned to the canvas boards B-phone and D2-phone.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HERO_STAMP_DELAY, tileStampDelay } from '../src/screens/player/next/heroData.js'
import { stripComments, ruleBody } from './helpers/css.js'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const page = stripComments(read('src/styles/player-next/page.css'))
const decl = (body, prop) =>
  body.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('the hero lands at 60ms and the tiles from 120ms, 40ms apart', () => {
  assert.equal(HERO_STAMP_DELAY, '60ms')
  assert.deepEqual([0, 1, 2, 3, 4].map(tileStampDelay), ['120ms', '160ms', '200ms', '240ms', '280ms'])
})

test('the hero card and the tiles read the beat', () => {
  assert.match(read('src/screens/player/next/PlayerNextHero.jsx'), /'--stamp-delay': HERO_STAMP_DELAY/)
  assert.match(read('src/screens/player/next/PlayerNextTiles.jsx'), /'--stamp-delay': tileStampDelay\(i\)/)
})

test('the age flip turns on the stamp curve, near the canvas 520ms', () => {
  assert.equal(decl(ruleBody(page, '.pnext__ageflip'), 'transition'), 'transform calc(var(--dur-flip) * 1.15) var(--ease-stamp)')
})

test('reduced motion stops the age flip', () => {
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.pnext__ageflip\s*\{\s*transition:\s*none;?\s*\}/)
})
