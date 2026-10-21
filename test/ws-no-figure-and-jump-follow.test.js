// Two fixes shipped without a test (PRs #2391, #2382). The suite has no JSX loader, so the
// components are pinned the way the suite pins them elsewhere: by reading their source.
//   1. A missing figure draws a dash AND says "no figure" to a screen reader.
//   2. A reader's own move (wheel, touch, key, pointer) clears the jump bar's tapped key,
//      so the mark follows the page again.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { currentSection } from '../src/lib/jumpbar/spy.js'

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')
const NONE_MARKUP = /—<span className="sr-only"> no figure<\/span>/

test('PitchByPitch, FilmMeeting, ParkFit and the comparison ledgers say "no figure" beside the dash', () => {
  for (const f of ['PitchByPitch', 'FilmMeeting']) {
    assert.match(src(`components/worldseries/cards/scouting/${f}.jsx`), NONE_MARKUP, f)
  }
  // The comparison ledgers' dash lives in the shared PairLedger (#2455); ComparisonLedger re-exports it.
  assert.match(src('components/ui/table/PairLedger.jsx'), NONE_MARKUP, 'PairLedger')
  assert.match(src('components/worldseries/cards/scouting/ComparisonLedger.jsx'), /export \{ NO_FIGURE \}/)
  // GloveLegs and NineKeys draw the ledger's one NO_FIGURE for a null figure.
  assert.match(src('components/worldseries/cards/scouting/GloveLegs.jsx'), /if \(v == null\) return NO_FIGURE/)
  assert.match(src('components/worldseries/cards/scouting/NineKeys.jsx'), /rank == null \? NO_FIGURE :/)
  // ParkFit draws it for a direction under the carry floor.
  assert.match(src('components/worldseries/cards/scouting/ParkFit.jsx'), /v == null \? NO_FIGURE :/)
})

test('PitchByPitch draws the no-figure dash for a null figure, never a number', () => {
  const s = src('components/worldseries/cards/scouting/PitchByPitch.jsx')
  assert.match(s, /x == null \? NONE :/)
  assert.match(s, /none: <span className="ww-pitch__even">\{NONE\}<\/span>/)
})

test('a reader move clears the tapped key: all four moves, listened to on mount', () => {
  const s = src('components/chrome/HubTabBar.jsx')
  assert.match(s, /const MOVES = \['wheel', 'touchstart', 'keydown', 'pointerdown'\]/)
  assert.match(s, /tapKeyRef\.current = null\s*\n\s*\}\s*\n\s*for \(const e of MOVES\) window\.addEventListener\(e, onMove, \{ passive: true \}\)/)
  assert.match(s, /for \(const e of MOVES\) window\.removeEventListener\(e, onMove\)/)
})

test('once the tapped key is cleared, the later card of a tie wins and the mark follows the page', () => {
  const pair = [
    { key: 'a', top: -300 },
    { key: 'b', top: 10 },
    { key: 'c', top: 10 },
  ]
  assert.equal(currentSection(pair, { line: 24, prefer: 'b' }), 'b')
  assert.equal(currentSection(pair, { line: 24, prefer: null }), 'c')
  // A wheel scroll then moves the line past c: c, not the stale tap, is current.
  const scrolled = pair.map((s) => ({ ...s, top: s.top - 400 }))
  assert.equal(currentSection([...scrolled, { key: 'd', top: 0 }], { line: 24, prefer: null }), 'd')
})
