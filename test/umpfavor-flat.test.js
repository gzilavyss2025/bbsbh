// The plate umpire's worst call and favour meter are two columns split by a
// rule, not two boxes inside the stat card (#1775, case 1). Gary picked the
// flat look from the design lab's before/after on 2026-10-08. Each of these
// would come back silently: lint green, the page rendering, only a screenshot
// noticing a box inside a box again.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const sealbox = stripComments(readFileSync(join(SRC, 'styles/12-sealbox.css'), 'utf8'))

const CHROME = /(^|;)\s*(background|border|border-radius|box-shadow)\s*:/

for (const box of ['.wcall', '.favormeter']) {
  test(`${box} draws no card of its own: no fill, border, radius or shadow`, () => {
    const body = ruleBody(sealbox, box)
    assert.ok(body, `${box} should still have a rule`)
    assert.doesNotMatch(body, CHROME)
  })
}

test('the favour meter keeps its tier pill but loses the tier wash', () => {
  assert.equal(ruleBody(sealbox, '.favormeter--standout'), null)
  assert.equal(ruleBody(sealbox, '.favormeter--outlier'), null)
  assert.ok(ruleBody(sealbox, '.favormeter__tierpill--standout'))
  assert.ok(ruleBody(sealbox, '.favormeter__tierpill--outlier'))
  const jsx = readFileSync(join(SRC, 'components/gamehud/StatBox.jsx'), 'utf8')
  assert.doesNotMatch(jsx, /favormeter--\$\{/)
})

test('a hairline rule splits the two columns', () => {
  const body = ruleBody(sealbox, '.umpfavor__row > * + *')
  assert.ok(body, 'the second cell should carry the dividing rule')
  assert.match(body, /border-top:\s*var\(--bw-hair\) solid var\(--border-hairline\)/)
})
