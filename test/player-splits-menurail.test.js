import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'
import { splitsMenu } from '../src/screens/player/next/modules/splits/splitsView.js'

// The pitcher's Splits menu on MenuRail (#2073, slice 09).
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const hand = { rows: [{ label: 'vs LHB', ops: '.702' }, { label: 'vs RHB', ops: '.655' }] }
const sit = { groups: [{ family: 'base', rows: [{ key: 'r0', ops: '.640' }, { key: 'risp', ops: '.711' }] }] }
const glView = { sections: [{ items: [{ key: 'home', era: '3.10' }, { key: 'road', era: '4.25' }] }] }

test('splitsMenu: every part with data, then All four', () => {
  const m = splitsMenu({ hand, sit, vs: true, glView, group: 'pitching' })
  assert.deepEqual(m.map((x) => x.key), ['h', 's', 'v', 'g', 'all'])
  assert.equal(m[0].preview, 'vs LHB .702 · vs RHB .655')
  assert.equal(m[1].preview, 'Empty .640 · RISP .711')
  assert.equal(m[3].preview, 'Home 3.10 · Road 4.25')
  assert.deepEqual(m.map((x) => x.hint), ['OPS against', 'OPS against', 'Career ERA', 'Career ERA', 'Every section open'])
})

test('splitsMenu: no vs-team shard and no game lines, no card for them', () => {
  assert.deepEqual(splitsMenu({ hand, sit, vs: false, glView: null, group: 'pitching' }).map((x) => x.key), ['h', 's', 'all'])
})

test('splitsMenu: a part still loading has a card with no preview', () => {
  const m = splitsMenu({ hand: undefined, sit: undefined, vs: false, glView: null, group: 'pitching' })
  assert.equal(m[0].preview, null)
  assert.equal(m[1].preview, null)
})

test('the module uses MenuRail for a pitcher, and the hand-made menu is gone', () => {
  const index = read('src/screens/player/next/modules/splits/index.jsx')
  assert.match(index, /<MenuRail label="Splits sections" items=\{menu\} picked=\{focus\} onPick=\{setFocus\} panel=\{cards\} \/>/)
  assert.match(index, /cards\('all'\)/)
  assert.doesNotMatch(index, /splitsmod__mc|splitsmod__menu/)
})

test('splits.css: the old menu rules are gone, the figure text stays', () => {
  const css = stripComments(read('src/styles/player-next/both/splits.css'))
  assert.doesNotMatch(css, /\.splitsmod__(menu|mc|mt|mx)\b/)
  assert.ok(ruleBody(css, '.splitsmod__mp'))
  assert.ok(ruleBody(css, '.splitsmod__mh'))
})

test('splits.css: inside the panel a part does not rise again, and its bars still grow', () => {
  const css = stripComments(read('src/styles/player-next/both/splits.css'))
  assert.match(ruleBody(css, '.menurail__panel .splitsmod__part.is-pre'), /opacity:\s*1/)
  assert.match(ruleBody(css, '.menurail__panel .splitsmod__part.is-pre .splitsmod__fill'), /visibility:\s*hidden/)
  assert.match(ruleBody(css, '.menurail__panel .splitsmod__part.is-in'), /animation:\s*none/)
  assert.ok(ruleBody(css, '.splitsmod__part.is-in .splitsmod__fill'), '08a grow rule still there')
})