// The at-bat replay's count and bases (lib/pitcherCard/replaySteps.js, fed by
// pitchInfo.js's per-pitch count and halfInningFeed.js's basesBefore/After).
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { pitchCardInfo } from '../src/api/playbyplay/pitchInfo.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { battingSideOf, runnersOnBase } from '../src/api/expresslane/runners.js'
import { basesAt, countAt, replaySteps } from '../src/lib/pitcherCard/replaySteps.js'

const FEED = JSON.parse(readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'))

// A plate appearance shaped like gamePk 823430, top 7 (Brady House): an
// automatic strike (a pitch-timer violation) moves the count with no pitch.
const ev = (over) => ({ isPitch: true, details: { call: { code: 'B', description: 'Ball' } }, ...over })
const AUTO = {
  isPitch: false,
  details: { call: { code: 'AC', description: 'Automatic Strike' } },
  count: { balls: 1, strikes: 1 },
}
const pa = [
  ev({ pitchNumber: 1, count: { balls: 1, strikes: 0 } }),
  ev({ pitchNumber: 2, count: { balls: 1, strikes: 1 } }),
  AUTO,
  ev({ pitchNumber: 3, count: { balls: 1, strikes: 2 }, details: { call: { code: 'S', description: 'Swinging Strike' } } }),
]

test('each pitch carries the count from its own event, not from its index', () => {
  const { pitchDetails } = pitchCardInfo({}, { playEvents: pa })
  assert.deepEqual(pitchDetails.map((p) => [p.no, p.balls, p.strikes]), [[1, 1, 0], [2, 1, 1], [3, 1, 2]])
})

test('a pitch the feed gave no count keeps null, and the model draws no strip', () => {
  const { pitchDetails } = pitchCardInfo({}, { playEvents: [ev({ pitchNumber: 1 })] })
  assert.equal(pitchDetails[0].balls, null)
  assert.equal(replaySteps(pitchDetails, [{ no: 1 }], null, null), null)
})

test('steps are keyed by pitch number, so a pitch with no tracking does not shift them', () => {
  const { pitchDetails } = pitchCardInfo({}, { playEvents: pa })
  const scene = [{ no: 1 }, { no: 3 }] // pitch 2 had no tracking
  const model = replaySteps(pitchDetails, scene, [], [1])
  assert.deepEqual(countAt(model, 3, true), { no: 3, balls: 1, strikes: 2 })
  // Before pitch 3 lands the strip still reads what pitch 2 left, though pitch 2 is not in the scene.
  assert.deepEqual(countAt(model, 3, false), { no: 2, balls: 1, strikes: 1 })
  assert.deepEqual(countAt(model, 1, false), { balls: 0, strikes: 0 })
})

test('the runners change only when the last pitch of the scene lands', () => {
  const model = replaySteps(pitchCardInfo({}, { playEvents: pa }).pitchDetails, [{ no: 1 }, { no: 3 }], [1], [1, 2])
  assert.deepEqual(basesAt(model, 1, true), [1])
  assert.deepEqual(basesAt(model, 3, false), [1])
  assert.deepEqual(basesAt(model, 3, true), [1, 2])
})

test('a card with no bases snapshot draws no diamond', () => {
  const model = replaySteps(pitchCardInfo({}, { playEvents: pa }).pitchDetails, [{ no: 1 }], undefined, undefined)
  assert.equal(basesAt(model, 1, true), null)
})

test('basesBefore/basesAfter match runnersOnBase over a feed capped at the card', () => {
  let checked = 0
  for (let inning = 1; inning <= 12; inning += 1) {
    for (const half of ['top', 'bottom']) {
      const side = battingSideOf(half)
      const cards = computeHalfInningFeed(FEED, inning, half, side)
      cards.forEach((card, i) => {
        if (card.kind !== 'atbat' || !card.basesAfter) return
        const held = (entries) => [...new Set(runnersOnBase(entries).map((r) => r.base))].sort()
        assert.deepEqual(card.basesAfter, held(computeHalfInningFeed(FEED, inning, half, side, i + 1)), `after ${inning} ${half} #${i}`)
        assert.deepEqual(card.basesBefore, held(computeHalfInningFeed(FEED, inning, half, side, i)), `before ${inning} ${half} #${i}`)
        checked += 1
      })
    }
  }
  assert.ok(checked > 40, `checked ${checked} cards`)
})
