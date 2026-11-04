// Slice 2 of the notification cards (ADR-0113): the tab names the event, the club is a logo,
// the code chips are gone. Source-text pins for the markup, plain asserts for the copy.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { headshotSources, coachHeadshotUrl } from '../src/lib/teams.js'
import { TABS } from '../src/components/playbyplay/cardCopy.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const code = (rel) => src(rel).replace(/^\s*\/\/.*$/gm, '')

test('tabs name the event and never the club', () => {
  assert.deepEqual(Object.values(TABS), [
    'Now batting', 'Now pitching', 'Pitching', 'Pinch running', 'Departing', 'Final line for', 'Mound visit', 'Ejection',
  ])
  assert.doesNotMatch(code('components/playbyplay/PitcherNotice.jsx'), /for the \$\{/, 'PitcherNotice drops the team name from the tab')
})

test('the ejection card shows the ejected person from entry.playerId (coach rung)', () => {
  // A manager has no silo photo; every chain PitcherPhoto walks ends on the coach rung.
  assert.equal(headshotSources(123, { mlb: true }).at(-1), coachHeadshotUrl(123))
  assert.deepEqual(headshotSources(123, { coach: true }), [coachHeadshotUrl(123)])
  assert.match(code('components/playbyplay/PitcherNotice.jsx'), /if \(bare\) return null/, 'bare: no monogram or logo box')
})

test('EVENT_CODES lives in cardCopy.js, for the trail and the scorebook', () => {
  assert.match(code('components/playbyplay/cardCopy.js'), /export const EVENT_CODES/)
})
