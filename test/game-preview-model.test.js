import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPreviewModel } from '../src/api/gamePreview.js'

// The preview poster is exported as an IMAGE and posted in public, so a number
// that leaks into it cannot be un-leaked by re-sealing anything. These pin the
// two properties that keep that safe: the model carries no run total on a
// FINISHED game, and it degrades rather than throwing when the pre-game facts
// haven't posted.

// SENTINELS, NOT REAL SCORES. Every score-bearing path in the fixture carries
// an implausible marker rather than a believable run total, so the sweep below
// can assert "none of these values reached the model" without a real 2 or 10
// colliding with a jersey number, a person id or an inning — which is exactly
// what a first draft of this test did, failing on an umpire's id.
const SCORE = { awayRuns: 90210, homeRuns: 80808, inningRuns: 70707, boxRuns: 60606 }

// A minimal finished-game feed, shaped like the live feed's real paths and
// carrying a sentinel everywhere the feed actually puts a score — linescore
// totals, per-inning runs, and the boxscore team lines. If a future change
// starts reading any of them, the sweep below fails.
function finishedFeed() {
  return {
    gameData: {
      status: { abstractGameState: 'Final', detailedState: 'Final', codedGameState: 'F' },
      datetime: { officialDate: '2026-07-07', time: '6:45', ampm: 'PM', dayNight: 'night' },
      venue: { name: 'Busch Stadium', location: { city: 'St. Louis', stateAbbrev: 'MO' }, fieldInfo: { roofType: 'Open' } },
      weather: { temp: '84', condition: 'Partly Cloudy', wind: '7 mph, In From LF' },
      teams: {
        away: { id: 158, name: 'Milwaukee Brewers', clubName: 'Brewers', abbreviation: 'MIL', record: { wins: 58, losses: 33, pct: '.637' } },
        home: { id: 138, name: 'St. Louis Cardinals', clubName: 'Cardinals', abbreviation: 'STL', record: { wins: 47, losses: 43, pct: '.522' } },
      },
      probablePitchers: {
        away: { id: 1, fullName: 'Robert Gasser' },
        home: { id: 2, fullName: 'Hunter Dobbins' },
      },
      players: {
        ID1: { id: 1, fullName: 'Robert Gasser', primaryNumber: '54', pitchHand: { code: 'L' } },
        ID2: { id: 2, fullName: 'Hunter Dobbins', primaryNumber: '40', pitchHand: { code: 'R' } },
      },
    },
    liveData: {
      linescore: {
        currentInning: 9,
        teams: {
          away: { runs: SCORE.awayRuns, hits: 14, errors: 0 },
          home: { runs: SCORE.homeRuns, hits: 6, errors: 1 },
        },
        innings: [{ num: 1, away: { runs: SCORE.inningRuns }, home: { runs: SCORE.inningRuns } }],
      },
      boxscore: {
        officials: [
          { officialType: 'Home Plate', official: { id: 9, fullName: 'Adam Hamari' } },
          { officialType: 'First Base', official: { id: 10, fullName: 'Jen Pawol' } },
        ],
        info: [{ label: 'Att', value: '41,203' }],
        teams: {
          away: { team: { id: 158 }, teamStats: { batting: { runs: SCORE.boxRuns } }, players: {}, battingOrder: [] },
          home: { team: { id: 138 }, teamStats: { batting: { runs: SCORE.boxRuns } }, players: {}, battingOrder: [] },
        },
      },
    },
  }
}

// Every string and number the model holds, flattened — the poster can print
// any of them, so the assertion has to cover all of them rather than the
// handful a hand-written check would remember.
function allValues(node, out = []) {
  if (node == null) return out
  if (Array.isArray(node)) {
    for (const v of node) allValues(v, out)
    return out
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) allValues(v, out)
    return out
  }
  out.push(node)
  return out
}

test('a finished game yields no run total anywhere in the model', () => {
  const model = buildPreviewModel(finishedFeed())
  const values = allValues(model).map(String)
  for (const sentinel of Object.values(SCORE)) {
    assert.ok(
      !values.some((v) => v.includes(String(sentinel))),
      `the model carries ${sentinel} — it is reading a score-bearing feed path`,
    )
  }
  assert.equal(model.started, true)
})

