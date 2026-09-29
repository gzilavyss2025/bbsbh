// The awards ledger's breakpoint: JS and CSS must agree at every width (#1257).
//
// AwardsLedger.jsx picks WHICH BOX IS THE CARD with WIDE_QUERY: below it the
// whole ledger is one card, from it up each award table is its own card. The
// stylesheet then draws the hairline between two tables in the one card. When
// the divider rule had its own query, (max-width: 739.98px), a fractional or
// zoomed width between 739.98 and 740 matched neither side: JS drew the one
// card and CSS drew no divider, so the tables ran together.
//
// The rule: 67-awards-ledger.css may use no media query but WIDE_QUERY itself.
// A width that WIDE_QUERY matches is wide in JS and in CSS; any other width is
// narrow in both. Styles that belong to the narrow layout key on the class of
// the one Card that JS draws there (.awards--stacked), not on a second query.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { WIDE_QUERY } from '../src/hooks/useMediaQuery.js'

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')
const css = readFileSync(join(STYLES, '67-awards-ledger.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const norm = (q) => q.replace(/\s+/g, ' ').trim()

test('the awards ledger CSS uses only the JS breakpoint, so no width falls between them', () => {
  const queries = [...css.matchAll(/@media\s+([^{]+)\{/g)].map((m) => norm(m[1]))
  assert.ok(queries.length > 0, 'expected the wide layout query')
  for (const q of queries) {
    assert.equal(q, norm(WIDE_QUERY), `@media ${q} is not WIDE_QUERY; a width can match neither side`)
  }
})

test('the divider between two award tables keys on the one Card that JS drew', () => {
  const jsx = readFileSync(join(STYLES, '..', 'components', 'player', 'AwardsLedger.jsx'), 'utf8')
  assert.match(jsx, /<Card as="div" body="flush" className="awards awards--stacked">/)
  assert.match(css, /\.awards--stacked\s+\.awardblk\s*\+\s*\.awardblk\s*\{[^}]*border-top:/)
})
