// Coverage for the Day Highlights signal layer (src/api/dayHighlights.js):
// the multi-HR protagonist pick and the starter-record sub-caption gate.
// Written alongside the day-recap review fixes (multi-HR mis-credit, sub-caption
// noise) — each test below FAILS against the pre-fix code.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  multiHrSignal,
  performerSubCaption,
  eliteGameScoreSignal,
  cycleSignal,
  positionPlayerPitchingSignal,
  triplePlaySignal,
  selectGameResults,
  rankDayHighlights,
  firstSentence,
} from '../src/api/dayHighlights.js'

// A minimal live-feed shape carrying only what multiHrSignal reads: each side's
// boxscore players (battingOrder + batting.homeRuns + person + position) plus
// gameData.teams for the performer's team identity.
function feedWith(away, home) {
  const toPlayers = (arr) =>
    Object.fromEntries(
      arr.map((b, i) => [
        `ID${b.id}`,
        {
          person: { id: b.id, fullName: b.name },
          battingOrder: `${(i + 1) * 100}`,
          position: { abbreviation: b.pos ?? 'DH' },
          stats: { batting: { homeRuns: b.hr } },
        },
      ]),
    )
  return {
    gameData: {
      teams: {
        away: { id: 10, abbreviation: 'AWY' },
        home: { id: 20, abbreviation: 'HOM' },
      },
    },
    liveData: {
      boxscore: {
        teams: { away: { players: toPlayers(away) }, home: { players: toPlayers(home) } },
      },
    },
  }
}

// --------------------------------------------------------------------------
// multiHrSignal — pick the game's BEST multi-HR line, across both sides.
// --------------------------------------------------------------------------

// The exact 2026-07-19 CIN/COL regression: Stephenson (away, 2 HR) batted
// before Goodman (home, 3 HR), and the old first-match scan credited the
// wrong hitter. The signal must surface the 3-HR game.
test('multiHrSignal: a 3-HR home batter beats a 2-HR away batter', () => {
  const feed = feedWith(
    [{ id: 1, name: 'Tyler Stephenson', hr: 2, pos: 'C' }],
    [{ id: 2, name: 'Hunter Goodman', hr: 3, pos: 'C' }],
  )
  const sig = multiHrSignal(feed)
  assert.equal(sig.performer.id, 2)
  assert.equal(sig.performer.name, 'Hunter Goodman')
  assert.equal(sig.text, 'Hunter Goodman: 3 HR')
  // The hr >= 3 bonus is now actually reachable.
  assert.equal(sig.points, 65)
})

test('multiHrSignal: an exact tie keeps the away hitter (stable ordering)', () => {
  const feed = feedWith(
    [{ id: 1, name: 'Away Masher', hr: 2 }],
    [{ id: 2, name: 'Home Masher', hr: 2 }],
  )
  assert.equal(multiHrSignal(feed).performer.id, 1)
})

test('multiHrSignal: no one with 2+ HR yields no signal', () => {
  const feed = feedWith([{ id: 1, name: 'A', hr: 1 }], [{ id: 2, name: 'B', hr: 0 }])
  assert.equal(multiHrSignal(feed), null)
})

// --------------------------------------------------------------------------
// performerSubCaption — the starter-record line only shows when flattering.
// --------------------------------------------------------------------------
const gameScoreTop = (id) => ({ key: 'gameScore', performer: { id } })
const bundleWithRecord = (id, w, l) => ({ starterRecords: { [id]: { teamStarts: { w, l } } } })

test('performerSubCaption: a strong winning record over a real sample shows', () => {
  const cap = performerSubCaption(gameScoreTop(99), bundleWithRecord(99, 11, 6))
  assert.equal(cap, 'Team is 11-6 in his starts')
})

test('performerSubCaption: a .500 record is suppressed', () => {
  assert.equal(performerSubCaption(gameScoreTop(99), bundleWithRecord(99, 8, 8)), null)
})

