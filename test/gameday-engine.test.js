// #2747, row 2a: the renderless engine (src/screens/gameday/next/engine/GamedayEngine.jsx) replaces the
// hidden half page. Node cannot render a .jsx component, so the component's shape is pinned by reading
// the source (as test/gameday-half-report.test.js does for PlayByPlay); the held forward move is pure.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { forwardAdvance } from '../src/screens/gameday/next/steps/subStep.js'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const engine = read('src/screens/gameday/next/engine/GamedayEngine.jsx')
const parent = engine.slice(engine.indexOf('export function GamedayEngine'), engine.indexOf('function EngineReport'))
const child = engine.slice(engine.indexOf('function EngineReport'))

// The page turn used to hold the move; now the close-out does (ADR-0046): InningViewer.jsx's advance.
test('a forward half move is held while focus.closing is true, and goes once it is not', () => {
  const moves = []
  const held = forwardAdvance('Top 2nd', 2, true, (i) => moves.push(i))
  assert.equal(held.disabled, true)
  held.onClick()
  assert.deepEqual(moves, [], 'a tap during the close-out moves nothing')
  const free = forwardAdvance('Top 2nd', 2, false, (i) => moves.push(i))
  assert.equal(free.disabled, false)
  free.onClick()
  assert.deepEqual(moves, [2])
})

test('the page turn is gone from InningViewer: no turn status, no hold on it', () => {
  const code = read('src/screens/InningViewer.jsx')
  for (const gone of ['InningPageTurn', 'ReplayRail', 'renderInningPage', 'turnStatus', 'requestForwardHalf']) {
    assert.ok(!code.includes(gone), `InningViewer still names ${gone}`)
  }
  assert.match(code, /engine=\{<GamedayEngine\b/)
  assert.ok(!read('src/screens/gameday/next/GamedayNextPage.jsx').includes('<div hidden>'), 'the hidden wrapper is gone')
})

// The stale-overwrite case: the entering baseline (parent) and the live report (child) both reach
// reportLiveState. React runs a child's effects before its parent's in one commit, so the structure,
// not a guard, is what lets the live report win.
test('the live report wins over the entering baseline: baseline in the parent, live in a child the SealBox mounts', () => {
  assert.match(parent, /useEffect\(\(\) => \{\s*if \(startedRevealing\) return\s*reportLiveState\(idx, hasContent \? composeLive\(null/)
  assert.match(parent, /<SealBox forceRevealed=\{startedRevealing\} coverless>\s*\{\(\) => \(\s*<EngineReport\b/)
  assert.ok(!/useEffect/.test(parent.slice(parent.indexOf('<SealBox'))), 'no effect after the seal in the parent')
  assert.match(child, /snapshot = composeLive\(live, base\)/)
  assert.match(child, /reportLiveState\(idx, snapshot\)/)
  assert.equal(child.match(/useEffect\(/g).length, 4, 'one effect per report')
})

test('the baseline is the only top-level read; halfReport runs only in the child, inside the seal', () => {
  assert.ok(!parent.includes('halfReport('), 'halfReport in the parent would run before the reveal')
  assert.match(parent, /hasContent = revealed \|\| isNextToReveal/)
  assert.match(child, /halfReport\(feed, inning, half, battingSide, stepCap, \{ halfInProgress, windowed, focusStep, codeOf: \(t\) => EVENT_CODES\[t\] \}\)/)
  assert.ok(!/\[[^\]\n]*\bentries\b(?!\.)[^\]\n]*\]/.test(child), 'no dependency list names entries: that was the 264-render loop')
})

test('each report keeps PlayByPlay.jsx’s count-based dependencies; the commit goes once, on exhausted', () => {
  assert.match(child, /\[stepping, exhausted, effectiveCap, entries\.length\]/)
  assert.match(child, /\[revealedSteps, feed\]/)
  assert.match(child, /\[stepping, runsSoFar, hitsSoFar\]/)
  assert.match(child, /\[feed, inning, half, battingSide, effectiveCap, liveCap\]/)
  assert.match(child, /if \(exhausted\) \{?\s*commitReveal\(inning, half\)/)
})

// The open SealBox renders its own `.statgrid` div even though EngineReport returns null. In the shell's
// grid that div is an implicit 28px row that takes 36px from the stage (review of #2767), so the engine
// keeps its whole output in a hidden wrapper of its own.
test('the engine keeps its SealBox out of the shell grid: its output sits in a hidden wrapper', () => {
  assert.match(parent, /return \(\s*<div hidden>\s*<SealBox forceRevealed=\{startedRevealing\} coverless>/)
})
