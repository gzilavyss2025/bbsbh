// The schedule-shape pipeline: the segmentation the nightly
// gen-schedule-shape.mjs writes (scripts/lib/schedule-shape.mjs) and the
// drought reader the Team hub's card asks (src/api/scheduleShape.js).
//
// Two halves have to agree here and cannot import each other — one is a build
// script, one ships to the browser — so the cases below deliberately pin them
// against each other rather than testing either alone: the row encoding, the
// segmentation, and the answer both sides give for the same club.
//
// Most cases are the shapes that make this hard rather than the happy path: a
// neutral-site game sitting inside a road series, a club that changed parks
// mid-range, a doubleheader that has to keep its order, and a drought whose
// chances were too rare to be worth printing.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  homeVenueByTeam,
  siteOf,
  ledgerFor,
  tagSeries,
  tagTrips,
  encodeRow,
  SITE,
  RESULT,
} from '../scripts/lib/schedule-shape.mjs'
import {
  ledgerOf,
  droughtFor,
  droughtsFor,
  isNotable,
  SLOTS,
  SLOT_BY_ID,
} from '../src/api/scheduleShape.js'

// A tiny season builder. `g('04-01', away, home, venue, awayScore, homeScore)`.
const g = (date, awayId, homeId, venueId, awayScore, homeScore, gameNumber = 1) => ({
  date: `2026-${date}`, gameNumber, venueId, awayId, homeId, awayScore, homeScore,
})

const MIL = 158
const CHC = 112
const STL = 138
const MIL_PARK = 32
const CHC_PARK = 17
const STL_PARK = 101

test('homeVenueByTeam takes the mode, not the first game seen', () => {
  // A club that opens the season at a neutral park and then plays the rest at
  // home — the Seoul and Tokyo Series shape. The one-off must not be recorded
  // as the club's home for the year.
  const games = [
    g('03-20', CHC, MIL, 999, 1, 0),
    g('04-01', CHC, MIL, MIL_PARK, 1, 2),
    g('04-02', CHC, MIL, MIL_PARK, 1, 3),
  ]
  assert.equal(homeVenueByTeam(games).get(MIL), MIL_PARK)
})

test('siteOf reads the park, not the designation', () => {
  const homeVenues = new Map([[MIL, MIL_PARK], [CHC, CHC_PARK]])
  // Designated home, in its own park.
  assert.equal(siteOf(g('04-01', CHC, MIL, MIL_PARK, 1, 2), MIL, homeVenues), 'home')
  // Designated away, in the opponent's park.
  assert.equal(siteOf(g('04-05', MIL, CHC, CHC_PARK, 1, 2), MIL, homeVenues), 'away')
  // Designated HOME, at neither club's park — London, Mexico City, the Field
  // of Dreams, and the COVID relocations. Nobody is home here.
  assert.equal(siteOf(g('06-10', CHC, MIL, 777, 1, 2), MIL, homeVenues), 'neutral')
  assert.equal(siteOf(g('06-10', CHC, MIL, 777, 1, 2), CHC, homeVenues), 'neutral')
})

test('ledgerFor orders a doubleheader by game number, not just date', () => {
  const homeVenues = new Map([[MIL, MIL_PARK], [CHC, CHC_PARK]])
  const games = [
    g('04-02', CHC, MIL, MIL_PARK, 5, 1, 2),
    g('04-02', CHC, MIL, MIL_PARK, 0, 4, 1),
    g('04-03', CHC, MIL, MIL_PARK, 2, 1),
  ]
  const led = ledgerFor(games, MIL, homeVenues)
  assert.deepEqual(led.map((r) => r.result), ['W', 'L', 'L'])
})

