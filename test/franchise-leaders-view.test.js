import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CATEGORY_COUNT, leadersView } from '../src/screens/team/franchise/leaders/leadersView.js'

// #2785: the franchise page's all-time leaders card, on the real Brewers file.
const brewers = JSON.parse(readFileSync(new URL('../public/data/franchise-leaders/158.json', import.meta.url), 'utf8'))

test('leadersView: closed, the nine headline lists, five rows each', () => {
  const v = leadersView(brewers, 'career', false)
  assert.deepEqual(v.map((g) => g.lists.map((l) => l.label)), [
    ['Home runs', 'Hits', 'Average', 'RBI', 'Stolen bases'],
    ['Wins', 'Strikeouts', 'ERA', 'Saves'],
  ])
  assert.deepEqual(v[0].lists[0].rows[0], { rank: 1, id: 460075, name: 'Ryan Braun', value: '352', season: null })
  assert.ok(v.every((g) => g.lists.every((l) => l.rows.length === 5)))
})

test('leadersView: open, all 26 categories, the headline ones first; season rows carry the year', () => {
  const v = leadersView(brewers, 'season', true)
  assert.equal(CATEGORY_COUNT, 26)
  assert.equal(v[0].lists.length + v[1].lists.length, 26)
  assert.equal(v[1].lists[4].label, 'Innings')
  assert.equal(v[0].lists[0].rows[0].season, 2007)
})

test('leadersView: ties keep the store rank; a missing category or group is left out', () => {
  const games = leadersView(brewers, 'season', true)[0].lists.find((l) => l.key === 'gamesPlayed')
  assert.deepEqual(games.rows.map((r) => r.rank), [1, 1, 1, 1, 1])
  assert.deepEqual(leadersView({ career: { wins: [{ rank: 1, id: 1, name: 'A', value: '9' }] } }, 'career', false).map((g) => g.key), ['pitching'])
  assert.deepEqual(leadersView(null, 'career', true), [])
})
