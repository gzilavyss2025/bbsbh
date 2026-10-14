// Slice 04d (#2073): the On-the-mound Starter / Bullpen tabs are the joined Segmented control.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

test('mound: the tabs are a Segmented, not a row of Buttons', () => {
  const s = src('screens/player/next/modules/mound/index.jsx')
  assert.ok(s.includes("import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'"))
  assert.match(s, /<Segmented\s+label="How the card reads"/)
  assert.doesNotMatch(s, /mound__tabs|(?<![-\w])pressed=\{/)
})

test('mound.css: no gap rule splits the joined tabs', () => {
  assert.equal(ruleBody(stripComments(src('styles/player-next/pitcher/mound.css')), '.mound__tabs'), null)
})
