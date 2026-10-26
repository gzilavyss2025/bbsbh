// The moments engine (#2608): score one revealed play. Pinned on three trimmed
// real games (docs/test-games.md; built by .scratch/gameday-engine/build-fixture.mjs,
// each with the trimmed /winProbability array):
//  - 777747 BOS@MIL: ab77, bottom 10th, Yelich's walk-off grand slam.
//  - 778442 ATH@COL: ab9, top 2nd, a 5-4-3 triple play; ab51 a 425-ft home run;
//    ab75 a 101.7-mph pitch.
//  - 778501 CHC@ATH: ab84, top 8th, the triple that completes Carson Kelly's cycle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { momentsForPlay, levelFor, CUTOFFS } from '../src/api/gameday/moments/moments.js'

const load = (pk) =>
  JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url), 'utf8'))
const g777747 = load(777747)
const g778442 = load(778442)
const g778501 = load(778501)
// A reader past the whole game.
const ALL = { inning: 20, half: 'bottom', revealedThrough: 99 }
const at = (feed, ab, opts = {}) => momentsForPlay(feed, ab, { ...ALL, winProb: feed.winProbability, ...opts })
const families = (ms) => ms.map((m) => m.family)

test('a walk-off grand slam is both, and reaches the Quiet level', () => {
  const ms = at(g777747, 77)
  assert.ok(families(ms).includes('walkOff'))
  assert.ok(families(ms).includes('grandSlam'))
  assert.equal(levelFor(ms[0].score), 'quiet')
})

test('an ordinary play holds no moment', () => {
  assert.deepEqual(at(g777747, 0), [])
  assert.deepEqual(at(g778442, 10), [])
})

test('a home run that does not take the lead in the last inning is no walk-off', () => {
  // 778442 ab13 is a bottom-2nd home run: not the last regulation inning.
  assert.equal(families(at(g778442, 13)).includes('walkOff'), false)
})

test('a triple play and a cycle are rare events', () => {
  assert.ok(families(at(g778442, 9)).includes('triplePlay'))
  const cycle = at(g778501, 84).find((m) => m.family === 'cycle')
  assert.equal(cycle.facts.batter.name, 'Carson Kelly')
  // His earlier hits do not complete anything.
  const kellyEarlier = g778501.liveData.plays.allPlays.filter(
    (p) => p.matchup.batter.id === cycle.facts.batter.id && p.about.atBatIndex < 84,
  )
  for (const p of kellyEarlier) assert.equal(families(at(g778501, p.about.atBatIndex)).includes('cycle'), false)
})

test('Statcast kinds fire past their measured floors only', () => {
  const far = at(g778442, 51).find((m) => m.family === 'hitFar')
  assert.equal(far.facts.value, 425)
  assert.equal(levelFor(far.score), 'normal')
  const fast = at(g778442, 75).find((m) => m.family === 'thrownFast')
  assert.equal(fast.facts.value, 101.7)
  assert.equal(fast.score, 55) // past p99.9: the whole magnitude
})

test('the odds swing is the change from the play before, and none without the endpoint', () => {
  const swing = at(g777747, 64).find((m) => m.family === 'oddsSwing')
  assert.ok(swing.facts.swing >= 22)
  assert.equal(levelFor(swing.score), 'quiet')
  // A MiLB park: no /winProbability. No odds moment, no throw.
  assert.equal(families(at(g777747, 64, { winProb: null })).includes('oddsSwing'), false)
})

test('a milestone fires on the play that reaches it, and not before', () => {
  const yelich = g777747.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 77).matchup.batter.id
  const milestones = { [yelich]: { stat: 'homeRuns', remaining: 1, threshold: 400, label: 'HR' } }
  const m = at(g777747, 77, { milestones }).find((x) => x.family === 'milestone')
  assert.equal(m.facts.threshold, 400)
  assert.equal(levelFor(m.score), 'quiet')
  const notYet = { [yelich]: { stat: 'homeRuns', remaining: 2, threshold: 400, label: 'HR' } }
  assert.equal(families(at(g777747, 77, { milestones: notYet })).includes('milestone'), false)
})

test("a pitcher's strikeout milestone counts his strikeouts tonight", () => {
  const plays = g778442.liveData.plays.allPlays
  const k = plays.find((p) => p.about.atBatIndex === 75)
  const pitcher = k.matchup.pitcher.id
  const ks = plays.filter((p) => p.about.atBatIndex <= 75 && p.matchup.pitcher.id === pitcher && /^strikeout/.test(p.result.eventType)).length
  const milestones = { [pitcher]: { stat: 'strikeOuts', remaining: ks, threshold: 1000, label: 'K' } }
  assert.ok(families(at(g778442, 75, { milestones })).includes('milestone'))
})

test('the cut-offs: Quiet over Normal over Lots', () => {
  assert.ok(CUTOFFS.quiet > CUTOFFS.normal && CUTOFFS.normal > CUTOFFS.lots)
  assert.equal(levelFor(CUTOFFS.quiet), 'quiet')
  assert.equal(levelFor(CUTOFFS.quiet - 1), 'normal')
  assert.equal(levelFor(CUTOFFS.normal - 1), 'lots')
})

test('a play that is not on screen answers null', () => {
  // Reader in the bottom 10th of 777747 at step 2: the placed runner and ab74.
  assert.equal(momentsForPlay(g777747, 77, { inning: 10, half: 'bottom', step: 2, revealedThrough: 18 }), null)
  assert.ok(momentsForPlay(g777747, 77, { inning: 10, half: 'bottom', step: null, revealedThrough: 18 }).length > 0)
  // A play in a later half than the reader's.
  assert.equal(momentsForPlay(g777747, 77, { inning: 9, half: 'bottom', revealedThrough: 18 }), null)
  // A half past revealedThrough + 1.
  assert.equal(momentsForPlay(g777747, 77, { inning: 10, half: 'bottom', revealedThrough: 10 }), null)
})

test('no field reads past the play', () => {
  const before = at(g778442, 9)
  const later = structuredClone(g778442)
  for (const p of later.liveData.plays.allPlays) {
    if (p.about.atBatIndex > 9) p.result = { eventType: 'home_run', rbi: 4, homeScore: 99, awayScore: 0 }
  }
  for (const e of later.winProbability) if (e.about.atBatIndex > 9) e.homeTeamWinProbability = 1
  assert.deepEqual(at(later, 9), before)
})

test('missing data never throws', () => {
  assert.equal(momentsForPlay({}, 0, ALL), null)
  assert.equal(momentsForPlay(g778442, null, ALL), null)
  const bare = structuredClone(g778442)
  for (const p of bare.liveData.plays.allPlays) p.playEvents = []
  assert.doesNotThrow(() => at(bare, 51))
})
