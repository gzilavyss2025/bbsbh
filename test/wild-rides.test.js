// WILD RIDES (src/lib/wildrides/): the ride built from a win-probability feed, the story a
// beat writer would tell from it, and the shape word that lets Draw match a sketch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRide, decodeState, encodeState } from '../src/lib/wildrides/ride.js'
import { headlineFor, storyOf, summarize, oddsOf, consequence } from '../src/lib/wildrides/story.js'
import { past, lastName } from '../src/lib/explorers/copy.js'
import { encodeShape, decodeShape, shapeDistance, paa, SEGMENTS } from '../src/lib/wildrides/shape.js'

// A feed entry: the home team's win %, the inning and half, the score after, the batter.
const play = (home, inning, top, away, homeScore, extra = {}) => ({
  homeTeamWinProbability: home,
  about: { inning, isTopInning: top },
  count: { outs: 1 },
  matchup: { batter: { id: 1, fullName: 'Pat Batter Jr.' }, pitcher: { id: 2, fullName: 'Sam Pitcher' } },
  result: { awayScore: away, homeScore, eventType: 'single', event: 'Single', description: 'A single.' },
  ...extra,
})
const meta = { gamePk: 1, date: '2026-08-06', venue: 3, away: 145, home: 111, score: [5, 6], homeWon: true }

// Away goes up 5–0 by the 4th, home ties it in the 8th and walks it off in the 9th.
const comeback = [
  play(40, 1, true, 2, 0),
  play(20, 4, true, 5, 0),
  play(25, 5, false, 5, 1),
  play(55, 8, false, 5, 5),
  play(45, 9, true, 5, 5),
  play(100, 9, false, 5, 6),
]

test('a state packs and unpacks the game after a play', () => {
  const s = { inning: 13, top: false, outs: 2, bases: 5, away: 11, home: 12 }
  const d = decodeState(encodeState(s))
  assert.deepEqual(
    { inning: d.inning, top: d.top, outs: d.outs, away: d.away, home: d.home },
    { inning: 13, top: false, outs: 2, away: 11, home: 12 },
  )
  assert.deepEqual(d.bases, { first: true, second: false, third: true })
  assert.equal(decodeState(undefined).inning, 1, 'before the first play: top of the 1st')
})

test('a feed too short to be a game builds no ride', () => {
  assert.equal(buildRide([], meta), null)
  assert.equal(buildRide([play(60, 1, true, 0, 0)], meta), null)
})

test('the ride: a line from even, the swings in play order, the walk-off marked', () => {
  const r = buildRide(comeback, meta)
  assert.equal(r.line[0], 50)
  assert.equal(r.line.length, comeback.length + 1)
  assert.equal(r.innings, 9)
  assert.deepEqual(r.beats.map((b) => b.idx), [...r.beats.map((b) => b.idx)].sort((a, b) => a - b))
  assert.ok(r.beats.at(-1).walkoff)
  assert.equal(r.beats.filter((b) => b.decider).length, 1)
  assert.equal(r.scoring.length, 5)
})

test('the story counts runs: down 5, answered in the 8th', () => {
  const st = storyOf(buildRide(comeback, meta))
  assert.equal(st.maxDeficit, 5)
  assert.equal(st.deficitInning, 4)
  assert.deepEqual(st.answers, [8], 'the 9th broke a tie, it did not answer a deficit')
  assert.equal(st.ties, 1)
  assert.equal(st.leadChanges, 1)
})

test('a lead carried into the 8th counts as blown late, not only one built there', () => {
  // Away leads 4–0 from the 2nd and keeps it into the 8th; home scores 5 in the 9th.
  const g = buildRide(
    [play(30, 2, true, 4, 0), play(10, 8, true, 4, 0), play(5, 8, false, 4, 0), play(100, 9, false, 4, 5)],
    { ...meta, score: [4, 5] },
  )
  const st = storyOf(g)
  assert.equal(st.lateDeficit, 4)
  assert.equal(st.lateInning, 8)
  assert.match(headlineFor(g), /^The White Sox led by 4 in the 8th and lost/)
})

test('a headline never says "three outs"; a late peak names its inning', () => {
  const g = buildRide(comeback, meta)
  assert.doesNotMatch(headlineFor(g), /three outs/i)
  assert.ok(oddsOf(g).latePeakInning >= 1)
})

test('a game with no swings still gets a headline', () => {
  const g = { ...meta, innings: 9, line: [50, 50], states: [], scoring: [], beats: [] }
  assert.equal(headlineFor(g), 'The Red Sox won 6–5')
})

test('copy: past tense, suffixes dropped, "leads" for one club', () => {
  assert.equal(past('Durbin singles'), 'Durbin singled')
  assert.equal(past('Mead doubles'), 'Mead doubled')
  assert.equal(past('Cowser homers'), 'Cowser homered')
  assert.equal(past('Hader strikes out Raleigh'), 'Hader struck out Raleigh')
  assert.equal(past('Smith flies out'), 'Smith flied out')
  assert.equal(lastName('Pat Batter Jr.'), 'Batter')
  assert.equal(consequence({ score: [9, 8], walkoff: false }, meta), 'CWS leads 9–8')
  assert.equal(consequence({ score: [7, 7], walkoff: false }, meta), 'Tied 7–7')
})

test('a summary carries what a list needs and no line', () => {
  const s = summarize(buildRide(comeback, meta))
  assert.equal(s.line, undefined)
  assert.equal(s.maxDeficit, 5)
  assert.equal(typeof s.headline, 'string')
})

test('the shape word: 24 characters, close to its own line, far from the opposite', () => {
  const rising = Array.from({ length: 80 }, (_, i) => i * 1.25)
  const word = encodeShape(rising)
  assert.equal(word.length, SEGMENTS)
  assert.equal(decodeShape(word).length, SEGMENTS)
  const sketch = paa(rising)
  const falling = encodeShape(rising.map((y) => 100 - y))
  assert.ok(shapeDistance(sketch, word) < shapeDistance(sketch, falling))
})
