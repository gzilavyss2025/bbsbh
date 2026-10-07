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
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
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

// ---- 2. the dead rules ----

// The slate (`.screen--slate`, GameSelect.jsx) wears no `.hint`: its loading line is a
// Loader, its error an AsyncStatus Notice and its empty line an EmptyState.
test('N9: the slate rule for .hint is gone, and .btn keeps its caps', () => {
  const nav = css('05-masthead-nav.css')
  assert.doesNotMatch(nav, /\.screen--slate \.hint/)
  const body = ruleBody(nav, '.screen--slate .btn') ?? ''
  assert.match(body, /letter-spacing:\s*var\(--ls-caps\)/)
  assert.match(body, /text-transform:\s*uppercase/)
})

// `.hint--error` is worn by five dev-only pages (App.jsx loads them in DEV only), so the
// rule stays. This fails the day the fifth moves, and the day a new page wears it.
// (test/ keeps its own mentions of the class, so only src is read.)
const TOOL_PAGES = [
  'screens/ScorecardLab.jsx',
  'screens/UniformNamesPage.jsx',
  'screens/identity-lab/ColorLabBody.jsx',
  'screens/identity-lab/DugoutRail.jsx',
  'screens/identity-lab/profiles/milb.jsx',
]
test('N9: .hint--error keeps its rule, and only the five dev-only tool pages wear it', () => {
  assert.match(css('05-masthead-nav.css'), /\.hint--error\s*\{\s*color:\s*var\(--clay\);\s*\}/)
  const wearers = walk(SRC)
    .filter((f) => /\.jsx?$/.test(f) && /hint--error/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(SRC, f))
  assert.deepEqual(wearers.sort(), [...TOOL_PAGES].sort())
})

// ---- 3. the budgets ----

test('N9: the raw-value and caption budgets are the measured counts', () => {
  assert.deepEqual(BUDGETS, { hex: 24, radius: 81, motion: 55, shadow: 41 })
  assert.match(readFileSync(join(ROOT, 'scripts/check-caption-budget.mjs'), 'utf8'), /^const BUDGET = 120$/m)
})

// ---- 4. the docs ----

const ledgerRow = (cls) => doc('docs/design-system-naming.md').split('\n').find((l) => l.startsWith(`| \`${cls}\` |`)) ?? ''

test('N9: the ledger rows name the real targets, and keep the old classes as the record', () => {
  const delay = ledgerRow('.delaycard').split('|').map((c) => c.trim())
  assert.equal(delay[1], '`.delaycard`')
  assert.equal(delay[3], '`.delay`')
  const change = ledgerRow('.pitchernotice').split('|').map((c) => c.trim())
  assert.equal(change[1], '`.pitchernotice`')
  assert.equal(change[3], '`.change`')
})

test('N9: ADR-0017 names the .change card and the event Notice frame; only its dated note names the old class', () => {
  const adr = doc('docs/adr/0017-innings-notification-tiers-and-copy-conventions.md')
  const at = adr.indexOf('**2026-10-07 (#1132')
  assert.ok(at > 0, 'the dated note exists')
  assert.doesNotMatch(adr.slice(0, at), /pitchernotice/, 'the tier prose says .change')
  assert.match(adr, /`\.change`/)
  assert.match(adr, /`\.notice--event`/)
})

test('N9: the ADR-0084 addendum records the two rows that did not fit the rule, and the framed oddity', () => {
  const adr = doc('docs/adr/0084-a-block-is-named-for-its-job-never-its-shape.md')
  const addendum = adr.slice(adr.indexOf('Addendum, 2026-10-07'))
  assert.ok(addendum.length < adr.length, 'the addendum exists')
  assert.match(addendum, /`\.pitchernotice`/)
  assert.match(addendum, /`\.change`/)
  assert.match(addendum, /`\.delaycard`/)
  assert.match(addendum, /`\.delay`/)
  assert.match(addendum, /`\.change--framed`/)
  assert.match(addendum, /`\.pcard`/)
})

test('N9: the ui and playbyplay notes read true after the rename', () => {
  assert.match(src('components/ui/CLAUDE.md'), /`Notice` \(#1132\)/)
  const play = src('components/playbyplay/CLAUDE.md')
  assert.match(play, /noticeClass\(\{ tone: 'event' \}\)/)
  assert.match(play, /`\.change--framed`/)
  assert.match(play, /root class is `\.change`/)
})
