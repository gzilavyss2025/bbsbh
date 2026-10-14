import test from 'node:test'
import assert from 'node:assert/strict'
import { awardsView, DEFAULT_AWARD_ORDER } from '../src/api/person/awards.js'
import { awardsModView, tierWord } from '../src/screens/player/next/modules/awards/awardsModView.js'

const raw = (name, season, date, team = { id: 158, teamName: 'Brewers' }, id = `X-${name}`) => ({ id, name, season: String(season), date, team })
const ledger = (awards, endDate = null) => awardsView(awards, endDate)

const AWARDS = [
  raw('Gold Glove', 2024, '2024-11-03'),
  raw('Gold Glove', 2023, '2023-11-05'),
  raw('All-Star', 2024, '2024-07-16'),
  raw('Player of the Month', 2025, '2025-08-31', undefined, 'NLPOM'),
  raw('Gasser Cup', 2022, '2022-09-30'),
]

test('no categories gives null, so the module reports empty', () => {
  assert.equal(awardsModView(ledger([]), { order: DEFAULT_AWARD_ORDER, cap: 3 }), null)
  assert.equal(awardsModView(null, { order: DEFAULT_AWARD_ORDER, cap: 3 }), null)
})

test('the top awards by the site order get a table; the rest go to the door, counted from the data', () => {
  const v = awardsModView(ledger(AWARDS), { order: DEFAULT_AWARD_ORDER, cap: 2 })
  assert.equal(v.tabled.length, 2)
  assert.equal(v.tabled[0].key, 'Gold Glove')
  assert.equal(v.tabled[0].count, 2)
  assert.equal(v.rest.length, 2)
  assert.equal(v.restSelections, 2)
  assert.equal(v.tag, '2 of 4 · 5 selections')
  assert.equal(v.doorOpen, 'Show the other 2 awards — 2 selections')
})

test('the door words use the singular for one', () => {
  const v = awardsModView(ledger(AWARDS.slice(0, 3)), { order: DEFAULT_AWARD_ORDER, cap: 1 })
  assert.equal(v.rest.length, 1)
  assert.equal(v.doorOpen, 'Show the other 1 award — 1 selection')
})

test('a cap above the category count shows everything and no door', () => {
  const v = awardsModView(ledger(AWARDS), { order: DEFAULT_AWARD_ORDER, cap: 9 })
  assert.equal(v.tabled.length, 4)
  assert.equal(v.doorOpen, '')
  assert.equal(v.tag, '4 of 4 · 5 selections')
})

test('the site order moves a family to the front', () => {
  const v = awardsModView(ledger(AWARDS), { order: ['Player of the Month', ...DEFAULT_AWARD_ORDER], cap: 1 })
  assert.equal(v.tabled[0].key, 'Player of the Month')
})

test('an in-season award reads month and year; a missing club is a dash, never a guess', () => {
  const wbc = raw('WBC All-Tournament Team', 2026, '2026-03-17', null)
  const v = awardsModView(ledger([...AWARDS, wbc]), { order: DEFAULT_AWARD_ORDER, cap: 9 })
  const potm = v.tabled.find((c) => c.key === 'Player of the Month')
  assert.equal(potm.rows[0].when, 'Aug 2025')
  const w = v.tabled.find((c) => c.label.includes('All-Tournament'))
  assert.equal(w.rows[0].teamName, '')
  assert.equal(w.rows[0].orgId, null)
})

test('asOf before an award date drops that row', () => {
  const v = awardsModView(ledger(AWARDS, '2024-01-01'), { order: DEFAULT_AWARD_ORDER, cap: 9 })
  const gg = v.tabled.find((c) => c.key === 'Gold Glove')
  assert.deepEqual(gg.rows.map((r) => r.when), ['2023'])
  assert.equal(v.tag, '2 of 2 · 2 selections')
})

test('tier keys map to words; an unknown tier reads Other', () => {
  const words = ['yearEnd', 'allStar', 'inSeason', 'press', 'intl', 'minors', 'other'].map(tierWord)
  assert.deepEqual(words, ['Year-end', 'All-Star', 'In-season', 'Press', 'International', 'Minors', 'Other'])
  assert.equal(tierWord('somethingNew'), 'Other')
  assert.equal(tierWord(undefined), 'Other')
})

test('a rest row carries the tier word and every date', () => {
  const v = awardsModView(ledger(AWARDS), { order: DEFAULT_AWARD_ORDER, cap: 1 })
  const gasser = v.rest.find((c) => c.key === 'Gasser Cup')
  assert.equal(gasser.tierWord, 'Other')
  assert.equal(gasser.whens, '2022')
})
