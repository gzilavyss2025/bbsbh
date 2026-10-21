// No park drawing prints an accuracy note (Gary, 2026-10-21: "it's useless"). The notes were
// "Wall from MLB's drawing of this park, …", "Wall drawn straight between the posted
// distances", "Wall shape is approximate" and "Wall traced from a 2018 drawing". A layout
// still records how sure its wall is in `quality` and `provenance`; nothing prints it. This
// replaces the caption tests of #2446, which moved the note under the field before it went.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { allBallparkLayouts } from '../src/lib/ballpark/layout/resolveLayout.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

test('no layout carries an accuracy note, whatever its quality', () => {
  const qualities = new Set()
  for (const l of allBallparkLayouts()) {
    assert.equal('accuracyNote' in l, false, l.configurationId)
    qualities.add(l.quality.fence)
  }
  // The quality is still recorded: the notes went, not the knowledge behind them.
  assert.ok(qualities.has('estimated') && qualities.has('dimensions-only'))
})

test('no drawing and no host prints a park note', () => {
  for (const file of [
    'components/ballpark/BallparkDiagram.jsx',
    'components/scoring/DefenseDiamond.jsx',
    'screens/lineup/next/cards/FieldCard.jsx',
    'screens/player/next/modules/innings/index.jsx',
  ]) {
    assert.doesNotMatch(src(file), /accuracyNote|__note"/, file)
  }
})
