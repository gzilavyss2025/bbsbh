// Slice 06b of the player-page motion (#2073): the top cards stamp in once per page visit.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SLOTS } from '../src/screens/player/next/sections.js'
import { hasSeen, markSeen, viewKey } from '../src/lib/motion/inViewOnce.js'
import { stripComments, ruleBody } from './helpers/css.js'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const page = read('src/screens/player/next/PlayerNextPage.jsx')
const css = stripComments(read('src/styles/player-next/page.css'))
const decl = (body, prop) =>
  body.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('a return visit shows the top cards at rest, and the rule is scoped to the top', () => {
  assert.equal(decl(ruleBody(css, '.pnext__top--still .card--stamp-in'), 'animation'), 'none')
  assert.equal(ruleBody(css, '.card--stamp-in'), null) // this sheet does not touch the global rule
})

test('the page reads the seen state once at mount and marks it when the cards show', () => {
  assert.match(page, /useState\(\(\) => hasSeen\(topKey\)\)/)
  assert.match(page, /const topKey = viewKey\(id, 'top-cards'\)/)
  assert.match(page, /useEffect\(\(\) => \{\s*if \(shown\) markSeen\(topKey\)\s*\}, \[shown, topKey\]\)/)
})

test('the class sits on #overview only', () => {
  assert.match(page, /id="overview" className=\{still \? 'pnext__top--still' : undefined\}/)
  assert.equal((page.match(/pnext__top--still/g) || []).length, 1)
})

test('an Overview landing clears the rest state in the same commit, then replays', () => {
  const branch = page.slice(page.indexOf("if (key === 'overview')"))
  const clear = branch.indexOf('flushSync(() => setStill(false))')
  const replay = branch.indexOf("replayClass(el, 'card--stamp-in')")
  assert.ok(clear > -1 && replay > clear)
})

test("the 'top-cards' key cannot collide with a slot key", () => {
  assert.ok(SLOTS.every((s) => s.id !== 'top-cards'))
  assert.equal(hasSeen(viewKey(688107, 'top-cards')), false)
  markSeen(viewKey(688107, 'top-cards'))
  assert.equal(hasSeen(viewKey(688107, 'top-cards')), true)
  assert.equal(hasSeen(viewKey(668930, 'top-cards')), false)
})
