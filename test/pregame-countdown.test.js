import assert from 'node:assert/strict'
import test from 'node:test'
import { selectHasFirstPitch } from '../src/api/playbyplay/firstPitch.js'
import { accessiblePregameCountdown, pregameCountdown } from '../src/lib/time/pregameCountdown.js'

const START = '2026-08-06T18:10:00Z'
const START_MS = Date.parse(START)

test('pregameCountdown formats the absolute time remaining as hand-set plates', () => {
  assert.deepEqual(pregameCountdown(START, START_MS - ((2 * 60 + 3) * 60 + 4) * 1000), {
    kind: 'countdown',
    totalSeconds: 7384,
    hours: '02',
    minutes: '03',
    seconds: '04',
  })
})

test('pregameCountdown rounds a fractional final second up', () => {
  assert.deepEqual(pregameCountdown(START, START_MS - 1), {
    kind: 'countdown',
    totalSeconds: 1,
    hours: '00',
    minutes: '00',
    seconds: '01',
  })
})

test('pregameCountdown stops at scheduled time instead of becoming negative', () => {
  assert.deepEqual(pregameCountdown(START, START_MS), { kind: 'passed' })
  assert.deepEqual(pregameCountdown(START, START_MS + 30_000), { kind: 'passed' })
})

test('pregameCountdown fails safely when the feed has no usable start time', () => {
  for (const value of [null, undefined, '', 'not-a-date']) {
    assert.deepEqual(pregameCountdown(value, START_MS), { kind: 'tbd' })
  }
})

test('accessible countdown changes by the minute rather than every second', () => {
  const atNineteenMinutes = {
    kind: 'countdown',
    totalSeconds: 18 * 60 + 42,
    hours: '00',
    minutes: '18',
    seconds: '42',
  }
  assert.equal(accessiblePregameCountdown(atNineteenMinutes), 'First pitch is scheduled in 19 minutes.')
  assert.equal(
    accessiblePregameCountdown({ ...atNineteenMinutes, totalSeconds: 18 * 60 + 2 }),
    'First pitch is scheduled in 19 minutes.',
  )
  assert.equal(
    accessiblePregameCountdown({ ...atNineteenMinutes, totalSeconds: 42 }),
    'First pitch is scheduled in less than a minute.',
  )
})

test('selectHasFirstPitch ignores MLB Warmup until a real pitch event exists', () => {
  const feed = {
    gameData: { status: { abstractGameState: 'Live', detailedState: 'Warmup' } },
    liveData: {
      plays: {
        allPlays: [{ playEvents: [{ isPitch: false, details: { eventType: 'game_advisory' } }] }],
      },
    },
  }
  assert.equal(selectHasFirstPitch(feed), false)
  feed.liveData.plays.allPlays.push({ playEvents: [{ isPitch: true }] })
  assert.equal(selectHasFirstPitch(feed), true)
})

test('selectHasFirstPitch treats a sparse final feed as past pregame', () => {
  assert.equal(selectHasFirstPitch({ gameData: { status: { abstractGameState: 'Final' } } }), true)
})
