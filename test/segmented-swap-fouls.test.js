// Slice 04c (#2073): the Foul balls cards' toggles are the joined Segmented control.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const IMPORT = "import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'"
const FOULS = 'screens/player/next/modules/fouls/FoulsCard.jsx'
const PFOULS = 'screens/player/next/modules/pfouls/index.jsx'

test('batter fouls: the Season stat row is a filling Segmented on the clamped index', () => {
  const s = src(FOULS)
  assert.ok(s.includes(IMPORT))
  assert.match(s, /<Segmented\s+label="Season stat"\s+fill\b/)
  assert.match(s, /value=\{Math\.min\(metric, view\.baseline\.length - 1\)\}/)
  assert.doesNotMatch(s, /<Pill\b|(?<![-\w])pressed=\{/)
})

test('pitcher fouls: scope and Season stat are filling Segmenteds; the games ride as the count', () => {
  const s = src(PFOULS)
  assert.ok(s.includes(IMPORT))
  assert.match(s, /<Segmented\s+label="Part of season"\s+className="pfouls__scope"\s+fill\b/)
  assert.match(s, /count: `\$\{lines\[k\]\.g\} G`/)
  assert.match(s, /<Segmented\s+label="Season stat"\s+fill\b/)
  assert.doesNotMatch(s, /<Pill\b|<Button\b|(?<![-\w])pressed=\{|pfouls__opt|pfouls__g/)
})

test('pfouls.css: the scope keeps its margin and loses the grid and the two-line label', () => {
  const c = stripComments(src('styles/player-next/pitcher/pfouls.css'))
  const scope = ruleBody(c, '.pfouls__scope')
  assert.ok(scope)
  assert.match(scope, /margin-bottom:\s*var\(--space-4\)/)
  assert.doesNotMatch(scope, /display|grid/)
  assert.equal(ruleBody(c, '.pfouls__opt'), null)
  assert.equal(ruleBody(c, '.pfouls__g'), null)
})
