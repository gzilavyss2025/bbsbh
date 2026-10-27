// Gameday's checkpoint on screen (#2572 slices 3 to 5): the builder's spoiler footing, the last
// half's double rule and its "Close the book" gate, and the notes tab's absence with no bundle.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { checkpointMarkup } from '../src/screens/gameday/next/checkpoint/checkpointMarkup.js'
import { bookIsClosed } from '../src/components/inning/focus/beats.js'
import { selectFinalHalfIndex } from '../src/api/select.js'

const feed = (pk) => JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url)))
const F824 = feed(824716) // SEA@BOS, the round 2 design game: no callout bundle on file.
const F777 = feed(777747) // BOS@MIL: a walk-off in the bottom 10th.
// SealBox stand-in: a .jsx file cannot load here. Like the real one with forceRevealed, it calls the
// reveal function at once; `calls` counts how often the reveal-only read ran.
let calls = 0
const SealBox = ({ children }) => (calls++, children())
const abbr = { away: 'SEA', home: 'BOS' }
const html = (props) => {
  const el = checkpointMarkup(createElement, { SealBox, abbr, ...props })
  return el ? renderToStaticMarkup(el) : ''
}
const tabs = (s) => [...s.matchAll(/aria-pressed="(?:true|false)">([^<]+)</g)].map((m) => m[1])

test('the checkpoint mounts only for a half at or under revealedThrough', () => {
  calls = 0
  assert.equal(html({ feed: F824, inning: 2, half: 'top', mark: 1 }), '')
  assert.equal(html({ feed: F824, inning: 2, half: 'top', mark: null }), '')
  assert.equal(calls, 0, 'nothing reveal-only runs for a sealed half')
  const out = html({ feed: F824, inning: 2, half: 'top', mark: 2 })
  assert.equal(calls, 1)
  assert.match(out, /End of the top 2nd/)
})

test('824716 top 2nd: four labelled tabs (no notes bundle), every page in the DOM, the due-up names the next half', () => {
  const out = html({ feed: F824, inning: 2, half: 'top', mark: 2, notes: null, nextLabel: 'Bottom 2nd' })
  assert.deepEqual(tabs(out), ['Tally', 'Pitching', 'At-bats', 'Game'])
  assert.doesNotMatch(out, /Notes/)
  assert.equal((out.match(/class="gdcp__page/g) ?? []).length, 4)
  assert.match(out, /Due up · Bottom 2nd/)
  assert.doesNotMatch(out, /is-double/)
  // The phone shows one page: the tally by default, the one tapped otherwise.
  assert.match(out, /class="gdcp__page is-on" data-page="tally"/)
  const at = html({ feed: F824, inning: 2, half: 'top', mark: 2, page: 'atBats' })
  assert.match(at, /class="gdcp__page is-on" data-page="atBats"/)
})

test('824716 bottom 9th, the last half: the final line with the double rule, no due-up, Close the book', () => {
  const mark = selectFinalHalfIndex(F824)
  assert.equal(mark, 17)
  const out = html({ feed: F824, inning: 9, half: 'bottom', mark })
  assert.match(out, /<span>Final<\/span>/)
  assert.match(out, /class="is-double"/)
  assert.doesNotMatch(out, /Due up/)
  assert.equal(bookIsClosed(mark, selectFinalHalfIndex(F824)), true)
})

test('777747 bottom 9th of a game that goes on: not the final line, no Close the book (the 10th exists)', () => {
  const out = html({ feed: F777, inning: 9, half: 'bottom', mark: 17, abbr: { away: 'BOS', home: 'MIL' } })
  assert.match(out, /End of the bottom 9th/)
  assert.doesNotMatch(out, /Final/)
  assert.doesNotMatch(out, /is-double/)
  assert.equal(bookIsClosed(17, selectFinalHalfIndex(F777)), false)
})

// Stack review of #2667, 2026-10-27.
const lineCols = (s) => s.match(/<table class="gdcp__line"><thead><tr>(.*?)<\/tr>/)[1].match(/<th/g).length - 4

test('the line draws the game\'s regulation length: a 7-inning game has no dead 8th and 9th', () => {
  assert.equal(lineCols(html({ feed: F824, inning: 2, half: 'top', mark: 2 })), 9)
  const short = structuredClone(F824)
  short.liveData.linescore.scheduledInnings = 7
  assert.equal(lineCols(html({ feed: short, inning: 2, half: 'top', mark: 2 })), 7)
})

test('the page switch is the app\'s Segmented control (toggle Buttons), not a third control', () => {
  const out = html({ feed: F824, inning: 2, half: 'top', mark: 2 })
  assert.doesNotMatch(out, /role="tab"/)
  assert.match(out, /role="group" aria-label="Checkpoint pages" class="segmented segmented--fill gdcp__tabs"/)
  assert.equal((out.match(/aria-pressed="true"/g) ?? []).length, 1)
  assert.deepEqual([...out.matchAll(/aria-pressed="(?:true|false)">([^<]+)</g)].map((m) => m[1]), ['Tally', 'Pitching', 'At-bats', 'Game'])
})

test('the notes page hands the notes it draws to `Seen`, which records them in the callout ledger', () => {
  const note = { kind: 'workload', text: 'He threw 30 pitches yesterday.', dedupeKey: 'wl-1' }
  const seen = []
  const Seen = ({ notes, on }) => (seen.push({ keys: notes.map((n) => n.dedupeKey), on }), null)
  const out = html({ feed: F824, inning: 2, half: 'top', mark: 2, notes: { bundle: {}, marginNotes: [note] }, Seen })
  assert.match(out, /Notes/)
  assert.deepEqual(seen, [{ keys: ['wl-1'], on: false }])
  seen.length = 0
  html({ feed: F824, inning: 2, half: 'top', mark: 2, notes: { bundle: {}, marginNotes: [note] }, Seen, page: 'facts' })
  assert.deepEqual(seen, [{ keys: ['wl-1'], on: true }])
})
