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
  encodeDetailRow,
  detailFacts,
  SITE,
  RESULT,
  FLAG,
} from '../scripts/lib/schedule-shape.mjs'
import {
  ledgerOf,
  droughtFor,
  droughtsFor,
  isNotable,
  eventDroughtFor,
  isNotableEvent,
  SLOTS,
  SLOT_BY_ID,
  EVENTS,
  EVENT_BY_ID,
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

// The feed lists some games TWICE, under two different date buckets — 37 of
// them across 2015-2026. gen-team-records.mjs reaches the same games by a
// different route (a per-DATE sweep, three calls a game, and its own totals
// verified against statsapi's published splits), which makes its committed
// ledger a free oracle for this one: for the season both cover, the two must
// agree on how many games each club played, to the game.
test('the shipped shards carry each club exactly once per game', () => {
  const shape = JSON.parse(readFileSync('public/data/schedule-shape/137.json', 'utf8'))
  const rows = shape.seasons['2026']
  // A duplicate would show as two identical rows on a date; a real
  // doubleheader also shows as two rows on a date. The difference is whether
  // gen-team-records.mjs, which cannot see the duplicate, counted them too.
  const records = JSON.parse(readFileSync('public/data/team-records/2026/137.json', 'utf8')).games
  assert.equal(rows.length, records.length, 'San Francisco 2026 — the club the duplicate landed on')
  const doubleheader = rows.filter((r) => r[0] === '04-30')
  assert.equal(doubleheader.length, 2, 'a real doubleheader keeps both games')
})

test('every club agrees with the team-records ledger on games played', () => {
  for (const teamId of [158, 112, 147, 119, 133, 137, 144]) {
    const shape = JSON.parse(readFileSync(`public/data/schedule-shape/${teamId}.json`, 'utf8'))
    const records = JSON.parse(readFileSync(`public/data/team-records/2026/${teamId}.json`, 'utf8'))
    assert.equal(shape.seasons['2026'].length, records.games.length, `club ${teamId}`)
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

// ---------------------------------------------------------------------------
// Per-game detail, and the event droughts it feeds
// ---------------------------------------------------------------------------

// `{ a, h }` per inning, the shape a linescore reduces to. `h` null = the home
// side did not bat.
const innings = (...pairs) => pairs.map(([a, h]) => ({ a, h }))

test('detailFacts reads the lead carried into the 8th and the 9th', () => {
  // Away club leads 3-0 after seven, 3-2 after eight, wins 3-2.
  const d = detailFacts({
    innings: innings([1, 0], [0, 0], [2, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 2], [0, 0]),
    scheduledInnings: 9,
    isHome: false,
  })
  assert.equal(d.leadAfter7, 3)
  assert.equal(d.leadAfter8, 1)
  assert.ok(d.flags & FLAG.everLed)
  assert.ok(!(d.flags & FLAG.everTrailed))
})

test('a game that never reached the 9th reports no lead there, not a lead of zero', () => {
  // Rain-shortened after seven. A club cannot blow a ninth-inning lead in a
  // game with no ninth inning, and the row has to say "no chance" so the event
  // family excludes it rather than counting a try the club never got.
  const d = detailFacts({
    innings: innings([1, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]),
    scheduledInnings: 9,
    isHome: false,
  })
  assert.equal(d.leadAfter7, 1)
  assert.equal(d.leadAfter8, null)
})

test('a walk-off is the home side going ahead in the final half, not merely scoring', () => {
  // Home trails 2-1 into the bottom of the 9th and scores twice: a walk-off.
  const off = detailFacts({
    innings: innings([1, 0], [0, 0], [1, 0], [0, 0], [0, 1], [0, 0], [0, 0], [0, 0], [0, 2]),
    scheduledInnings: 9,
    isHome: true,
  })
  assert.ok(off.flags & FLAG.walkOffWin)
  // Home leads 5-0 and tacks on in the 8th, then the 9th is not played. Runs in
  // a late half of a game already won are not a walk-off.
  const not = detailFacts({
    innings: innings([0, 5], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 2], [0, null]),
    scheduledInnings: 9,
    isHome: true,
  })
  assert.ok(!(not.flags & FLAG.walkOffWin))
})

test('the loser of a walk-off carries the other half of the same flag', () => {
  const args = {
    innings: innings([1, 0], [0, 0], [1, 0], [0, 0], [0, 1], [0, 0], [0, 0], [0, 0], [0, 2]),
    scheduledInnings: 9,
  }
  assert.ok(detailFacts({ ...args, isHome: true }).flags & FLAG.walkOffWin)
  assert.ok(detailFacts({ ...args, isHome: false }).flags & FLAG.walkOffLoss)
})

test('a wide row round-trips into the reader, flags and all', () => {
  const homeVenues = new Map([[MIL, MIL_PARK], [CHC, CHC_PARK]])
  const [row] = ledgerFor([g('04-01', CHC, MIL, MIL_PARK, 2, 3)], MIL, homeVenues)
  const detail = detailFacts({
    innings: innings([1, 0], [0, 0], [1, 0], [0, 0], [0, 1], [0, 0], [0, 0], [0, 0], [0, 2]),
    scheduledInnings: 9,
    isHome: true,
  })
  const wide = encodeDetailRow(
    { ...row, runsFor: 3, runsAgainst: 2, hits: 8, oppHits: 6, errors: 0, oppErrors: 1 },
    detail,
  )
  const [decoded] = ledgerOf({ teamId: MIL, seasons: { 2026: [wide] } })
  assert.equal(decoded.detail, true)
  assert.equal(decoded.runsFor, 3)
  assert.equal(decoded.runsAgainst, 2)
  assert.equal(decoded.hits, 8)
  assert.equal(decoded.oppErrors, 1)
  assert.equal(decoded.walkOffWin, true)
  assert.equal(decoded.everTrailed, true)
  // A thin row decodes with no detail at all, and must not fake zeroes.
  const [thin] = ledgerOf({ teamId: MIL, seasons: { 2015: [encodeRow(row)] } })
  assert.equal(thin.detail, undefined)
  assert.equal(thin.runsFor, undefined)
})

test('an event drought counts TRIES, not games on the calendar', () => {
  // The case this whole design exists for. Twelve games; only three went to
  // extra innings, and the club lost the first of those and won the other two.
  // The honest line is "two extra-inning games since", not "ten games since" —
  // the other nine could not have produced the event at any price.
  const rows = []
  for (let i = 1; i <= 12; i++) {
    const extra = i === 2 || i === 5 || i === 9
    const lost = i === 2
    rows.push([
      `04-${String(i).padStart(2, '0')}`, CHC, SITE.home, lost ? RESULT.L : RESULT.W,
      lost ? 2 : 3, lost ? 3 : 2, 8, 6, 0, 0, 1, 1, extra ? FLAG.extra : 0,
    ])
  }
  const led = ledgerOf({ teamId: MIL, seasons: { 2026: rows } })
  const d = eventDroughtFor(led, EVENT_BY_ID.get('extra-loss'))
  assert.equal(d.chances, 3, 'only the extra-inning games were ever a chance')
  assert.equal(d.done, 1)
  assert.equal(d.sinceLast, 2, 'two extra-inning games since, not ten calendar games')
  assert.equal(d.last, '2026-04-02')
  // And the gate throws it out on the sample size, which is the other half of
  // the same lesson.
  assert.equal(isNotableEvent(d), false)
})

test('an event never done inside the window prints nothing, because it has no date', () => {
  // "If you cannot name the number, cut the note" — a "since" with no date to
  // name is not a fact, and the window cannot see further back than it holds.
  const rows = [[
    '04-01', CHC, SITE.home, RESULT.W, 3, 2, 8, 6, 0, 0, 1, 1, FLAG.extra,
  ]]
  const led = ledgerOf({ teamId: MIL, seasons: { 2026: rows } })
  assert.equal(eventDroughtFor(led, EVENT_BY_ID.get('extra-loss')), null)
})

test('the event gate throws out a small sample however improbable it looks', () => {
  // Six coin flips come out near 1%, and across twenty families and thirty
  // clubs that fills the card with noise. The Dodgers' "149 games without an
  // extra-inning loss" was six extra-inning games.
  const small = { chances: 6, done: 3, rate: 0.5, sinceLast: 6, last: '2025-09-15' }
  const large = { chances: 60, done: 30, rate: 0.5, sinceLast: 12, last: '2026-05-01' }
  assert.equal(isNotableEvent(small), false)
  assert.equal(isNotableEvent(large), true)
})

test("the event gate measures a drought against the CLUB's own rate, not the league's", () => {
  // Colorado threw five shutouts in 462 games. A 109-game gap is what Colorado
  // normally does, and saying so as news would be a fact about Coors Field
  // wearing a club's name. Same streak, ordinary club, different verdict.
  const rockies = { chances: 462, done: 5, rate: 5 / 462, sinceLast: 109, last: '2026-04-26' }
  const ordinary = { chances: 462, done: 40, rate: 40 / 462, sinceLast: 109, last: '2026-04-26' }
  assert.equal(isNotableEvent(rockies), false)
  assert.equal(isNotableEvent(ordinary), true)
})

test('every event family carries a stable id and both halves of its pair', () => {
  const ids = EVENTS.map((e) => e.id)
  assert.equal(new Set(ids).size, ids.length, 'ids are unique')
  for (const e of EVENTS) {
    assert.match(e.id, /^[a-z0-9-]+$/, `${e.id} is URL-safe`)
    assert.equal(typeof e.when, 'function', `${e.id} names its denominator`)
    assert.equal(typeof e.did, 'function')
    assert.ok(e.label && e.label.length < 40, `${e.id} has a column-width label`)
  }
})

// The detail facts are derived from a linescore; gen-team-records.mjs derives
// the same facts from a box score and a play-by-play, three calls a game, and
// its totals were verified against statsapi's published splits. Where the two
// agree, both are almost certainly right.
test('the shipped detail agrees with the team-records ledger game for game', () => {
  for (const teamId of [158, 119, 117, 109]) {
    const led = ledgerOf(JSON.parse(readFileSync(`public/data/schedule-shape/${teamId}.json`, 'utf8')))
      .filter((r) => r.season === 2026)
    const rec = JSON.parse(readFileSync(`public/data/team-records/2026/${teamId}.json`, 'utf8')).games
    assert.equal(led.length, rec.length, `club ${teamId} game count`)
    for (let i = 0; i < rec.length; i++) {
      const a = rec[i]
      const b = led[i]
      assert.equal(b.runsFor, a.rs, `${teamId} ${a.d} runs for`)
      assert.equal(b.runsAgainst, a.ra, `${teamId} ${a.d} runs against`)
      assert.equal(b.extra, a.x === 1, `${teamId} ${a.d} extra innings`)
      assert.equal(b.walkOffWin, a.wo === 1, `${teamId} ${a.d} walk-off win`)
      assert.equal(b.walkOffLoss, a.wo === -1, `${teamId} ${a.d} walk-off loss`)
      // team-records stores the comeback VERDICT; this file stores the fact it
      // is built from, so the two meet at the definition rather than the field.
      assert.equal(b.everTrailed && b.result === 'W', a.cb === 1, `${teamId} ${a.d} comeback`)
      assert.equal(b.everLed && b.result === 'L', a.ll === 1, `${teamId} ${a.d} blown lead`)
    }
  }
})
