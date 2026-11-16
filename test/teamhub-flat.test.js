// Three boxes inside the team page's cards become flat (#1775, cases 2 to 4).
// Gary picked the flat look from the design lab's before/after on 2026-10-08,
// and kept it over #2154's stamped prospects sheet on 2026-10-18. Each of these
// would come back silently: lint green, the page rendering, only a screenshot
// noticing a box inside a box again.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody, rulesEndingIn } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const css = (rel) => stripComments(readFileSync(join(SRC, 'styles', rel), 'utf8'))

const CHROME = /(^|;)\s*(background|border|border-radius|box-shadow)\s*:/



const BOX = new Set(['background', 'background-color', 'border', 'border-radius', 'box-shadow'])
const noBoxAnywhere = (cls) => {
  const rules = rulesEndingIn(join(SRC, 'styles'), cls)
  assert.ok(rules.length > 0, `.${cls} should still have a rule`)
  for (const { where, props } of rules) {
    const box = props.filter((p) => BOX.has(p))
    assert.deepEqual(box, [], `${where} draws a box again`)
  }
}

test('a Minors stat tile is a figure under a pencil rule, not a grey well', () => {
  noBoxAnywhere('hzntile__tile')
  const body = ruleBody(css('31-wild-card.css'), '.hzntile__tile')
  assert.doesNotMatch(body, CHROME)
  assert.match(body, /border-top:\s*var\(--bw-hair\) solid var\(--border-rule\)/)
})

test('the prospects table sits bare in its card, with no stamped sheet of its own', () => {
  const jsx = readFileSync(join(SRC, 'screens/team/modules/minors/ProspectsCard.jsx'), 'utf8')
  assert.match(jsx, /<Table\b(?=[^>]*\bframe="bare")(?=[^>]*\bclassName="ledger prospecttable")[^>]*>/)
  assert.doesNotMatch(css('team-next/farm.css'), /\.table:has\(> \.prospecttable\)/)
})
