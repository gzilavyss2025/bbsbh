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

test('a probable starter with no season line yet still prints his name and hand', () => {
  const model = buildPreviewModel(finishedFeed())
  assert.equal(model.starters.away.name, 'Robert Gasser')
  assert.equal(model.starters.away.hand, 'LHP')
  assert.equal(model.starters.away.jersey, '54')
  assert.equal(model.starters.away.era, '')
})