test('a started game carries no club record — the feed number means the wrong thing', () => {
  const model = buildPreviewModel(finishedFeed())
  assert.equal(model.away.record, null)
  assert.equal(model.home.record, null)
})

test('an unstarted game carries the record entering it', () => {
  const feed = finishedFeed()
  feed.gameData.status = { abstractGameState: 'Preview', detailedState: 'Scheduled' }
  delete feed.liveData.linescore
  const model = buildPreviewModel(feed)
  assert.equal(model.started, false)
  assert.equal(model.away.record.line, '58-33')
  assert.equal(model.home.record.line, '47-43')
})

test('the model degrades instead of throwing on an empty feed', () => {
  assert.equal(buildPreviewModel(null), null)
  const bare = buildPreviewModel({ gameData: {}, liveData: {} })
  assert.deepEqual(bare.lineups, { away: [], home: [] })
  assert.deepEqual(bare.starters, { away: null, home: null })
  assert.equal(bare.plate, null)
  assert.deepEqual(bare.crew, [])
  assert.equal(bare.venue.name, '')
})

test('a crew with no accuracy on file still names the plate umpire', () => {
  const model = buildPreviewModel(finishedFeed(), { umpire: null })
  assert.equal(model.plate.name, 'Adam Hamari')
  assert.equal(model.plate.accuracy, undefined, 'no season means no tiles, not a fabricated zero')
  assert.equal(model.crew.length, 2)
})

// The ABS challenge figures ride the plate block the same way the tiles do:
// present when the sweep has counted them, null — never zero — when the row
// set predates the challenge schema.
test('the plate block carries the ABS challenge pair and the league baseline', () => {
  const umpire = {
    season: 2026,
    games: [{ role: 'HP' }],
    accuracy: { season: { called: 3000, accuracy: 0.94, consistency: 0.92, favorPerGame: 1.1, games: 20 } },
    rank: { rank: 5, total: 90 },
    lean: { tier: 'neutral', z: 0.1 },
    zoneCells: null,
    watchArea: null,
    challenges: { perGame: 3.5, overturnRate: 0.5, total: 80, overturned: 40, games: 23 },
    leagueChallenges: { perGame: 3.1, overturnRate: 0.47 },
  }
  const model = buildPreviewModel(finishedFeed(), { umpire })
  assert.deepEqual(model.plate.challenges, { perGame: 3.5, overturnRate: 0.5 })
  assert.deepEqual(model.plate.leagueChallenges, { overturnRate: 0.47 })

  const swept = buildPreviewModel(finishedFeed(), {
    umpire: { ...umpire, challenges: null, leagueChallenges: null },
  })
  assert.equal(swept.plate.challenges, null)
  assert.equal(swept.plate.leagueChallenges, null)
})

test('a probable starter with no season line yet still prints his name and hand', () => {
  const model = buildPreviewModel(finishedFeed())
  assert.equal(model.starters.away.name, 'Robert Gasser')
  assert.equal(model.starters.away.hand, 'LHP')
  assert.equal(model.starters.away.jersey, '54')
  assert.equal(model.starters.away.era, '')
})

// A `useAsync` holds **null** while it is in flight, and a default parameter
// only fires on `undefined` — so `extras.starterLines.away` threw on the very
// first paint and took the whole screen down until the fetch landed. It looked
// like a flaky page rather than a bug, which is why it survived a while.
test('a null extra reads as absent, not as a crash', () => {
  const feed = finishedFeed()
  for (const extras of [
    {},
    { starterLines: null, broadcast: null, umpire: null, callouts: null },
    { starterLines: undefined, callouts: undefined },
  ]) {
    const model = buildPreviewModel(feed, extras)
    assert.equal(model.starters.away.era, '')
    assert.equal(model.broadcast, '')
    assert.equal(model.records.away, null)
  }
})