test('performerSubCaption: a losing record is suppressed', () => {
  assert.equal(performerSubCaption(gameScoreTop(99), bundleWithRecord(99, 8, 11)), null)
})

test('performerSubCaption: a strong record on too small a sample is suppressed', () => {
  // 3-0 is a .750 pace but only 3 starts — not enough to mean anything.
  assert.equal(performerSubCaption(gameScoreTop(99), bundleWithRecord(99, 3, 0)), null)
})

test('performerSubCaption: the multi-HR season-HR caption is unaffected', () => {
  const top = { key: 'multiHr', performer: { id: 5 } }
  const bundle = { leaders: { 5: { cats: { hr: 20 } } } }
  assert.equal(performerSubCaption(top, bundle), '20 HR this season')
})

// --------------------------------------------------------------------------
// eliteGameScoreSignal — points scale with Game Score, so an 85 outranks an 80.
// --------------------------------------------------------------------------

// A feed carrying only the away starter's pitching line (home has no starter,
// so the away line is the game's Game Score).
function pitchFeed(pitching) {
  const id = 500
  return {
    gameData: { teams: { away: { id: 10, abbreviation: 'AWY' }, home: { id: 20, abbreviation: 'HOM' } } },
    liveData: {
      boxscore: {
        teams: {
          away: {
            pitchers: [id],
            players: {
              [`ID${id}`]: {
                person: { id, fullName: 'Ace Starter' },
                position: { abbreviation: 'P' },
                stats: { pitching },
              },
            },
          },
          home: { pitchers: [], players: {} },
        },
      },
    },
  }
}

test('eliteGameScoreSignal: an 85 scores more points than an 80', () => {
  // 9 IP, 4 H, 2 ER, 7 K, 0 BB → Game Score 85.
  const gem = eliteGameScoreSignal(
    pitchFeed({ inningsPitched: '9.0', hits: 4, earnedRuns: 2, runs: 2, strikeOuts: 7, baseOnBalls: 0 }),
  )
  // 9 IP, 7 H, 1 ER, 5 K, 1 BB → Game Score 80 (the floor to fire).
  const solid = eliteGameScoreSignal(
    pitchFeed({ inningsPitched: '9.0', hits: 7, earnedRuns: 1, runs: 1, strikeOuts: 5, baseOnBalls: 1 }),
  )
  assert.equal(gem.gs, 85)
  assert.equal(solid.gs, 80)
  assert.equal(gem.points, 30)
  assert.equal(solid.points, 25)
  assert.ok(gem.points > solid.points, 'the better start must rank higher')
})

// --------------------------------------------------------------------------
// Rare-event detectors (cycle / position-player pitching / triple play).
// --------------------------------------------------------------------------

// A full batting-line feed (feedWith only carries homeRuns).
function batFeed(line) {
  return {
    gameData: { teams: { away: { id: 10, abbreviation: 'AWY' }, home: { id: 20, abbreviation: 'HOM' } } },
    liveData: {
      boxscore: {
        teams: {
          away: {
            players: {
              ID1: {
                person: { id: 1, fullName: 'Cy Cleveland' },
                battingOrder: '100',
                position: { abbreviation: 'CF' },
                stats: { batting: line },
              },
            },
          },
          home: { players: {} },
        },
      },
    },
  }
}

test('cycleSignal: single+double+triple+HR in one game fires the cycle', () => {
  // 4 hits: one each of 1B/2B/3B/HR (singles = hits − 2B − 3B − HR = 1).
  const sig = cycleSignal(batFeed({ hits: 4, doubles: 1, triples: 1, homeRuns: 1 }))
  assert.equal(sig.key, 'cycle')
  assert.equal(sig.tier, 0)
  assert.equal(sig.performer.name, 'Cy Cleveland')
})

