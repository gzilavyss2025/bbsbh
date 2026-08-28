// Guards parse.mjs against MLB.com's page shape drifting out from under it.
// NOT wired into the CI-gated `npm test` suite (that runs only
// test/**/*.test.js) -- like every other .scratch/ script, this is
// research-only infrastructure, run by hand: node --test parse.test.mjs.
// Hits no network: fixtures/2015-sample.html is a small, committed excerpt
// of a REAL fetched response (see that file's own header). If MLB.com ever
// renames RankedPlayerEntity, PlayerEntity, or the Person:ID ref shape,
// this fails instead of pull.mjs silently writing an empty season.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeHtmlEntities, parseRankedEntries, assertContiguousRanks } from './parse.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(join(here, 'fixtures', '2015-sample.html'), 'utf8')

test('decodeHtmlEntities turns &quot; back into a literal quote', () => {
  assert.equal(decodeHtmlEntities('&quot;rank&quot;:1'), '"rank":1')
})

test('a raw grep for "rank": finds nothing until entities are decoded (the trap this parser exists to avoid)', () => {
  assert.equal(/"rank":/.test(fixture), false)
  assert.equal(/"rank":/.test(decodeHtmlEntities(fixture)), true)
})

test('parseRankedEntries reads all three fixture entries, in rank order, with real MLBAM ids from the Person ref (not a playerId field)', () => {
  const entries = parseRankedEntries(fixture)
  assert.deepEqual(entries, [
    { rank: 1, mlbId: 621439 },
    { rank: 2, mlbId: 592178 },
    { rank: 3, mlbId: 621043 },
  ])
})

test('parseRankedEntries does not run past its own entry into the next one\'s Person ref', () => {
  // Every fixture entry's own player ref is captured -- if the non-greedy
  // match instead ran forward to the LAST ref on the page, all three
  // entries would come back with entry 3's id (621043).
  const entries = parseRankedEntries(fixture)
  const ids = entries.map((e) => e.mlbId)
  assert.equal(new Set(ids).size, 3)
})

test('parseRankedEntries on a page with none of the expected markers (the real 2005-2008 shape) returns an empty array, not a throw', () => {
  assert.deepEqual(parseRankedEntries('<html><body>no prospects here</body></html>'), [])
})

test('assertContiguousRanks accepts a clean 1..3 season and returns its depth', () => {
  const entries = parseRankedEntries(fixture)
  assert.equal(assertContiguousRanks(entries, 2015), 3)
})

test('assertContiguousRanks throws on a gap (rank 2 missing) rather than silently accepting a short season', () => {
  const withGap = [
    { rank: 1, mlbId: 621439 },
    { rank: 3, mlbId: 621043 },
  ]
  assert.throws(() => assertContiguousRanks(withGap, 2015), /rank 2 missing/)
})

test('assertContiguousRanks throws on a duplicate rank', () => {
  const dup = [
    { rank: 1, mlbId: 621439 },
    { rank: 1, mlbId: 592178 },
  ]
  assert.throws(() => assertContiguousRanks(dup, 2015), /duplicate rank/)
})

test('assertContiguousRanks throws on a duplicate mlbId (two ranks resolving to the same player would mean the ref-matching drifted)', () => {
  const dup = [
    { rank: 1, mlbId: 621439 },
    { rank: 2, mlbId: 621439 },
  ]
  assert.throws(() => assertContiguousRanks(dup, 2015), /duplicate mlbId/)
})