test('the situational records read entering-tonight families off the bundle', () => {
  const callouts = {
    teamRecords: {
      away: {
        scoringFirst: '45-17',
        opponentScoringFirst: '28-26',
        oneRun: '19-16',
        leadAfterFull: { 6: { w: 50, l: 9 }, 7: { w: 54, l: 4 }, 8: { w: 56, l: 3 } },
      },
      home: { scoringFirst: '39-17', leadAfter: { 7: '48-1' } },
    },
  }
  const model = buildPreviewModel(finishedFeed(), { callouts })
  // The SEVENTH, and out of leadAfterFull — which always carries 6/7/8, where
  // `leadAfter` keeps only the innings lopsided enough to be worth a note.
  assert.equal(model.records.away.leadAfter7, '54-4')
  assert.equal(model.records.away.scoringFirst, '45-17')
  // The fallback path, for a shard that carries only the sparse map.
  assert.equal(model.records.home.leadAfter7, '48-1')
  // Rows are fixed and shared, so the two columns compare like for like.
  assert.deepEqual(
    model.recordRows.map((r) => r.key),
    ['scoringFirst', 'opponentScoringFirst', 'leadAfter7', 'oneRun'],
  )
})

test('a club with no records in the bundle yields null rather than empty rows', () => {
  assert.equal(buildPreviewModel(finishedFeed(), { callouts: { teamRecords: {} } }).records.away, null)
  assert.equal(buildPreviewModel(finishedFeed(), { callouts: {} }).records.home, null)
})

test('a hitter with no plate appearances carries no season line', () => {
  const feed = finishedFeed()
  feed.liveData.boxscore.teams.away.battingOrder = [100]
  feed.liveData.boxscore.teams.away.players = {
    ID100: {
      person: { id: 100, fullName: 'Jackson Chourio' },
      battingOrder: '100',
      allPositions: [{ abbreviation: 'LF' }],
      seasonStats: { batting: { avg: '.000', atBats: 0 } },
    },
  }
  feed.gameData.players.ID100 = { id: 100, fullName: 'Jackson Chourio' }
  assert.equal(buildPreviewModel(feed).lineups.away[0].batting, null)
})

// `seasonStats` on a boxscore player is NOT a pre-game figure: the feed updates
// it DURING the game, so on a finished game it already counts tonight. That is
// documented in src/api/boxscore.js, which built `preGameAvg` to subtract
// tonight back out for exactly this reason.
//
// It matters most here. The rate stats move imperceptibly — an AVG that shifts
// .003 says nothing — but HR, RBI and SB are COUNTING stats, and an RBI is a
// run driven in. A poster built from a sealed game that prints "48 RBI" when
// the hitter entered on 46 has told the reader two runs scored, in an image
// they then post in public. The model must print what he entered the night on.
test('a hitter line on the poster counts only what he brought into tonight', () => {
  const feed = finishedFeed()
  feed.liveData.boxscore.teams.away.battingOrder = [100]
  feed.liveData.boxscore.teams.away.players = {
    ID100: {
      person: { id: 100, fullName: 'Jackson Chourio' },
      battingOrder: '100',
      allPositions: [{ abbreviation: 'LF' }],
      // Season totals as the feed has them AFTER tonight...
      seasonStats: { batting: { avg: '.278', obp: '.341', slg: '.480', ops: '.821', atBats: 400, hits: 111, homeRuns: 20, rbi: 48, stolenBases: 15 } },
      // ...and tonight's own line, sitting on the same record.
      stats: { batting: { atBats: 4, hits: 2, homeRuns: 2, rbi: 3, stolenBases: 1 } },
    },
  }
  feed.gameData.players.ID100 = { id: 100, fullName: 'Jackson Chourio' }

  const batting = buildPreviewModel(feed).lineups.away[0].batting
  assert.equal(batting.homeRuns, 18, 'two of tonight’s homers must come back out')
  assert.equal(batting.rbi, 45, 'an RBI is a run driven in — tonight’s three cannot show')
  assert.equal(batting.stolenBases, 14)
})