test('cycleSignal: missing the single (no 1B) does not fire', () => {
  // 3 hits all extra-base → singles = 0, no cycle.
  assert.equal(cycleSignal(batFeed({ hits: 3, doubles: 1, triples: 1, homeRuns: 1 })), null)
})

// A feed whose away team lists a non-pitcher among its pitchers.
function moundFeed(pitcherPos) {
  return {
    gameData: { teams: { away: { id: 10, abbreviation: 'AWY' }, home: { id: 20, abbreviation: 'HOM' } } },
    liveData: {
      boxscore: {
        teams: {
          away: {
            pitchers: [77],
            players: {
              ID77: { person: { id: 77, fullName: 'Utility Guy' }, position: { abbreviation: pitcherPos } },
            },
          },
          home: { pitchers: [], players: {} },
        },
      },
    },
  }
}

test('positionPlayerPitchingSignal: a 1B on the mound fires', () => {
  const sig = positionPlayerPitchingSignal(moundFeed('1B'))
  assert.equal(sig.key, 'positionPlayerPitching')
  assert.equal(sig.performer.id, 77)
})

test('positionPlayerPitchingSignal: a real pitcher (P) does not fire', () => {
  assert.equal(positionPlayerPitchingSignal(moundFeed('P')), null)
})

test('triplePlaySignal: matches the phrase in a play description', () => {
  const feed = {
    liveData: {
      plays: {
        allPlays: [
          { result: { event: 'Groundout', description: 'Grounds out to short.' } },
          { result: { event: 'Triple Play', description: 'Lines into a triple play, second to first.' } },
        ],
      },
    },
  }
  const sig = triplePlaySignal(feed)
  assert.equal(sig.key, 'triplePlay')
  assert.equal(sig.performer, null)
})

test('triplePlaySignal: an ordinary game does not fire', () => {
  const feed = { liveData: { plays: { allPlays: [{ result: { event: 'Single', description: 'Singles to left.' } }] } } }
  assert.equal(triplePlaySignal(feed), null)
})

test('selectGameResults: returns both sides + the winner id per game', () => {
  const entries = [
    { gamePk: 1, feed: feedResult(10, 'AWY', 3, 20, 'HOM', 7) },
    { gamePk: 2, feed: feedResult(30, 'XXX', 5, 40, 'YYY', 2) },
  ]
  const results = selectGameResults(entries)
  assert.equal(results.length, 2)
  assert.deepEqual(results[0].home, { id: 20, abbr: 'HOM', r: 7 })
  assert.equal(results[0].winnerId, 20)
  assert.equal(results[1].winnerId, 30)
})

test('selectGameResults: a tie (or thin 0-0 box) reports no winner', () => {
  // Never silently declare the away side the winner — the Your Team badge
  // depends on this being null so it can show T, not a bogus L.
  const [r] = selectGameResults([{ gamePk: 1, feed: feedResult(10, 'AWY', 4, 20, 'HOM', 4) }])
  assert.equal(r.winnerId, null)
})

// --------------------------------------------------------------------------
// firstSentence — trims to the first REAL sentence, not an abbreviation period.
// --------------------------------------------------------------------------
test('firstSentence: drops the redundant trailing clause', () => {
  assert.equal(
    firstSentence('Ezequiel Duran homers (8) on a fly ball to center field. Brandon Nimmo scores.'),
    'Ezequiel Duran homers (8) on a fly ball to center field',
  )
})

test('firstSentence: does not truncate inside a "Jr." name', () => {
  assert.equal(
    firstSentence('Fernando Tatis Jr. homers (12) on a line drive to left'),
    'Fernando Tatis Jr. homers (12) on a line drive to left',
  )
})

test('firstSentence: does not truncate inside initials like "J.C."', () => {
  assert.equal(
    firstSentence('J.C. Escarra doubles (3) on a sharp ground ball'),
    'J.C. Escarra doubles (3) on a sharp ground ball',
  )
})

