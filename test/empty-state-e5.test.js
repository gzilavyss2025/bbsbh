// Slice E5 of the EmptyState collapse (#1132): the player page's three empty
// states render on EmptyState. The empty tests stay in the callers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => stripComments(readFileSync(join(SRC, 'styles', rel), 'utf8'))
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const props = (body) =>
  body
    .split(';')
    .map((d) => d.trim().split(':')[0].trim())
    .filter(Boolean)

const IMPORT = /import \{ EmptyState \} from '\.\.\/ui\/state\/EmptyState\.jsx'/

test('E5: the prospect card renders both standing states on EmptyState', () => {
  const code = src('components/playerstats/ProspectCard.jsx')
  assert.match(code, IMPORT)
  assert.match(code, /<EmptyState label="Standing vs level">/)
  assert.match(code, /<EmptyState\s+label=\{`\$\{view\.metric\}/, 'the early sample passes a label')
  assert.match(code, /note=\{\s*<>/, 'the early sample passes ONE note node (a fragment)')
  assert.match(code, /<br \/>/, 'the two note lines split on a <br />, not a second <p>')
  assert.doesNotMatch(code, /prospectcard__empty/, 'the hand-drawn empty classes are gone')
  assert.match(code, /<EmptyStanding/, 'the caller still picks the state')
  assert.match(code, /<EarlyStanding/, 'the caller still picks the state')
})

test('E5: the prospect card empty rules are gone', () => {
  assert.doesNotMatch(read('31d-prospect-card.css'), /prospectcard__empty/)
})

test('E5: the splits vs a team empty line is a compact EmptyState', () => {
  const code = src('components/playerstats/SplitsVsTeam.jsx')
  assert.match(code, IMPORT)
  assert.match(code, /<EmptyState size="compact" className="vsteam__none">/)
  assert.doesNotMatch(code, /className="hint vsteam__none"/)
  assert.match(code, /No career meetings/, 'the copy stays')
})

test('E5: .vsteam__none keeps only its margin', () => {
  assert.deepEqual(props(ruleBody(read('26-player-page.css'), '.vsteam__none')), ['margin'])
})
