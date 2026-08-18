import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useCalloutLedgerValue } from '../src/hooks/useCalloutLedger.js'
import { buildPreHalfCallouts } from '../src/api/prehalf-callouts.js'
import { buildBetweenInnings } from '../src/api/between-innings.js'
import { weekdayFromDate } from '../src/api/callout-notes.js'
import { buildFeed } from './fixtures/mini-game.js'

// The shown ledger and the two surfaces that read it. `rankNotes`'s own three
// rules are pinned in callout-repetition.test.js; this file pins the WIRING —
// that the ledger counts halves the way the decay rule assumes, and that a
// strip and a Between Innings card actually obey the counts they are handed.
//
// `useCalloutLedgerValue` is a hook, so it is exercised through one
// server-render — no DOM, no browser, still pure logic under test.

function ledgerFor(gamePk) {
  let value = null
  function Probe() {
    value = useCalloutLedgerValue(gamePk)
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  return value
}

test('the ledger never counts the half a note is sitting on', () => {
  const ledger = ledgerFor(700001)
  ledger.markShown([{ dedupeKey: 'dayOfWeek-away-2' }], 4)
  // Staging half 4 again — a re-render, a feed poll, a StrictMode double —
  // must not decay the note out from under the reader.
  assert.equal(ledger.countsFor(4).size, 0)
  assert.equal(ledger.countsFor(5).get('dayOfWeek-away-2'), 1)
})

test('the ledger counts distinct halves, not renders', () => {
  const ledger = ledgerFor(700002)
  for (let i = 0; i < 6; i++) ledger.markShown([{ dedupeKey: 'laboring-200' }], 2)
  assert.equal(ledger.countsFor(3).get('laboring-200'), 1)
  ledger.markShown([{ dedupeKey: 'laboring-200' }], 3)
  assert.equal(ledger.countsFor(4).get('laboring-200'), 2)
})

test('the ledger keys on dedupeKey, falling back to the text', () => {
  const ledger = ledgerFor(700003)
  ledger.markShown([{ text: 'Riding a 6-outing scoreless streak' }, null, { }], 0)
  assert.equal(ledger.countsFor(1).get('Riding a 6-outing scoreless streak'), 1)
  assert.equal(ledger.countsFor(1).size, 1)
})

test('the ledger ignores a marking with no half to attach it to', () => {
  const ledger = ledgerFor(700004)
  ledger.markShown([{ dedupeKey: 'laboring-200' }], undefined)
  assert.equal(ledger.countsFor(9).size, 0)
})

test('a new game starts an empty ledger', () => {
  const a = ledgerFor(700005)
  a.markShown([{ dedupeKey: 'starterRec-200' }], 0)
  const b = ledgerFor(700006)
  assert.equal(b.countsFor(4).size, 0)
})

// --- the surfaces that read it ------------------------------------------------

const GAME_DATE = '2026-07-07'
const DOW = weekdayFromDate(GAME_DATE)

function feedWithProbables() {
  const feed = buildFeed()
  feed.gameData.probablePitchers = { away: { id: 300 }, home: { id: 200 } }
  return feed
}

// A 1st-inning pool of three "the club is W-L when X" notes (one starterRec,
// two dayOfWeek) plus ONE note of another voice, scored so that the two
// dayOfWeek notes outscore it. Sorting alone would fill both strip slots with
// the same sentence shape.
const stripBundle = {
  away: { teamId: 158, name: 'Away Club' },
  home: { teamId: 138, name: 'Home Club' },
  starterRecords: { 200: { teamStarts: { w: 12, l: 5 } } },
  teamRecords: {
    away: {
      dayOfWeek: { [DOW]: { w: 11, l: 1 } },
      inningRuns: { 1: { f: 44, a: 12, g: 20 } },
    },
    home: { dayOfWeek: { [DOW]: { w: 1, l: 11 } } },
  },
}

const stripArgs = {
  feed: feedWithProbables(), bundle: stripBundle, inning: 1, half: 'top',
  revealedThrough: -1, gameDate: GAME_DATE,
}

test('the pre-half strip holds at most one "the club is W-L when X" note', () => {
  const strip = buildPreHalfCallouts(stripArgs)
  assert.deepEqual(strip.map((n) => n.kind), ['starterRec', 'inningRunDiff'])
  // …and the two dayOfWeek notes outscore the one that took the second slot,
  // so it is the record cap doing this and not the sort.
  const dow = strip.find((n) => n.kind === 'inningRunDiff')
  assert.ok(dow.score < 47)
})

test('a strip drops a once-per-game fact the reader has already been shown', () => {
  const shownCounts = new Map([['starterRec-200', 1]])
  const strip = buildPreHalfCallouts({ ...stripArgs, shownCounts })
  assert.ok(!strip.some((n) => n.kind === 'starterRec'))
  // The slot it held goes to the next voice, not to nothing.
  assert.deepEqual(strip.map((n) => n.kind), ['dayOfWeek', 'inningRunDiff'])
})

test('a Between Innings card drops the once-per-game facts already shown', () => {
  const bundle = {
    away: { teamId: 158, name: 'Away Club' },
    home: { teamId: 138, name: 'Home Club' },
    starterRecords: { 300: { teamStarts: { w: 12, l: 5 } }, 200: { teamStarts: { w: 9, l: 9 } } },
    teamRecords: {
      away: { dayOfWeek: { [DOW]: { w: 10, l: 2 } } },
      home: { dayOfWeek: { [DOW]: { w: 2, l: 10 } } },
    },
  }
  const args = {
    feed: feedWithProbables(), bundle, marginNotes: [], gameDate: GAME_DATE,
    inning: 1, half: 'top', revealedThrough: 0,
  }
  const fresh = buildBetweenInnings(args)
  assert.ok(fresh.some((c) => c.dedupeKey === 'starterRec-300'))
  assert.ok(fresh.some((c) => c.dedupeKey === 'dayOfWeek-away-' + DOW))

  const shownCounts = new Map([['starterRec-300', 1], [`dayOfWeek-away-${DOW}`, 1]])
  const later = buildBetweenInnings({ ...args, shownCounts })
  assert.ok(!later.some((c) => c.dedupeKey === 'starterRec-300'))
  assert.ok(!later.some((c) => c.dedupeKey === `dayOfWeek-away-${DOW}`))
  // The other club's copy of each fact has not been shown, so it still can.
  assert.deepEqual(
    later.map((c) => c.dedupeKey).sort(),
    ['dayOfWeek-home-' + DOW, 'starterRec-200'],
  )
})
