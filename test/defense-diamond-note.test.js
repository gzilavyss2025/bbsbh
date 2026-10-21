// The park's accuracy note ("Wall from MLB's drawing of this park, …") and the defense
// diamond. BallparkDiagram prints the note in its bottom-left corner, which is empty paper on
// a whole park. DefenseDiamond crops the park to the defense (defenseWindow.js), and the crop
// puts the catcher's label on that same corner, so on a MiLB park the two ran into each other
// (the team page's Roster band, the innings page's Defensive alignment). The diamond now keeps
// the note out of the drawing and prints it as a caption under the field.
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

test('DefenseDiamond keeps the note out of its cropped drawing and prints it as a caption', () => {
  const diamond = src('components/scoring/DefenseDiamond.jsx')
  assert.match(diamond, /<BallparkDiagram[^>]*note=\{false\}/)
  assert.match(diamond, /className="defdiamond__note"/)
})

test('no host hides the drawing note any more', () => {
  const roster = stripComments(src('styles/team-next/roster.css'))
  assert.equal(ruleBody(roster, '.rosterbox-pair__diamond .bpdiagram__note'), null)
  assert.doesNotMatch(src('screens/team/next/roster/index.jsx'), /rosterbox-pair__note/)
})
