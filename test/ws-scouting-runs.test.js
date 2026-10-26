// The scouting report lays its cards out in runs: each wide card (Film room, Roster) alone on a
// row, the cards between two of them flowing together in balanced columns (Flow.jsx).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WIDE_CARDS, cardRuns } from '../src/lib/postseason/worldseries/scouting/scouting.js'

const ids = (runs) => runs.map((run) => run.map((c) => c.id))
const cards = (...list) => list.map((id) => ({ id }))

test('wide cards are the Film room and the Roster', () => {
  assert.deepEqual([...WIDE_CARDS].sort(), ['film-room', 'roster'])
})

test('game day: the cards before Film room flow, Film room is alone, the rest flow, Roster is alone', () => {
  const day = cards('matchup-edges', 'pitch-by-pitch', 'platoon', 'film-room', 'park-fit', 'glove-legs', 'roster')
  assert.deepEqual(ids(cardRuns(day)), [['matchup-edges', 'pitch-by-pitch', 'platoon'], ['film-room'], ['park-fit', 'glove-legs'], ['roster']])
})

test('two wide cards in a row are two runs, never one', () => {
  assert.deepEqual(ids(cardRuns(cards('film-room', 'roster'))), [['film-room'], ['roster']])
})

test('no wide card is one run; no cards is no runs', () => {
  assert.deepEqual(ids(cardRuns(cards('platoon', 'park-fit'))), [['platoon', 'park-fit']])
  assert.deepEqual(cardRuns([]), [])
})

test('every card lands in exactly one run, in order', () => {
  const day = cards('nine-keys', 'glove-legs', 'roster', 'matchup-edges', 'film-room', 'platoon')
  assert.deepEqual(cardRuns(day).flat().map((c) => c.id), day.map((c) => c.id))
})
