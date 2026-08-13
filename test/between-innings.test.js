import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBetweenInnings, CARD_MAX, BETWEEN_INNINGS_ALLOWED_KINDS } from '../src/api/between-innings.js'
import { weekdayFromDate } from '../src/api/callout-notes.js'
import { buildFeed } from './fixtures/mini-game.js'

const GAME_DATE = '2026-07-07'
const DOW = weekdayFromDate(GAME_DATE)

function feedWithProbables() {
  const feed = buildFeed()
  feed.gameData.probablePitchers = { away: { id: 300 }, home: { id: 200 } }
  return feed
}

// starterRec (away #300 + home #200) + dayOfWeek (away + home) — always
// available for any half of this game, no marginNotes required.
const seasonContextBundle = {
  away: { teamId: 158, name: 'Away Club' },
  home: { teamId: 138, name: 'Home Club' },
  starterRecords: {
    300: { teamStarts: { w: 12, l: 5 } },
    200: { teamStarts: { w: 9, l: 9 } },
  },
  teamRecords: {
    away: { dayOfWeek: { [DOW]: { w: 10, l: 2 } } },
    home: { dayOfWeek: { [DOW]: { w: 2, l: 10 } } },
  },
}

test('buildBetweenInnings returns [] with no bundle', () => {
  const feed = feedWithProbables()
  assert.deepEqual(
    buildBetweenInnings({ feed, bundle: null, marginNotes: [], inning: 1, half: 'top', revealedThrough: 0 }),
    [],
  )
})

test('buildBetweenInnings drops a forbidden kind even when the caller supplies one', () => {
  const feed = feedWithProbables()
  const marginNotes = [
    { text: 'The Homes lead 4-2 entering the 8th', kind: 'leadAfterLive', score: 99, dedupeKey: 'x' },
    { text: 'Laboring: 24.7 pitches per inning', kind: 'laboring', score: 48, dedupeKey: 'laboring-200' },
    { text: 'Fastball down 2.3 mph', kind: 'veloDecay', score: 46, dedupeKey: 'veloDecay-200' },
    { text: 'Working a 3rd straight day', kind: 'penFatigue', score: 42, dedupeKey: 'penFatigue-201' },
  ]
  const cards = buildBetweenInnings({
    feed, bundle: seasonContextBundle, marginNotes, gameDate: GAME_DATE, inning: 1, half: 'top', revealedThrough: 0,
  })
  assert.ok(!cards.some((c) => c.kind === 'leadAfterLive'))
  assert.ok(cards.every((c) => BETWEEN_INNINGS_ALLOWED_KINDS.has(c.kind)))
})

test('buildBetweenInnings caps a rich pool at exactly CARD_MAX', () => {
  const feed = feedWithProbables()
  const marginNotes = [
    { text: 'Laboring: 24.7 pitches per inning', kind: 'laboring', score: 48, dedupeKey: 'laboring-200' },
    { text: 'Fastball down 2.3 mph', kind: 'veloDecay', score: 46, dedupeKey: 'veloDecay-200' },
    { text: 'Working a 3rd straight day', kind: 'penFatigue', score: 42, dedupeKey: 'penFatigue-201' },
  ]
  const cards = buildBetweenInnings({
    feed, bundle: seasonContextBundle, marginNotes, gameDate: GAME_DATE, inning: 1, half: 'top', revealedThrough: 0,
  })
  // 4 season-context (2 starterRec + 2 dayOfWeek) + 3 marginNotes = 7
  // candidates, still more than CARD_MAX.
  assert.equal(cards.length, CARD_MAX)
  for (let i = 1; i < cards.length; i++) assert.ok(cards[i - 1].score >= cards[i].score)
})

test('buildBetweenInnings returns fewer than CARD_MAX on a sparse pool, never padded', () => {
  const feed = buildFeed() // no probablePitchers -> starterRec skipped
  const sparse = {
    away: { teamId: 158, name: 'Away Club' },
    teamRecords: { away: { dayOfWeek: { [DOW]: { w: 10, l: 2 } } } },
  }
  const cards = buildBetweenInnings({
    feed, bundle: sparse, marginNotes: [], gameDate: GAME_DATE, inning: 1, half: 'top', revealedThrough: 0,
  })
  assert.equal(cards.length, 1)
  assert.equal(cards[0].kind, 'dayOfWeek')
})

test('buildBetweenInnings does not treat marginNotes[0] as special — it is eligible like any other note', () => {
  const feed = buildFeed() // no probablePitchers -> starterRec skipped
  const sparse = { away: { teamId: 158, name: 'Away Club' } } // no teamRecords -> dayOfWeek skipped too
  const marginNotes = [
    { text: 'Laboring: 24.7 pitches per inning', kind: 'laboring', score: 48, dedupeKey: 'laboring-200' },
  ]
  const cards = buildBetweenInnings({
    feed, bundle: sparse, marginNotes, gameDate: GAME_DATE, inning: 1, half: 'top', revealedThrough: 0,
  })
  assert.equal(cards.length, 1)
  assert.equal(cards[0].dedupeKey, marginNotes[0].dedupeKey)
})

// The spoiler invariant: a marginNotes-poor ("quiet") half and a
// marginNotes-rich ("loud") half sharing the same always-available
// season-context bundle return the SAME card count once both clear
// CARD_MAX — depth tracks total candidate availability, not how eventful
// the half was.
test('buildBetweenInnings returns the same depth for a quiet and a loud half once both clear CARD_MAX', () => {
  const feed = feedWithProbables()
  const quiet = [
    { text: 'Riding a 3-outing scoreless streak', kind: 'scorelessStreak', score: 32, dedupeKey: 'scorelessStreak-200' },
    { text: 'Homes are 14-9 in his road starts', kind: 'homeAway', score: 30, dedupeKey: 'homeAway-200' },
  ]
  const loud = [
    { text: 'Laboring: 24.7 pitches per inning', kind: 'laboring', score: 48, dedupeKey: 'laboring-200' },
    { text: 'Fastball down 2.3 mph', kind: 'veloDecay', score: 46, dedupeKey: 'veloDecay-200' },
    { text: 'Working a 3rd straight day', kind: 'penFatigue', score: 42, dedupeKey: 'penFatigue-201' },
    { text: 'Opponents hit .198 off him ahead', kind: 'leverage', score: 34, dedupeKey: 'leverage-200' },
    { text: 'The 2nd time he has reached double digits', kind: 'tenK', score: 33, dedupeKey: 'tenK-200' },
  ]
  const args = { feed, bundle: seasonContextBundle, gameDate: GAME_DATE, inning: 1, half: 'top', revealedThrough: 0 }
  const quietCards = buildBetweenInnings({ ...args, marginNotes: quiet })
  const loudCards = buildBetweenInnings({ ...args, marginNotes: loud })
  assert.equal(quietCards.length, CARD_MAX)
  assert.equal(loudCards.length, CARD_MAX)
  assert.equal(quietCards.length, loudCards.length)
})
