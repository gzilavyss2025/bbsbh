// featsForGame (src/api/notable/notable.js): the box score's feat label lines, read
// from the three public/data/notable/ files. Offline: each row below is copied from
// the committed files, trimmed to the keys the label reads.
import test from 'node:test'
import assert from 'node:assert/strict'
import { featsForGame } from '../src/api/notable/notable.js'

const club = (id, abbr, name, runs) => ({ id, abbr, name, runs })
const doc = (rows) => ({ coverage: {}, rows })

// 1956-10-08 BRO@NYY, World Series game 5: Don Larsen, one pitcher.
const larsen = {
  gamePk: 67524, side: 'home',
  away: club(119, 'BRO', 'Brooklyn Dodgers', 0), home: club(147, 'NYY', 'New York Yankees', 2),
  pitchers: [{ id: 117514, name: 'Don Larsen' }],
}
// 2021-07-07 CLE@TB, game 2 of a seven-inning doubleheader: five Rays pitchers.
const rays = {
  gamePk: 633360, side: 'home',
  away: club(114, 'CLE', 'Cleveland Indians', 0), home: club(139, 'TB', 'Tampa Bay Rays', 4),
  pitchers: [
    { id: 543521, name: 'Collin McHugh' }, { id: 676596, name: 'Josh Fleming' },
    { id: 650895, name: 'Diego Castillo' }, { id: 605538, name: 'Matt Wisler' },
    { id: 664126, name: 'Pete Fairbanks' },
  ],
  shortened: true,
}
// 2022-05-15 CIN@PIT: no Pirates hit, eight innings in the field, and the Reds lost 0-1.
const greene = {
  gamePk: 662519, side: 'away',
  away: club(113, 'CIN', 'Cincinnati Reds', 0), home: club(134, 'PIT', 'Pittsburgh Pirates', 1),
  pitchers: [{ id: 668881, name: 'Hunter Greene' }, { id: 605521, name: 'Art Warren' }],
  shortened: true, lost: true,
}
// 2025-07-12 PIT@MIN: Byron Buxton's cycle.
const buxton = {
  gamePk: 777134, side: 'home',
  away: club(134, 'PIT', 'Pittsburgh Pirates', 4), home: club(142, 'MIN', 'Minnesota Twins', 12),
  player: { id: 621439, name: 'Byron Buxton' },
}
// 2025-08-12 LAD@LAA: the Angels turned it. A triple play row's side is the club in the field.
const angels = {
  gamePk: 776763, side: 'home',
  away: club(119, 'LAD', 'Los Angeles Dodgers', 6), home: club(108, 'LAA', 'Los Angeles Angels', 7),
}
// 1996-06-06 CWS@BOS: John Valentin's cycle, and a White Sox triple play in the same game.
const head = { gamePk: 211726, away: club(145, 'CWS', 'Chicago White Sox', 4), home: club(111, 'BOS', 'Boston Red Sox', 7) }
const valentin = { ...head, side: 'home', player: { id: 123608, name: 'John Valentin' } }
const whiteSox = { ...head, side: 'away' }

const docs = {
  nohitters: doc([rays, greene, larsen]),
  cycles: doc([buxton, valentin]),
  tripleplays: doc([angels, whiteSox]),
}

test('a no-hitter by one pitcher names him', () => {
  assert.deepEqual(featsForGame(docs, 67524), ['No-hitter: Don Larsen'])
})

test('five pitchers make a combined no-hitter, and a short game says so', () => {
  assert.deepEqual(featsForGame(docs, 633360), [
    'Combined no-hitter (shortened): Collin McHugh, Josh Fleming, Diego Castillo, Matt Wisler, Pete Fairbanks',
  ])
})

test('a no-hitter the club lost says "lost"', () => {
  assert.deepEqual(featsForGame(docs, 662519), ['Combined no-hitter (shortened, lost): Hunter Greene, Art Warren'])
})

test('a cycle names the batter', () => {
  assert.deepEqual(featsForGame(docs, 777134), ['Cycle: Byron Buxton'])
})

test('a triple play names the club in the field', () => {
  assert.deepEqual(featsForGame(docs, 776763), ['Triple play: Los Angeles Angels'])
})

test('a game with a cycle and a triple play gets both lines', () => {
  assert.deepEqual(featsForGame(docs, 211726), ['Cycle: John Valentin', 'Triple play: Chicago White Sox'])
})

test('no-hitters come first', () => {
  const both = { nohitters: doc([larsen]), cycles: doc([{ ...buxton, gamePk: 67524 }]), tripleplays: doc([]) }
  assert.deepEqual(featsForGame(both, 67524), ['No-hitter: Don Larsen', 'Cycle: Byron Buxton'])
})

test('a game with no feat gets no line', () => {
  assert.deepEqual(featsForGame(docs, 777135), [])
})

test('a missing or empty file gives no line, and costs the other files nothing', () => {
  assert.deepEqual(featsForGame(null, 777134), [])
  assert.deepEqual(featsForGame({}, 777134), [])
  assert.deepEqual(featsForGame({ nohitters: null, cycles: doc([]), tripleplays: doc([angels]) }, 777134), [])
  assert.deepEqual(featsForGame({ nohitters: null, cycles: { coverage: {} }, tripleplays: doc([angels]) }, 776763), [
    'Triple play: Los Angeles Angels',
  ])
})

test('a row with a missing or empty name still gives the feat, and never throws', () => {
  const thin = {
    nohitters: doc([{ gamePk: 1, side: 'home' }]),
    cycles: doc([{ gamePk: 1, side: 'home', player: { id: 9, name: '' } }, { gamePk: 1, side: 'away' }]),
    tripleplays: doc([{ gamePk: 1, side: 'home' }]),
  }
  assert.deepEqual(featsForGame(thin, 1), ['No-hitter', 'Cycle', 'Cycle', 'Triple play'])
})
