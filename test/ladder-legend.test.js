// The Ladder's legend line (the three colour samples and the tap hint) is on
// by default. The lineup page's fold card leaves it out (Gary, 2026-10-18); the
// old card on /postseason-live keeps it. Read from source: node cannot import
// .jsx, so the suite cannot render the Ladder.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8')

test('the Ladder takes a legend switch, on by default, that gates the whole legend line', () => {
  const src = read('components/team/ladder/Ladder.jsx')
  assert.match(src, /export function Ladder\(\{[^}]*legend = true[^}]*\}\)/)
  assert.match(src, /\{legend && \(\s*<p className="ladder__legend">/)
})

test('the lineup page fold card passes legend={false}; the old card does not', () => {
  assert.match(read('screens/lineup/next/cards/TeammatesCard.jsx'), /<Ladder [^>]*legend=\{false\}/)
  assert.doesNotMatch(read('components/team/FormerTeammates.jsx'), /legend=\{false\}/)
})