test('tagSeries splits on the opponent and on the side of the road', () => {
  const homeVenues = new Map([[MIL, MIL_PARK], [CHC, CHC_PARK], [STL, STL_PARK]])
  const games = [
    g('04-01', CHC, MIL, MIL_PARK, 1, 2),
    g('04-02', CHC, MIL, MIL_PARK, 1, 3),
    g('04-03', STL, MIL, MIL_PARK, 1, 4),
    g('04-05', MIL, CHC, CHC_PARK, 1, 5),
  ]
  const rows = tagSeries(ledgerFor(games, MIL, homeVenues))
  assert.deepEqual(rows.map((r) => r.seriesGame), [1, 2, 1, 1])
  assert.deepEqual(rows.map((r) => r.seriesLength), [2, 2, 1, 1])
  // A home series and a road series against the same club are two series, even
  // back to back — the home-and-home shape.
  assert.equal(rows[2].opponentId, STL)
  assert.equal(rows[3].site, 'away')
})

test('a neutral-site game does not split the series around it', () => {
  // The real case: on 2020-09-25 the Brewers played a designated HOME game
  // against the Cardinals at Busch Stadium, a COVID makeup relocated to save a
  // trip, in the middle of a four-game visit to St. Louis. Keyed on its own
  // site it splits the visit and invents a series opener nobody played.
  const homeVenues = new Map([[MIL, MIL_PARK], [STL, STL_PARK]])
  const games = [
    g('09-24', MIL, STL, STL_PARK, 2, 4),
    g('09-25', MIL, STL, STL_PARK, 3, 0),
    g('09-25', STL, MIL, STL_PARK, 9, 1, 2), // MIL is "home" — at Busch
    g('09-26', MIL, STL, STL_PARK, 3, 0),
    g('09-27', MIL, STL, STL_PARK, 2, 5),
  ]
  const rows = tagSeries(ledgerFor(games, MIL, homeVenues))
  const away = rows.filter((r) => r.site === 'away')
  assert.deepEqual(away.map((r) => r.seriesGame), [1, 2, 3, 4], 'one four-game series')
  assert.equal(rows.filter((r) => r.seriesOpener).length, 1, 'exactly one opener')
  // The relocated game itself belongs to no series at all.
  assert.equal(rows.find((r) => r.site === 'neutral').seriesGame, undefined)
})

test('tagTrips cuts homestands and road trips, and a neutral game is transparent', () => {
  const homeVenues = new Map([[MIL, MIL_PARK], [CHC, CHC_PARK], [STL, STL_PARK]])
  const games = [
    g('04-01', CHC, MIL, MIL_PARK, 1, 2), // home
    g('04-02', STL, MIL, MIL_PARK, 1, 3), // home
    g('04-03', CHC, MIL, 777, 1, 4), //       neutral — Field of Dreams
    g('04-04', STL, MIL, MIL_PARK, 1, 5), // home again
    g('04-06', MIL, CHC, CHC_PARK, 1, 2), // road
    g('04-07', MIL, STL, STL_PARK, 1, 2), // road, different city, same trip
  ]
  const rows = tagTrips(ledgerFor(games, MIL, homeVenues))
  const stand = rows.filter((r) => r.segment === 'homestand')
  assert.equal(stand.length, 3, 'the neutral game does not end the homestand')
  assert.deepEqual(stand.map((r) => r.segmentGame), [1, 2, 3])
  assert.equal(rows.filter((r) => r.segment === 'homestand' && r.segmentOpener).length, 1)
  const trip = rows.filter((r) => r.segment === 'trip')
  assert.equal(trip.length, 2, 'a trip spans cities')
  assert.equal(trip[0].segmentOpener, true)
  assert.equal(trip[1].segmentFinale, true)
  assert.equal(rows.find((r) => r.site === 'neutral').segment, undefined)
})

test('encodeRow round-trips through the reader, which owns its own copy of the tables', () => {
  // The two halves cannot import each other. This is the only thing keeping
  // SITE/RESULT in scripts/lib/schedule-shape.mjs and the arrays in
  // src/api/scheduleShape.js from silently drifting apart.
  const homeVenues = new Map([[MIL, MIL_PARK], [CHC, CHC_PARK]])
  const rows = ledgerFor([
    g('04-01', CHC, MIL, MIL_PARK, 1, 2),
    g('04-05', MIL, CHC, CHC_PARK, 7, 2),
    g('04-06', MIL, CHC, 777, 1, 2),
  ], MIL, homeVenues)
  const shard = { teamId: MIL, seasons: { 2026: rows.map(encodeRow) } }
  const decoded = ledgerOf(shard)
  assert.deepEqual(decoded.map((r) => r.site), ['home', 'away', 'neutral'])
  assert.deepEqual(decoded.map((r) => r.result), ['W', 'W', 'L'])
  assert.deepEqual(decoded.map((r) => r.date), ['2026-04-01', '2026-04-05', '2026-04-06'])
  assert.equal(SITE.neutral, 2)
  assert.equal(RESULT.W, 1)
})

