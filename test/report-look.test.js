// The report look (#1776, Look A): the Season Report and "Who challenges" stay on
// frame="sheet", and the cards inside them are flat. A grade, a driver and a chip
// draw a hairline rule or an underline, never their own fill, edge, corners or shadow.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { ruleBody, stripComments } from './helpers/css.js'

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')
const read = (rel) => stripComments(readFileSync(join(STYLES, rel), 'utf8'))
const team = read('28-team-hub.css')
const chal = read('report/challenge-card.css')

const NO_BOX = ['background', 'border-radius', 'box-shadow']

for (const [css, selector] of [
  [team, '.team-score__grade'],
  [team, '.team-score__row--driver'],
  [chal, '.chal__view'],
]) {
  test(`${selector} draws no inner box`, () => {
    const body = ruleBody(css, selector)
    assert.ok(body, `${selector} rule is missing`)
    for (const property of NO_BOX) {
      assert.doesNotMatch(body, new RegExp(`(^|[;\\s])${property}:\\s*(?!none|0\\b|transparent)\\S`), `${selector} sets ${property}`)
    }
    assert.match(body, /border:\s*0/, `${selector} must clear the full border`)
  })
}

test('the grade is split by a hairline rule, the driver by a hairline above it', () => {
  assert.match(ruleBody(team, '.team-score__grade'), /border-bottom:\s*var\(--bw-hair\) solid var\(--border-rule\)/)
  assert.match(ruleBody(team, '.team-score__row--driver'), /border-top:\s*var\(--bw-hair\) solid var\(--border-rule\)/)
})

test('the chip pair is underlined tabs, and the chosen tab is underlined in marker ink', () => {
  assert.match(ruleBody(chal, '.chal__view'), /border-bottom:\s*var\(--bw-heavy\) solid transparent/)
  assert.match(ruleBody(chal, '.chal__view.is-on'), /border-bottom-color:\s*var\(--marker\)/)
})

test('an open grade or driver shows it with its rule, not with a wash', () => {
  assert.match(ruleBody(team, '.team-score__grade.is-active'), /border-bottom-color:\s*var\(--accent-primary\)/)
  assert.match(ruleBody(team, '.team-score__row--driver.is-active'), /border-top-color:\s*var\(--accent-primary\)/)
  assert.doesNotMatch(ruleBody(team, '.team-score__row--driver.is-active'), /background/)
})

test('the rank strip fades to the sheet, because the inset tile is gone', () => {
  assert.match(ruleBody(team, '.rankstrip__fade--l'), /var\(--surface-card\)/)
  assert.match(ruleBody(team, '.rankstrip__fade--r'), /var\(--surface-card\)/)
})

// ---- Look C: the margin numeral (#1776) -----------------------------------
const card = readFileSync(join(STYLES, '..', 'components', 'teamstats', 'TeamScoreCard.jsx'), 'utf8')

test('the grade result comes before the verdict copy in the markup, with no CSS order trick', () => {
  const at = (needle) => card.indexOf(needle)
  assert.ok(at('team-score__grade-result') > 0)
  assert.ok(at('team-score__grade-result') < at('team-score__grade-copy'))
  assert.doesNotMatch(team, /team-score__grade[^{]*\{[^}]*order:\s*-1/)
})

test('the grade puts the result in the left column and keeps the numeral size tokens', () => {
  assert.match(ruleBody(team, '.team-score__grade-button'), /grid-template-columns:\s*auto minmax\(0, 1fr\)/)
  assert.match(ruleBody(team, '.team-score__grade'), /border-top:\s*var\(--bw-rule\) solid var\(--navy\)/)
  assert.match(ruleBody(team, '.team-score__grade-score'), /font-size:\s*var\(--fs-score-lg\)/)
})

test('the chart is graphite, and --marker marks only the one labelled dot', () => {
  assert.match(ruleBody(chal, '.chal .scatter__line'), /stroke:\s*var\(--graphite\)/)
  assert.match(ruleBody(chal, '.chal .scatter__dot'), /background:\s*var\(--graphite\)/)
  assert.match(ruleBody(chal, '.chal .scatter__dot--mark'), /background:\s*var\(--marker\)/)
  assert.doesNotMatch(ruleBody(team, '.team-score__grade-score'), /marker/)
})
