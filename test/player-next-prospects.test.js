// The new player page's Prospect rankings view (modules/prospects/prospectsView.js, #1927).
import test from 'node:test'
import assert from 'node:assert/strict'
import { prospectsView } from '../src/screens/player/next/modules/prospects/prospectsView.js'

const sources = { 'mlb-pipeline': { label: 'MLB Pipeline', seasons: [2009, 2024], credit: ['MLB Pipeline top prospects, 2009–2024.'] } }
const depths = { 2018: 100, 2019: 100, 2020: 99, 2021: 99, 2022: 100, 2023: 100 }
const MP = 'mlb-pipeline'
const history = {
  sources,
  depths,
  players: {
    668930: [[2021, 95, MP]],
    668904: [[2018, 20, MP], [2019, 5, MP], [2020, 9, MP], [2021, 17, MP], [2022, 46, MP], [2023, 45, MP]],
  },
}
const snapshot = {
  players: [{ playerId: 815908, rank: 1 }],
  orgProspects: [{ playerId: 815908, orgRank: 1, teamId: 158 }],
}
const empty = { players: [], orgProspects: [] }

test('one list, then the debut: the rank reads "#N", with no "of X"', () => {
  const v = prospectsView({ history, snapshot: empty, playerId: 668930, debutYear: 2023, currentSeason: 2026 })
  assert.equal(v.badge, '1 list')
  // The coverage note keeps a missing year from reading as a fall from the list.
  assert.match(v.note, /Lists cover 2018–2023\./)
  assert.match(v.note, /A year with no line means he was not on that year's list\./)
  assert.match(v.note, /There is no data for 2024–2025\./)
  assert.deepEqual(
    v.rows.map((r) => [r.tone, r.year, r.label, r.rank, r.delta]),
    [
      ['rank', 2021, 'MLB Pipeline', '#95', ''],
      ['debut', 2023, 'Debuted', '', ''],
    ],
  )
})

test('six lists: each row carries the change from the last list, and the debut follows its own year', () => {
  const v = prospectsView({ history, snapshot: empty, playerId: 668904, debutYear: 2022 })
  assert.equal(v.badge, '6 lists')
  assert.deepEqual(
    v.rows.map((r) => r.delta),
    ['', '+15', '−4', '−8', '−29', '', '+1'],
  )
  assert.equal(v.rows[5].tone, 'debut')
  assert.equal(v.rows[5].year, 2022)
})

test('a list of the same rank reads as an equals sign', () => {
  const same = { ...history, players: { 1: [[2022, 7, MP], [2023, 7, MP]] } }
  const v = prospectsView({ history: same, snapshot: empty, playerId: 1 })
  assert.equal(v.rows[1].delta, '=')
})

test("today's list only: the rank on both lists, a note and no debut row", () => {
  const v = prospectsView({ history, snapshot, playerId: 815908 })
  assert.equal(v.badge, 'Prospect')
  assert.deepEqual(
    v.rows.map((r) => [r.tone, r.year, r.label, r.rank]),
    [
      ['today', 'Today', 'Current list · MLB Pipeline', '#1'],
      ['today', 'Today', 'Brewers org list', '#1'],
    ],
  )
  assert.match(v.note, /No earlier lists/)
})

test('on his org list only: one row, and no note', () => {
  const org = { players: [], orgProspects: [{ playerId: 5, orgRank: 12, teamId: 158 }] }
  const v = prospectsView({ history, snapshot: org, playerId: 5 })
  assert.equal(v.rows.length, 1)
  assert.equal(v.rows[0].rank, '#12')
  assert.equal(v.note, '')
})

test('a past list plus today: the past rows, then today, and the credit lines', () => {
  const both = { ...snapshot, players: [{ playerId: 668930, rank: 40 }] }
  const v = prospectsView({ history, snapshot: both, playerId: 668930, debutYear: 2023, currentSeason: 2024 })
  assert.deepEqual(v.rows.map((r) => r.tone), ['rank', 'debut', 'today'])
  assert.match(v.note, /Lists cover 2018–2023 and today's list\./)
  assert.doesNotMatch(v.note, /no data for/)
  assert.deepEqual(v.credits, ['MLB Pipeline top prospects, 2009–2024.'])
})

test('no ranking on file is null, so the card hides', () => {
  assert.equal(prospectsView({ history, snapshot, playerId: 688107, debutYear: 2023 }), null)
  assert.equal(prospectsView({ history: null, snapshot: null, playerId: 688107 }), null)
})
