import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchRookieRecord,
  fetchRookiesData,
  hasDebuted,
  isActiveRookie,
  rookieRecordFor,
  rookieShardKey,
  rookiesForGameSeason,
  showRookiePill,
} from '../src/api/rookies.js'

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

// --- the compact status map + the record shards ------------------------------
// The app no longer reads the 1.2 MB master file. The pills read a compact
// whole-league status map (1 = rookie window open, 0 = closed) and the player
// page reads one id-sharded record. Every predicate above answers over EITHER
// shape, which is what lets the two files share these functions.

const STATUS = { generatedAt: '2026-08-07', players: { 111: 1, 222: 0 } }

test('the predicates read the compact status encoding as well as a full record', () => {
  assert.equal(isActiveRookie(STATUS, 111), true)
  assert.equal(isActiveRookie(STATUS, 222), false)
  assert.equal(isActiveRookie(STATUS, 999), false)
  assert.equal(hasDebuted(STATUS, 111), true)
  assert.equal(hasDebuted(STATUS, 222), true)
  assert.equal(hasDebuted(STATUS, 999), false)
  assert.equal(showRookiePill(STATUS, 111, true), true)
  assert.equal(showRookiePill(STATUS, 111, false), false)
})

test('rookieShardKey buckets a personId into a padded two-digit shard', () => {
  assert.equal(rookieShardKey(660271), '71')
  assert.equal(rookieShardKey('660200'), '00')
  assert.equal(rookieShardKey(605), '05')
})

test('fetchRookieRecord reads only that player\'s shard and caches it', async (t) => {
  const urls = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    urls.push(url)
    return {
      ok: true,
      status: 200,
      json: async () => ({ players: { 660271: { debutDate: '2019-05-01', rookieUntil: null } } }),
    }
  })
  assert.deepEqual(await fetchRookieRecord(660271), {
    debutDate: '2019-05-01',
    rookieUntil: null,
  })
  assert.deepEqual(urls, ['/data/rookies/records/71.json'])
  await fetchRookieRecord(660271)
  assert.equal(urls.length, 1)
})

test('fetchRookieRecord degrades to null when the shard is missing', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }))
  assert.equal(await fetchRookieRecord(123456), null)
})

test('fetchRookiesData degrades to an empty status map when the file is missing', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }))
  assert.deepEqual(await fetchRookiesData(), { generatedAt: null, players: {} })
})

// --- rookiesForGameSeason: the flag means "under the limit TODAY" ------------

test('rookiesForGameSeason drops the data for a game from another season', () => {
  assert.equal(rookiesForGameSeason(DATA, '1927', 2026), null)
  assert.equal(showRookiePill(rookiesForGameSeason(DATA, '1927', 2026), 111, true), false)
})

test('rookiesForGameSeason keeps the data for a current-season game', () => {
  assert.equal(rookiesForGameSeason(DATA, '2026', 2026), DATA)
  assert.equal(showRookiePill(rookiesForGameSeason(DATA, '2026', 2026), 111, true), true)
})

test('rookiesForGameSeason keeps today\'s behaviour for a feed with no season', () => {
  assert.equal(rookiesForGameSeason(DATA, null, 2026), DATA)
  assert.equal(rookiesForGameSeason(null, null, 2026), null)
})

test('rookiesForGameSeason compares to the status file\'s own season stamp, not the calendar', () => {
  const stamped = { ...DATA, season: 2026 }
  // January 2027: last season's games still get the data; other seasons do not.
  assert.equal(rookiesForGameSeason(stamped, '2026', 2027), stamped)
  assert.equal(rookiesForGameSeason(stamped, '2027', 2027), null)
  assert.equal(rookiesForGameSeason(stamped, '1927', 2027), null)
})
