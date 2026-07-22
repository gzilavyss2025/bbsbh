import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rookieRecordFor, isActiveRookie, hasDebuted, showRookiePill } from '../src/api/rookies.js'

const DATA = {
  generatedAt: '2026-07-01',
  players: {
    111: { debutDate: '2026-04-05', rookieUntil: null }, // active rookie, still open
    222: { debutDate: '2019-06-01', rookieUntil: '2019-08-14' }, // debuted, rookie window closed
  },
}

// --- rookieRecordFor ---------------------------------------------------------

test('rookieRecordFor returns the record for a known personId', () => {
  assert.deepEqual(rookieRecordFor(DATA, 111), { debutDate: '2026-04-05', rookieUntil: null })
})

test('rookieRecordFor returns null for an undebuted/unknown personId', () => {
  assert.equal(rookieRecordFor(DATA, 999), null)
})

test('rookieRecordFor degrades to null on missing/empty data', () => {
  assert.equal(rookieRecordFor(null, 111), null)
  assert.equal(rookieRecordFor({ players: {} }, 111), null)
})

// --- isActiveRookie -----------------------------------------------------------

test('isActiveRookie is true only for an open (rookieUntil: null) record', () => {
  assert.equal(isActiveRookie(DATA, 111), true)
  assert.equal(isActiveRookie(DATA, 222), false)
})

test('isActiveRookie is false for a player with no record at all', () => {
  assert.equal(isActiveRookie(DATA, 999), false)
})

// --- hasDebuted -----------------------------------------------------------

test('hasDebuted is true for any record, open or closed', () => {
  assert.equal(hasDebuted(DATA, 111), true)
  assert.equal(hasDebuted(DATA, 222), true)
})

test('hasDebuted is false for a player with no record at all', () => {
  assert.equal(hasDebuted(DATA, 999), false)
})

// --- showRookiePill: the ROOKIE-pill visibility gate ---------------------------
// A MiLB roster/lineup surface must never show the ROOKIE pill, even for a
// player whose record is a genuinely still-open rookie window — DebutPill
// covers that surface instead (see TeamInfo.jsx/RosterPanel.jsx/EnteringReference.jsx).

test('showRookiePill shows for an active rookie on an MLB surface', () => {
  assert.equal(showRookiePill(DATA, 111, true), true)
})

test('showRookiePill is suppressed for the same active rookie on a MiLB surface', () => {
  assert.equal(showRookiePill(DATA, 111, false), false)
})

test('showRookiePill is false on MLB for a player whose rookie window already closed', () => {
  assert.equal(showRookiePill(DATA, 222, true), false)
})

test('showRookiePill is false on MiLB for a closed-window player too', () => {
  assert.equal(showRookiePill(DATA, 222, false), false)
})

test('showRookiePill is false for an undebuted player regardless of level', () => {
  assert.equal(showRookiePill(DATA, 999, true), false)
  assert.equal(showRookiePill(DATA, 999, false), false)
})

test('showRookiePill treats a missing/undefined isMlb as falsy (suppressed)', () => {
  assert.equal(showRookiePill(DATA, 111, undefined), false)
})
