import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cleanNetworkName,
  fetchGameBroadcast,
  nationalName,
  summarizeBroadcasts,
} from '../src/api/broadcast.js'
import { normalizeGame } from '../src/api/schedule.js'

// The shape statsapi's `hydrate=broadcasts(all)` really returns, trimmed to
// the fields the projection keeps. Every literal below is copied from a live
// response (2026-08-08 MLB slate; AA gamePk 818035 for the minors case), not
// invented — this feed is undocumented and guessing at it is how a selector
// starts reading a field that never arrives.
const tv = (name, homeAway, isNational = false) => ({ name, type: 'TV', isNational, homeAway })
const radio = (name, homeAway) => ({ name, type: 'AM', isNational: false, homeAway })

test('summarizeBroadcasts orders national, then home, then away', () => {
  const out = summarizeBroadcasts([
    tv('BravesVision', 'away'),
    tv('FS1', 'home', true),
    tv('YES', 'home'),
  ])
  assert.equal(out, 'FS1 · YES · BravesVision')
})

// A national entry is listed once per market side. Reporting it twice is what
// the dedupe exists for; it is not a hypothetical (FS1 and FOX both arrive
// doubled on a real slate).
test('summarizeBroadcasts reports a doubled national entry once', () => {
  const out = summarizeBroadcasts([tv('FS1', 'home', true), tv('FS1', 'away', true)])
  assert.equal(out, 'FS1')
})

// Radio is a real broadcast but not the one this fact answers: the flagship
// AM/FM stations outnumber the TV entries 2:1 on a typical game and would bury
// the network a viewer is looking for.
test('summarizeBroadcasts leaves radio out', () => {
  const out = summarizeBroadcasts([
    radio('WFAN 660/101.9 FM', 'home'),
    tv('YES', 'home'),
    radio('680 AM/93.7 FM The Fan', 'away'),
  ])
  assert.equal(out, 'YES')
})

// Out-of-market subscription packages are never themselves the broadcast.
// statsapi doesn't list MLB.TV on an MLB game, but it does list MiLB.TV on a
// minor-league one — the same kind of thing, filtered the same way.
test('summarizeBroadcasts drops the streaming packages', () => {
  const out = summarizeBroadcasts([
    tv('MiLB.TV', 'home'),
    tv('MiLB.TV', 'away'),
    tv('Bally Sports Live', 'home'),
  ])
  assert.equal(out, 'Bally Sports Live')
})

test('a game carried only by a package produces no fact at all', () => {
  assert.equal(summarizeBroadcasts([tv('MiLB.TV', 'home'), tv('MLB.TV', 'away')]), '')
  assert.equal(nationalName([tv('ESPN Unlmtd', 'home', true)]), '')
})

// Linear ESPN is a real national broadcast and must keep flagging one — the
// filter is on the "Unlmtd" tier alone, matched case-insensitively.
test('plain ESPN still reports as the national network', () => {
  assert.equal(nationalName([tv('ESPN', 'home', true)]), 'ESPN')
})

test('nationalName is empty for a regional-only game', () => {
  assert.equal(nationalName([tv('YES', 'home'), tv('BravesVision', 'away')]), '')
})

// The two trims, both against strings this feed really returns. The simulcast
// one is load-bearing beyond readability: lib/broadcastLogos.js is keyed
// 'fox', so an untrimmed "FOX / FOX ONE" would drop the slate card back to
// its plain-text glyph on exactly the games most likely to carry a wordmark.
test('cleanNetworkName trims a simulcast to the name a viewer knows', () => {
  assert.equal(cleanNetworkName('FOX / FOX ONE'), 'FOX')
  assert.equal(nationalName([tv('FOX / FOX ONE', 'home', true)]), 'FOX')
})

test('cleanNetworkName drops a club feed’s sponsor clause', () => {
  assert.equal(cleanNetworkName('Brewers.TV Presented by Potawatomi Sportsbook'), 'Brewers.TV')
  assert.equal(cleanNetworkName('Padres.TV Presented by UC San Diego Health'), 'Padres.TV')
  assert.equal(cleanNetworkName('Marlins.TV presented by Werner, Hoffman, Greig & Garcia'), 'Marlins.TV')
})

test('cleanNetworkName leaves an ordinary name alone', () => {
  assert.equal(cleanNetworkName('SportsNet Pittsburgh'), 'SportsNet Pittsburgh')
  assert.equal(cleanNetworkName('NESN'), 'NESN')
})

test('an empty or absent broadcast list degrades to no fact', () => {
  assert.equal(summarizeBroadcasts(undefined), '')
  assert.equal(summarizeBroadcasts([]), '')
  assert.equal(nationalName(undefined), '')
})

// The slate reads the national assignment off its OWN schedule request rather
// than a second call, which only works if normalizeGame carries it through.
test('normalizeGame carries the national network off the hydrated schedule row', () => {
  const game = normalizeGame(
    {
      gamePk: 823188,
      officialDate: '2026-08-08',
      teams: { away: { team: { id: 1 } }, home: { team: { id: 2 } } },
      broadcasts: [tv('FOX / FOX ONE', 'home', true), tv('FOX / FOX ONE', 'away', true)],
    },
    1,
  )
  assert.equal(game.nationalBroadcast, 'FOX')
})

test('normalizeGame leaves the national network empty on a row with no broadcasts', () => {
  const game = normalizeGame(
    { gamePk: 1, teams: { away: { team: { id: 1 } }, home: { team: { id: 2 } } } },
    11,
  )
  assert.equal(game.nationalBroadcast, '')
})

// One request per gamePk, shared across callers — a live Refresh re-runs the
// lineup page's fetch on every feed change, and a broadcast assignment does
// not move mid-game.
test('fetchGameBroadcast asks statsapi once per game and reads it by gamePk', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return {
      ok: true,
      status: 200,
      json: async () => ({
        dates: [{ games: [{ gamePk: 823514, broadcasts: [tv('YES', 'home'), tv('BravesVision', 'away')] }] }],
      }),
    }
  }
  try {
    const feed = { gamePk: 823514, gameData: { game: { pk: 823514 } } }
    assert.equal(await fetchGameBroadcast(feed), 'YES · BravesVision')
    assert.equal(await fetchGameBroadcast(feed), 'YES · BravesVision')
    assert.equal(calls.length, 1)
    assert.match(calls[0], /gamePk=823514/)
    assert.match(calls[0], /hydrate=broadcasts\(all\)/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchGameBroadcast degrades to no fact when the request fails', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('offline')
  }
  try {
    // A different gamePk from the test above, so the per-game cache there
    // can't answer this one.
    assert.equal(await fetchGameBroadcast({ gamePk: 999999 }), '')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchGameBroadcast needs no gamePk to stay safe', async () => {
  assert.equal(await fetchGameBroadcast(null), '')
  assert.equal(await fetchGameBroadcast({}), '')
})
