// The park's accuracy note ("Wall from MLB's drawing of this park, …") under a park with
// fielders on it. BallparkDiagram prints the note as one long line along the drawing's bottom
// edge. The two cards that lay HTML name tags over the park (DefenseDiamond, and the lineup
// page's FieldCard) put the catcher's tag and the DH corner tag on that same strip, so on a
// MiLB park the note ran under them and was clipped at the right (the innings page's Field tab,
// the lineup page's Defensive alignment, the team page's Roster band). Both cards now keep the
// note out of the drawing and print it as a quiet caption under the field.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

test('a MiLB park carries an accuracy note (the case that collided)', () => {
  // First Horizon Park, Nashville: its wall comes from MLB's drawing, so it has a note.
  const layout = resolveBallparkLayout({ venueName: 'First Horizon Park', gameDate: '2026-08-01' })
  assert.ok(layout?.accuracyNote, 'expected a note for a MiLB park')
})

test('BallparkDiagram can leave its note out, and prints it by default', () => {
  const diagram = src('components/ballpark/BallparkDiagram.jsx')
  assert.match(diagram, /note = true/)
  assert.match(diagram, /\{note && layout\.accuracyNote && \(/)
})

const CARDS = [
  ['components/scoring/DefenseDiamond.jsx', 'defdiamond__note'],
  ['screens/lineup/next/cards/FieldCard.jsx', 'lfld__note'],
]
for (const [file, caption] of CARDS) {
  test(`${file} keeps the note out of the drawing and prints it as a caption`, () => {
    const jsx = src(file)
    assert.match(jsx, /<BallparkDiagram[^>]*\snote=\{false\}/s)
    assert.match(jsx, new RegExp(`className="${caption}"[^>]*>\\{[^}]*accuracyNote\\}`))
  })
}

test("the caption stays quiet, as the park card's note does: never a shouted label", () => {
  for (const [css, sel] of [['scoring/defense-diamond.css', '.defdiamond__note'], ['lineup-next/field.css', '.lfld__note']]) {
    const body = ruleBody(stripComments(src(join('styles', css))), sel)
    assert.ok(body, `${sel} has a rule`)
    assert.doesNotMatch(body, /text-transform:\s*uppercase/)
    assert.match(body, /color:\s*var\(--text-muted\)/)
  }
})

test('no host hides the drawing note any more', () => {
  const roster = stripComments(src('styles/team-next/roster.css'))
  assert.equal(ruleBody(roster, '.rosterbox-pair__diamond .bpdiagram__note'), null)
  assert.doesNotMatch(src('screens/team/next/roster/index.jsx'), /rosterbox-pair__note/)
})
