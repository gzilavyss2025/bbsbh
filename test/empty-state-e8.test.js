// Slice E8 of the EmptyState collapse (#1132): the Matchup Scout and the Game
// Log render their empty lines on EmptyState. Asserted from the source text.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const IMPORT = /import \{ EmptyState \} from '(\.\.\/)+components\/ui\/state\/EmptyState\.jsx'/

test('E8: the Scout page renders its prompt and three chart slots on EmptyState', () => {
  const code = src('screens/scout/ScoutPage.jsx')
  assert.match(code, IMPORT)
  assert.match(code, /\{!hasPair && <EmptyState>Pick a pitcher and a hitter<\/EmptyState>\}/)
  assert.equal(code.match(/<EmptyState size="compact">Not posted<\/EmptyState>/g)?.length, 3, 'three compact chart slots')
  assert.doesNotMatch(code, /scout__notposted/, 'the page no longer wears the class')
  assert.doesNotMatch(code, /<p className="hint">Pick a pitcher/)
  assert.match(code, /hint hint--error">Couldn’t load this pair/, 'the error line stays')
})

test('E8: the lab keeps scout__notposted, so its rule stays', () => {
  assert.match(src('screens/designlab/scout/ScoutLab.jsx'), /scout__notposted/)
  assert.match(src('styles/scout/scout.css'), /\.scout__notposted\s*\{/)
})

test('E8: the head-to-head empties render on EmptyState, with the tests in the caller', () => {
  const code = src('screens/scout/HeadToHead.jsx')
  assert.match(code, IMPORT)
  assert.match(code, /<EmptyState>No head-to-head on file<\/EmptyState>/)
  assert.match(code, /<EmptyState>No meetings before \{humanDateWithYear\(cutoff\)\}<\/EmptyState>/)
  assert.match(code, /failed \? \(/)
  assert.match(code, /pas\.length === 0 \? \(/)
})

test('E8: the Game Log "No stamps yet" lines render on EmptyState, copy only', () => {
  for (const rel of ['screens/LogbookCollection.jsx', 'screens/LogbookStatsPage.jsx']) {
    const code = src(rel)
    assert.match(code, IMPORT, rel)
    assert.match(code, /<EmptyState>\s*No stamps yet\./, rel)
    assert.doesNotMatch(code, /hint hint--prose">\s*No stamps yet/, rel)
  }
  // The empty test stays the caller's.
  assert.match(src('screens/LogbookCollection.jsx'), /total === 0 \? \(/)
})
