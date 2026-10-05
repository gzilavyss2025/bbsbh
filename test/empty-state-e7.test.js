// Slice E7 of the EmptyState collapse (#1132): the boxed and mixed empty
// states. Source-text pins, the way test/empty-state-cascade.test.js does it.
// Each would fail silently otherwise: lint green, the page rendering, only a
// screenshot noticing.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

// The body of one CSS rule, by its exact selector, or null when it is gone.
const ruleBody = (css, selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = css.match(new RegExp(`(^|\\n)${esc} \\{([^}]*)\\}`))
  return m ? m[2] : null
}
// The declarations of a rule body, without comments, as "prop: value" lines.
const decls = (body) =>
  body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)

const IMPORT_EMPTY = /import \{ EmptyState \} from '[./]+\/(ui|components\/ui)\/state\/EmptyState\.jsx'/

// ---------------------------------------------------------------- /prospects
test('E7: the prospects filter result renders EmptyState with a Button in action and role="status"', () => {
  const code = src('screens/ProspectsPage.jsx')
  assert.match(code, IMPORT_EMPTY)
  assert.match(code, /import \{ Button \} from '\.\.\/components\/ui\/control\/Button\.jsx'/)
  assert.match(
    code,
    /\{allPlayers\.length > 0 && players\.length === 0 && \(\n\s*<EmptyState\n\s*className="prospects__empty"\n\s*role="status"\n\s*action=\{<Button onClick=\{resetFilters\}>Clear filters<\/Button>\}\n\s*>\n\s*No Top 100 prospects match those filters\.\n\s*<\/EmptyState>/,
  )
  assert.doesNotMatch(code, /<div className="prospects__empty"/)
})

test('E7: .prospects__empty keeps only its margin; the solid box and its child rule are gone', () => {
  const css = src('styles/31c-prospect-filters.css')
  assert.deepEqual(decls(ruleBody(css, '.prospects__empty')), ['margin: var(--space-4) 0'])
  assert.equal(ruleBody(css, '.prospects__empty p'), null)
})

// ----------------------------------------------------------------- /salaries
test('E7: the salary board empty renders EmptyState with className="payboard__empty" (e2e/salaries.spec.js reads it)', () => {
  const code = src('components/salaries/SalaryBoard.jsx')
  assert.match(code, IMPORT_EMPTY)
  assert.match(
    code,
    /\{players\.length === 0 && \(\n\s*<EmptyState className="payboard__empty">No salaried player at this club and position\.<\/EmptyState>/,
  )
  assert.doesNotMatch(code, /<p className="payboard__empty"/)
  const spec = readFileSync(join(SRC, '..', 'e2e', 'salaries.spec.js'), 'utf8')
  assert.match(spec, /page\.locator\('\.payboard__empty'\)/)
})

test('E7: .payboard__empty keeps only a margin; the solid top rule is gone', () => {
  const css = src('styles/71-salaries-league.css')
  assert.deepEqual(decls(ruleBody(css, '.payboard__empty')), ['margin: var(--space-3)'])
})

// ---------------------------------------------------- the umpire modal (scope)
test('E7: the umpire modal no-data line renders EmptyState; its empty test stays byte for byte', () => {
  const code = src('components/umpire/UmpireAccuracyModal.jsx')
  assert.match(code, IMPORT_EMPTY)
  assert.match(code, /const season = data\?\.accuracy\?\.season \?\? null\n/)
  assert.match(
    code,
    /\{data && !season && \(\n\s*<EmptyState className="umpmodal__empty">No plate-accuracy data on file for this umpire yet\.<\/EmptyState>/,
  )
  assert.doesNotMatch(code, /umpmodal__hint/)
  // It opens from the box score: no new api/ module came with the move.
  const apiImports = code.match(/from '[./]+\/api\/[^']+'/g) ?? []
  assert.deepEqual(apiImports, ["from '../../api/umpires.js'"])
})

test('E7: .umpmodal__hint is gone; .umpmodal__empty keeps only a margin', () => {
  const css = src('styles/14-strike-zone.css')
  assert.equal(ruleBody(css, '.umpmodal__hint'), null)
  assert.deepEqual(decls(ruleBody(css, '.umpmodal__empty')), ['margin-bottom: var(--space-3)'])
})

// ------------------------------------------------- the stamp sheet (a split)
test('E7: the stamp sheet splits: a plain loading line, and EmptyState only for the not-posted branch', () => {
  const code = src('components/logbook/StampSheet.jsx')
  assert.match(code, IMPORT_EMPTY)
  assert.match(code, /const empty = roster\.length === 0\n/)
  const branch = code.slice(code.indexOf('{empty && staticTeams.loading ? ('), code.indexOf('<div className="stampsheet__panes">'))
  assert.match(branch, /^\{empty && staticTeams\.loading \? \(\n\s*<p className="stampsheet__loading">Loading this level’s clubs\.<\/p>\n\s*\) : empty \? \(\n\s*<EmptyState>This level’s clubs are not posted yet\.<\/EmptyState>\n\s*\) : \(/)
  // The loading line is not an EmptyState, and the empty branch draws no stamp art (ADR-0035).
  assert.doesNotMatch(branch, /<EmptyState[^>]*>Loading/)
  assert.doesNotMatch(branch, /StampPane|postagestamp|resolveStampArt|<img/)
  assert.doesNotMatch(code, /stampsheet__empty/)
})

test('E7: .stampsheet__loading keeps the old line look; .stampsheet__empty is gone', () => {
  const css = src('styles/48c-stamp-sheet.css')
  assert.equal(ruleBody(css, '.stampsheet__empty'), null)
  assert.deepEqual(decls(ruleBody(css, '.stampsheet__loading')), [
    'margin: 0',
    'font-family: var(--font-body)',
    'font-size: var(--fs-small)',
    'line-height: var(--lh-prose)',
    'color: var(--text-muted)',
  ])
})

// ---------------------------------------------- the offseason lead (a split)
test('E7: the offseason lead splits: a plain loading line, and EmptyState for no moves; both keep role="status"', () => {
  const code = src('components/offseason/OffseasonLead.jsx')
  assert.match(code, IMPORT_EMPTY)
  assert.match(code, /\{total > 0 \? \(/)
  assert.match(
    code,
    /\) : loading \? \(\n\s*<p className="oseason__loading" role="status">Reading the wire…<\/p>\n\s*\) : \(\n\s*<EmptyState className="oseason__empty" role="status">\n\s*\{`No moves filed in the last \$\{windowDaysFor\(sportId\)\} days\.`\}\n\s*<\/EmptyState>/,
  )
  assert.doesNotMatch(code, /oseason__quiet/)
})

test('E7: .oseason__loading keeps the old line look; .oseason__empty keeps only its margin-top', () => {
  const css = src('styles/78-offseason.css')
  assert.equal(ruleBody(css, '.oseason__quiet'), null)
  assert.deepEqual(decls(ruleBody(css, '.oseason__loading')), [
    'margin: var(--space-4) 0 0',
    'font-family: var(--font-body)',
    'font-size: var(--fs-body)',
    'color: var(--text-caption)',
  ])
  assert.deepEqual(decls(ruleBody(css, '.oseason__empty')), ['margin: var(--space-4) 0 0'])
})