// --------------------------------------------------------------------------
// rankDayHighlights — the cross-game trims: keep only the top-2 "dominant
// start" rows across the whole slate, and drop a game whose ONLY story is a
// blowout (or that fired nothing at all). These live in the two-phase ranking,
// not in any single signal, so they need a fuller whole-game feed than the
// per-signal tests above (selectBoxscore reads run/hit/error totals off
// liveData.linescore, batting off teamStats, and each starter's Game Score off
// the first pitcher's pitching line).
// --------------------------------------------------------------------------

// Populate only the fields selectBoxscore + the signals actually read. `away`/
// `home`: { abbr, id, r, h, e, bb, batters:[{id,name,hr,pos}], start:<pitching> }.
function rankFeed({ away = {}, home = {}, innings = 9 } = {}) {
  const oneSide = (s, fallbackId) => {
    const players = {}
    ;(s.batters ?? []).forEach((b, i) => {
      players[`ID${b.id}`] = {
        person: { id: b.id, fullName: b.name },
        battingOrder: `${(i + 1) * 100}`,
        position: { abbreviation: b.pos ?? 'DH' },
        stats: { batting: { homeRuns: b.hr ?? 0 } },
      }
    })
    const pitchers = []
    if (s.start) {
      const pid = s.startId ?? fallbackId
      pitchers.push(pid)
      players[`ID${pid}`] = {
        person: { id: pid, fullName: s.startName ?? 'Starter' },
        position: { abbreviation: 'P' },
        stats: { pitching: s.start },
      }
    }
    return { players, pitchers, teamStats: { batting: { baseOnBalls: s.bb ?? 0, runs: s.r ?? 0, hits: s.h ?? 0 } } }
  }
  return {
    gameData: {
      teams: {
        away: { id: away.id ?? 10, abbreviation: away.abbr ?? 'AWY' },
        home: { id: home.id ?? 20, abbreviation: home.abbr ?? 'HOM' },
      },
    },
    liveData: {
      decisions: {},
      plays: { allPlays: [] },
      boxscore: { info: [], teams: { away: oneSide(away, 900), home: oneSide(home, 901) } },
      linescore: {
        teams: {
          away: { runs: away.r ?? 0, hits: away.h ?? 0, errors: away.e ?? 0, leftOnBase: 0 },
          home: { runs: home.r ?? 0, hits: home.h ?? 0, errors: home.e ?? 0, leftOnBase: 0 },
        },
        innings: Array.from({ length: innings }, (_, i) => ({ num: i + 1, away: { runs: 0 }, home: { runs: 0 } })),
      },
    },
  }
}
const rankEntry = (gamePk, feed) => ({
  gamePk,
  feed,
  winProb: [],
  dateStr: '2026-07-19',
  game: { away: { abbreviation: 'AWY' }, home: { abbreviation: 'HOM' }, gameNumber: 1 },
})
// A dominant start with a given Game Score, plus enough of a win (margin 3, both
// sides with hits) that NO other signal fires — so the only storyline is the
// start itself. 9 IP lines: A→98, B→87, C→83 (all clear the 80 floor).
const dominantGame = (gamePk, pitching) =>
  rankEntry(gamePk, rankFeed({ away: { r: 4, h: 6, start: pitching }, home: { r: 1, h: 5 } }))
const START_98 = { inningsPitched: '9.0', hits: 2, earnedRuns: 0, runs: 0, strikeOuts: 8, baseOnBalls: 0 }
const START_87 = { inningsPitched: '9.0', hits: 4, earnedRuns: 1, runs: 1, strikeOuts: 6, baseOnBalls: 1 }
const START_83 = { inningsPitched: '9.0', hits: 5, earnedRuns: 1, runs: 1, strikeOuts: 4, baseOnBalls: 1 }

