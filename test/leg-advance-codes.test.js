// Regression coverage for ADVANCE_CODES (src/api/playbyplay.js) — the map
// legAdvanceCode/advanceCode use to label how a runner advanced when it
// happened on a LATER batter's play, not his own. A key missing from that
// map falls all the way through to the generic ground-out "GO" fallback,
// mislabeling the leg. Verified live: gamePk 777747 (walk, already covered
// by ADVANCE_CODES' own comment) and, for this file, a catcher's-
// interference reach — the runner it puts in motion showed "GO" instead of
// "CI" before catcher_interf was added to the map.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

test('a runner advancing on someone else\'s catcher-interference reach is tagged CI, not GO', () => {
  const feed = buildFeed()
  // A fresh top 3 (untouched by mini-game.js's own plays): Ashby (id 1)
  // singles, then Bell (id 2) reaches on catcher interference, sending Ashby
  // to 2nd — the shape a real feed uses (verified live: Freddy Fermín's
  // interference on Mauricio Dubón sent Michael Harris II to 2nd).
  feed.liveData.plays.allPlays.push(
    {
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 1 } },
      result: { type: 'atBat', eventType: 'single' },
      count: { outs: 0 },
      playEvents: [{ isPitch: true, pitchNumber: 1, details: { call: { code: 'X' } } }],
    },
    {
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 2 } },
      result: {
        type: 'atBat',
        eventType: 'catcher_interf',
        description: 'Ben Bell reaches on catcher interference. Aaron Ashby to 2nd.',
      },
      count: { outs: 0 },
      playEvents: [{ isPitch: true, pitchNumber: 1, details: { call: { code: 'B' } } }],
      runners: [{ details: { runner: { id: 1 } }, movement: { end: '2B', isOut: false } }],
    },
  )

  const entries = computeHalfInningFeed(feed, 3, 'top', 'away')
  const ashbyCard = entries.find((e) => e.kind === 'atbat' && e.batterId === 1)
  assert.ok(ashbyCard, 'Ashby\'s own at-bat card should exist')
  assert.equal(ashbyCard.legNotations[2]?.code, 'CI')
})
