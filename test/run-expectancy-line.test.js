import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runExpectancyLine, runsWord } from '../src/api/playbyplay/runExpectancyLine.js'

// #2973: the innings viewer's one muted line under the newest revealed at-bat.
const table = JSON.parse(readFileSync(new URL('../public/data/run-expectancy.json', import.meta.url)))
const play = (outs, bases = {}) => ({ count: { outs }, matchup: { ...bases } })
const on = { id: 1 }

test('runner on 2nd, 1 out reads the RE24 cell to one decimal, leading dot', () => {
  // re24["2-1"] = 34292 / 45143 = 0.76 (checked 2026-11-06)
  assert.equal(runExpectancyLine(play(1, { postOnSecond: on }), table), 'About .8 runs expected.')
})

test('nobody on, 1 out', () => {
  assert.equal(runExpectancyLine(play(1), table), 'About .3 runs expected.')
})

test('bases loaded, nobody out goes past one run', () => {
  assert.match(runExpectancyLine(play(0, { postOnFirst: on, postOnSecond: on, postOnThird: on }), table), /^About [12]\.\d runs expected\.$/)
})

test('a play that ends the half gets no line', () => {
  assert.equal(runExpectancyLine(play(3), table), null)
})

test('no table or no play gets no line', () => {
  assert.equal(runExpectancyLine(play(1), null), null)
  assert.equal(runExpectancyLine(null, table), null)
  assert.equal(runExpectancyLine({ matchup: {} }, table), null)
})

test('runsWord drops the leading zero and keeps one decimal', () => {
  assert.equal(runsWord(0.76), '.8')
  assert.equal(runsWord(0.04), '.0')
  assert.equal(runsWord(0.96), '1.0')
  assert.equal(runsWord(2.27), '2.3')
})