test('rankDayHighlights: keeps only the top-2 dominant starts across the slate', () => {
  const ranked = rankDayHighlights(
    [dominantGame(1, START_98), dominantGame(2, START_87), dominantGame(3, START_83)],
    null,
  )
  // The 83 start is the weakest of three — trimmed, and since it was that
  // game's only story the whole game drops off the recap.
  assert.deepEqual(
    ranked.map((e) => e.gamePk),
    [1, 2],
  )
  assert.ok(ranked.every((e) => e.signals.includes('gameScore')))
})

test('rankDayHighlights: the surviving dominant starts sort best-first', () => {
  // Feed them out of order; the 98 must still lead the 87.
  const ranked = rankDayHighlights([dominantGame(2, START_87), dominantGame(1, START_98)], null)
  assert.deepEqual(
    ranked.map((e) => e.gamePk),
    [1, 2],
  )
})

test('rankDayHighlights: a game whose only story is a blowout is dropped', () => {
  // A 10-run laugher with nothing else — no dominant start, no HR, both sides
  // hit (so it isn't a no-hitter). Its lone signal is the blowout, which is the
  // opposite of a highlight.
  const ranked = rankDayHighlights(
    [rankEntry(1, rankFeed({ away: { r: 12, h: 14 }, home: { r: 2, h: 5 } }))],
    null,
  )
  assert.deepEqual(ranked, [])
})

test('rankDayHighlights: a blowout that also has a real story survives on that story', () => {
  // Same 12-2 margin, but the winner has a 2-HR hitter — the multi-HR keeps the
  // game, and it leads on that (NOTABLE) signal, not the blowout.
  const ranked = rankDayHighlights(
    [
      rankEntry(
        7,
        rankFeed({
          away: { r: 12, h: 14, batters: [{ id: 55, name: 'Big Fly', hr: 2 }] },
          home: { r: 2, h: 5 },
        }),
      ),
    ],
    null,
  )
  assert.equal(ranked.length, 1)
  assert.equal(ranked[0].gamePk, 7)
  assert.ok(ranked[0].signals.includes('multiHr'))
  assert.equal(ranked[0].performer.id, 55)
})

test('rankDayHighlights: a quiet game with no fired signal is dropped', () => {
  const ranked = rankDayHighlights(
    [rankEntry(1, rankFeed({ away: { r: 4, h: 8 }, home: { r: 1, h: 6 } }))],
    null,
  )
  assert.deepEqual(ranked, [])
})

// gameNumber rides on each result so the Your Team block can label a twin bill.
test('selectGameResults: carries gameNumber for doubleheader labeling', () => {
  const results = selectGameResults([
    { gamePk: 1, feed: feedResult(10, 'AWY', 3, 20, 'HOM', 7), dateStr: '2026-07-19', game: dhGame(1) },
    { gamePk: 2, feed: feedResult(10, 'AWY', 5, 20, 'HOM', 2), dateStr: '2026-07-19', game: dhGame(2) },
  ])
  assert.equal(results[0].gameNumber, 1)
  assert.equal(results[1].gameNumber, 2)
})
const dhGame = (gameNumber) => ({
  away: { abbreviation: 'AWY' },
  home: { abbreviation: 'HOM' },
  gameNumber,
})

// Minimal feed selectGameResults reads run totals + ids from.
function feedResult(awayId, awayAbbr, awayR, homeId, homeAbbr, homeR) {
  const team = (runs) => ({ teamStats: { batting: { runs } } })
  return {
    gameData: { teams: { away: { id: awayId, abbreviation: awayAbbr }, home: { id: homeId, abbreviation: homeAbbr } } },
    liveData: { boxscore: { teams: { away: team(awayR), home: team(homeR) } } },
  }
}

test('eliteGameScoreSignal: a start under 80 does not fire', () => {
  // 6 IP, 5 H, 3 ER, 4 K → well under the 80 floor.
  assert.equal(
    eliteGameScoreSignal(
      pitchFeed({ inningsPitched: '6.0', hits: 5, earnedRuns: 3, runs: 3, strikeOuts: 4, baseOnBalls: 2 }),
    ),
    null,
  )
})
