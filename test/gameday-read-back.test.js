import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { back, replay, rest } from '../src/screens/gameday/next/stage/tapRule.js'
import { readBackAfter, readBackStepOf } from '../src/screens/gameday/next/steps/subStep.js'
import { rewindTo } from '../src/screens/gameday/next/panels/panelData.js'
import { stepCutAtBatIndex } from '../src/api/gameday/stepCut.js'
import { openAtBat } from '../src/api/gameday/subSteps.js'

const feed = JSON.parse(fs.readFileSync(new URL('./fixtures/game-777747.gameday.json', import.meta.url), 'utf8'))
const plays = feed.liveData.plays.allPlays
const top1 = plays.filter((p) => p.about.inning === 1 && p.about.halfInning === 'top')

test('back from a replay returns the stage to where the reader was, revealing nothing', () => {
  const atRest = rest(3, 0)
  assert.equal(back(replay(atRest, 1, false)).shown, null)
  const inside = { ...rest({ count: 2, sub: 1, last: 1 }, 0) }
  assert.deepEqual(back(replay(inside, 1, false)).shown, { count: 2, sub: 1, last: 1 })
  assert.equal(back(replay(atRest, 1, false)).playing, false)
})

test('a chip maps to its read-back step, and the walk resumes at the at-bat after it', () => {
  assert.equal(readBackStepOf([{ atBatIndex: 0 }, { atBatIndex: 1 }, { atBatIndex: 2 }], 1), 1)
  assert.equal(readBackStepOf([{ atBatIndex: 0 }], 9), null)
  const first = top1[0].about.atBatIndex
  const at = readBackAfter(feed, 1, 'top', first)
  assert.equal(openAtBat(feed, 1, 'top', at + 1).card.atBatIndex > first, true)
})

test('rewinding a finished half to an at-bat counts only the runs and hits through it', () => {
  const last = top1.at(-1)
  const r = rewindTo(feed, 1, 'top', last.about.atBatIndex)
  assert.equal(r.mark, -1)
  assert.equal(stepCutAtBatIndex(feed, 1, 'top', r.step), last.about.atBatIndex)
  assert.equal(r.runsInProgress.runs, last.result.awayScore)
  const none = rewindTo(feed, 1, 'top', -1)
  assert.deepEqual([none.step, none.runsInProgress.runs], [0, 0])
})
