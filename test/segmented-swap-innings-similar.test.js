// Slice 04b (#2073): the Innings-by-position scope and the Similar card's Usage /
// Velocity switch are the joined Segmented control, filling the row.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(rel))
const IMPORT = "import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'"

test('innings: the scope is a filling Segmented with its box class', () => {
  const s = src('screens/player/next/modules/innings/index.jsx')
  assert.ok(s.includes(IMPORT))
  assert.match(s, /<Segmented\s+label="Scope"\s+className="pnext-inn__scope"\s+fill\b/)
  assert.doesNotMatch(s, /(?<![-\w])aria-pressed=\{/)
  assert.doesNotMatch(s, /import \{ (Button|Cluster) \}/)
})

test('innings.css keeps the box and drops the child flex rule', () => {
  const c = css('styles/player-next/both/innings.css')
  assert.ok(ruleBody(c, '.pnext-inn__scope'), 'the box rule stays')
  assert.equal(ruleBody(c, '.pnext-inn__scope > *'), null)
})

test('similar: Usage / Velocity is a filling Segmented', () => {
  const s = src('screens/player/next/modules/similar/index.jsx')
  assert.ok(s.includes(IMPORT))
  assert.match(s, /<Segmented\s+label="What the dots show"\s+className="simp__switch"\s+fill\b/)
  assert.doesNotMatch(s, /(?<![-\w])aria-pressed=\{/)
})

test('similar.css: no hand-drawn switch; the wide step stops the fill', () => {
  const c = css('styles/player-next/both/similar.css')
  assert.equal(ruleBody(c, '.simp__switch'), null)
  assert.doesNotMatch(c, /\.simp__switch \.(btn|pnext-pick)/)
  // The rule sits inside @media (min-width: 740px), indented, so ruleBody cannot find it.
  assert.match(c, /\.simp__switch\.segmented--fill > \.segmented__btn \{[^}]*flex:\s*none/)
})