test('ledgerOf segments per season, never across the winter', () => {
  const shard = { teamId: MIL, seasons: {
    2025: [['09-28', CHC, SITE.away, RESULT.L]],
    2026: [['03-26', CHC, SITE.away, RESULT.W]],
  } }
  const led = ledgerOf(shard)
  // Two road games either side of an offseason are two trips, not one.
  assert.deepEqual(led.map((r) => r.segmentGame), [1, 1])
  assert.deepEqual(led.map((r) => r.segmentOpener), [true, true])
})

test('ledgerOf applies the cutoff before segmenting, not after', () => {
  const shard = { teamId: MIL, seasons: { 2026: [
    ['04-01', CHC, SITE.away, RESULT.L],
    ['04-02', CHC, SITE.away, RESULT.L],
    ['04-03', CHC, SITE.away, RESULT.W],
  ] } }
  const led = ledgerOf(shard, { cutoff: '2026-04-02' })
  assert.equal(led.length, 2)
  // The trip in progress on that date is two games long, not three. A cutoff
  // applied after segmentation would leak the length of a trip the dated page
  // has not reached.
  assert.deepEqual(led.map((r) => r.segmentLength), [2, 2])
})

test('droughtFor counts chances, not days, and finds the last win', () => {
  const shard = { teamId: MIL, seasons: { 2026: [
    ['04-01', CHC, SITE.away, RESULT.W], // trip opener, won
    ['04-02', CHC, SITE.away, RESULT.L],
    ['04-10', CHC, SITE.home, RESULT.W],
    ['04-20', STL, SITE.away, RESULT.L], // trip opener, lost
    ['04-21', STL, SITE.away, RESULT.W],
    ['04-25', CHC, SITE.home, RESULT.L],
    ['05-01', STL, SITE.away, RESULT.L], // trip opener, lost
  ] } }
  const d = droughtFor(ledgerOf(shard), SLOT_BY_ID.get('trip-opener'))
  assert.equal(d.chances, 3)
  assert.equal(d.wins, 1)
  assert.equal(d.sinceWin, 2)
  assert.equal(d.lastWin.date, '2026-04-01')
  assert.equal(d.streakFrom, '2026-04-20')
})

test('droughtFor returns null for a slot the club has never reached', () => {
  const shard = { teamId: MIL, seasons: { 2026: [['04-01', CHC, SITE.home, RESULT.W]] } }
  assert.equal(droughtFor(ledgerOf(shard), SLOT_BY_ID.get('trip-opener')), null)
})

test('the gate rejects a long drought whose chances were too rare', () => {
  // The finding this gate exists for: nine series openers in one city spread
  // over eleven years is schedule rarity, not futility. Same streak length,
  // opposite verdict, decided only by how tightly the chances sat together.
  const slot = SLOT_BY_ID.get('series-opener-away')
  const rare = { sinceWin: 9, streakFrom: '2016-05-27', lastWin: { date: '2016-05-27' } }
  const real = { sinceWin: 9, streakFrom: '2024-06-01', lastWin: { date: '2024-05-01' } }
  assert.equal(isNotable(rare, slot, { asOfDate: '2026-08-31' }), false)
  assert.equal(isNotable(real, slot, { asOfDate: '2026-08-31' }), true)
})

test('the gate scales its threshold with how often the slot comes around', () => {
  // Four straight is a third of a season of road-trip openers and worth
  // saying; it is a rounding error against fifty-two series openers.
  const streak = { sinceWin: 4, streakFrom: '2026-06-01', lastWin: { date: '2026-05-01' } }
  const at = { asOfDate: '2026-08-31' }
  assert.equal(isNotable(streak, SLOT_BY_ID.get('trip-opener'), at), true)
  assert.equal(isNotable(streak, SLOT_BY_ID.get('series-opener'), at), false)
})

