// Slice N9 of the Notice collapse (#1132): the clean-up. One last error line
// moves onto Notice, the rules that no site wears are gone, the raw-value budgets
// bank what the collapse saved, and the docs name the new classes. No scoring
// surface is edited, so no seal pin is needed: the Teammates page is an open
// surface (ADR-0034). Read from the source text, the way notice-n2.test.js does.
//
//   1. THE TEAMMATES LINE is an error Notice, like the other open-page lines (N2).
//   2. THE DEAD RULES. `.screen--slate .hint` has no slate site left. `.hint--error`
//      stays: five dev-only tool pages still wear it.
//   3. THE BUDGETS are the measured counts.
//   4. THE DOCS read true after N8c: the ledger targets, ADR-0017 and ADR-0084.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'
import { BUDGETS } from '../scripts/check-raw-values.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const doc = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const css = (rel) => stripComments(src(`styles/${rel}`))
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const squash = (s) => s.replace(/\s+/g, ' ').replace(/> /g, '>').replace(/ </g, '<')

// ---- 1. the Teammates line ----

test('N9: the rosters error is an error Notice in the degrees namespace, and WHEN it shows is unchanged', () => {
  const code = src('screens/teammates/TeammatesPage.jsx')
  assert.match(code, /import \{ Notice \} from '\.\.\/\.\.\/components\/ui\/state\/Notice\.jsx'/)
  assert.ok(
    squash(code).includes(
      squash('{a && b && result.error && <Notice tone="error" className="degrees__notice">Couldn’t load the rosters. Try again.</Notice>}'),
    ),
    'tone, namespace and sentence; the test that decides WHEN stays in the caller',
  )
  assert.doesNotMatch(code, /hint--error/)
  // The block parent gave no gap: the namespace gives back the 12px the old .hint padding gave.
  assert.match(ruleBody(css('teammates/teammates.css'), '.degrees__notice') ?? '', /margin:\s*var\(--space-3\) 0/)
})
