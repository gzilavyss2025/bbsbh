// The ballpark callers carry the venue id and the game date to the layout
// resolver (#1859, slice 2). Every drawing of a park picks its wall by
// (venueId, gameDate), so the selectors that feed those drawings must hand
// both on. A name alone resolves today's wall, which is the wrong wall for a
// game played before a renovation.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { selectGameInfo, selectVenueRef } from '../src/api/select.js'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'

// A 2022 game at Comerica Park (venue 2394): the wall before the 2023 move.
function comerica2022() {
  const feed = buildFeed()
  feed.gameData.venue = { id: 2394, name: 'Comerica Park' }
  feed.gameData.datetime = { ...(feed.gameData.datetime ?? {}), officialDate: '2022-06-01' }
  const play = feed.liveData.plays.allPlays.find((p) => p.about.inning === 1 && p.about.halfInning === 'top')
  play.playEvents.at(-1).hitData = { coordinates: { coordX: 125, coordY: 80 }, launchSpeed: 101, launchAngle: 27 }
  return feed
}

test('a batted ball on the play feed carries the venue id and the game date', () => {
  const entries = computeHalfInningFeed(comerica2022(), 1, 'top', 'away')
  const ball = entries.find((e) => e.battedBall)?.battedBall
  assert.ok(ball, 'the fixture play has a batted ball')
  assert.equal(ball.venue, 'Comerica Park')
  assert.equal(ball.venueId, 2394)
  assert.equal(ball.gameDate, '2022-06-01')
  // …which resolves the wall that game was played at, not today's.
  const layout = resolveBallparkLayout({ venueId: ball.venueId, venueName: ball.venue, gameDate: ball.gameDate })
  assert.equal(layout.configurationId, 'comericapark-2000')
})

test('the lineup page game info carries the venue id beside the name and date', () => {
  const info = selectGameInfo(comerica2022())
  assert.equal(info.venue, 'Comerica Park')
  assert.equal(info.venueId, 2394)
  assert.equal(info.officialDate, '2022-06-01')
})

test('the hit charts get the venue name, id and date in one piece', () => {
  assert.deepEqual(selectVenueRef(comerica2022()), { venue: 'Comerica Park', venueId: 2394, gameDate: '2022-06-01' })
})

test('a feed with no venue still selects cleanly', () => {
  const feed = buildFeed()
  delete feed.gameData.venue
  assert.equal(selectGameInfo(feed).venueId, null)
  assert.deepEqual(selectVenueRef(feed), { venue: '', venueId: null, gameDate: feed.gameData.datetime?.officialDate ?? null })
  assert.deepEqual(selectVenueRef(null), { venue: '', venueId: null, gameDate: null })
})