test('the gate lowers its bar when the scope narrows the chances', () => {
  // The defect this pins: a club visits any one park about 2.7 times a season,
  // not 26, so an opponent-narrowed drought judged against the league-wide rate
  // needed seven straight inside three years — which no club had ever done, and
  // the whole rival half of the card silently never rendered.
  const slot = SLOT_BY_ID.get('series-opener-away')
  const at = { asOfDate: '2026-08-31' }
  const narrowed = { sinceWin: 4, perSeason: 2.75, streakFrom: '2024-09-20', lastWin: { date: '2024-06-11' } }
  const unnarrowed = { sinceWin: 4, perSeason: 26, streakFrom: '2024-09-20', lastWin: { date: '2024-06-11' } }
  assert.equal(isNotable(narrowed, slot, at), true)
  assert.equal(isNotable(unnarrowed, slot, at), false)
})

test('every slot carries a stable id and an honest firing rate', () => {
  const ids = SLOTS.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length, 'ids are unique')
  for (const s of SLOTS) {
    assert.match(s.id, /^[a-z0-9-]+$/, `${s.id} is URL-safe`)
    assert.ok(s.every > 0 && s.every <= 82, `${s.id} fires a plausible number of times a season`)
    assert.equal(typeof s.p, 'function')
  }
})

// ---------------------------------------------------------------------------
// Against the committed data
// ---------------------------------------------------------------------------

// The pipeline is only worth anything if it reproduces the fact it was built
// for, off the file that actually ships. This is the stat as it was posted:
// "The last time the Brewers won Game 1 of a road trip was July 3rd."
test('the shipped Brewers shard answers the stat this dataset was built for', () => {
  const shard = JSON.parse(readFileSync('public/data/schedule-shape/158.json', 'utf8'))
  const led = ledgerOf(shard)
  assert.ok(led.length > 1500, 'a decade of games is on file')
  const season = led.at(-1).season
  const d = droughtFor(led.filter((r) => r.season === season), SLOT_BY_ID.get('trip-opener'))
  assert.ok(d, 'the Brewers have opened a road trip this season')
  assert.ok(d.chances >= 10, 'a full season presents the slot about thirteen times')
  assert.equal(d.wins + d.losses, d.chances)
})

test('the shipped shards never invent a segment position', () => {
  // Across every club, a game tagged as an opener really is the first of its
  // run, and a run's tagged length really is how many games carry the tag.
  for (const teamId of [158, 112, 147, 119, 133]) {
    const led = ledgerOf(JSON.parse(readFileSync(`public/data/schedule-shape/${teamId}.json`, 'utf8')))
    let seen = 0
    for (let i = 0; i < led.length; i++) {
      const r = led[i]
      if (r.segment == null) { assert.equal(r.segmentGame, undefined); continue }
      seen++
      if (r.segmentOpener) assert.equal(r.segmentGame, 1, `${teamId} ${r.date}`)
      if (r.segmentGame === 1) assert.equal(r.segmentOpener, true, `${teamId} ${r.date}`)
      assert.ok(r.segmentGame <= r.segmentLength, `${teamId} ${r.date} inside its own run`)
      if (r.segmentFinale) assert.equal(r.segmentGame, r.segmentLength, `${teamId} ${r.date}`)
    }
    assert.ok(seen > 1400, `${teamId} has a decade of segmented games`)
  }
})

test('droughtsFor is quiet: the gate keeps the card short', () => {
  // A club carrying twenty droughts is a card nobody reads. The whole point of
  // the gate is that most clubs carry a handful and some carry none.
  const counts = [158, 112, 147, 119, 133, 108, 121].map(
    (id) => droughtsFor(JSON.parse(readFileSync(`public/data/schedule-shape/${id}.json`, 'utf8'))).length,
  )
  for (const n of counts) assert.ok(n <= 6, `a club carries at most a handful of notable droughts, got ${n}`)
})
