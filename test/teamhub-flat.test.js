// Three boxes inside the team page's cards become flat (#1775, cases 2 to 4).
// Gary picked the flat look from the design lab's before/after on 2026-10-08,
// and kept it over #2154's stamped prospects sheet on 2026-10-18. Each of these
// would come back silently: lint green, the page rendering, only a screenshot
// noticing a box inside a box again.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postcss from 'postcss'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const css = (rel) => stripComments(readFileSync(join(SRC, 'styles', rel), 'utf8'))

const CHROME = /(^|;)\s*(background|border|border-radius|box-shadow)\s*:/

function sheets(dir, prefix = '') {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return sheets(abs, `${prefix}${f}/`)
    return f.endsWith('.css') ? [`${prefix}${f}`] : []
  })
}

// Every rule in src/styles/ whose selector ends on `cls`, so a box put back by a
// later rule, a media query or another partial fails too. The design lab's own
// sheets are prototypes and are skipped.
function rulesEndingIn(cls) {
  const tail = new RegExp(`\\.${cls}(?![\\w-])[^\\s>+~]*$`)
  const found = []
  for (const rel of sheets(join(SRC, 'styles')).filter((f) => !f.startsWith('designlab/'))) {
    postcss.parse(readFileSync(join(SRC, 'styles', rel), 'utf8')).walkRules((rule) => {
      if (!rule.selectors.some((sel) => tail.test(sel.trim()))) return
      const props = rule.nodes.filter((n) => n.type === 'decl').map((d) => d.prop.toLowerCase())
      found.push({ where: `${rel}: ${rule.selector}`, props })
    })
  }
  return found
}

const BOX = new Set(['background', 'background-color', 'border', 'border-radius', 'box-shadow'])
const noBoxAnywhere = (cls) => {
  const rules = rulesEndingIn(cls)
  assert.ok(rules.length > 0, `.${cls} should still have a rule`)
  for (const { where, props } of rules) {
    const box = props.filter((p) => BOX.has(p))
    assert.deepEqual(box, [], `${where} draws a box again`)
  }
}

test('the roster list draws no card of its own, only a rule above and below', () => {
  noBoxAnywhere('thub-roster')
  const body = ruleBody(css('31-wild-card.css'), '.thub-roster')
  assert.doesNotMatch(body, CHROME)
  assert.match(body, /border-block:\s*var\(--bw-hair\) solid var\(--border-rule\)/)
})

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
