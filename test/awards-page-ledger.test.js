import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_MLB_KEY,
  countAnnounced,
  isRosterAward,
  mergeAllMlb,
  pastWinners,
  seasonRows,
  splitName,
} from '../src/api/awards/ledger.js'

const w = (name, league = null) => ({ name, league, playerId: name.length, teamId: 158 })

test('splitName puts everything after the first space in the last name', () => {
  assert.deepEqual(splitName('Pete Crow-Armstrong'), ['Pete', 'Crow-Armstrong'])
  assert.deepEqual(splitName('Vladimir Guerrero Jr.'), ['Vladimir', 'Guerrero Jr.'])
  assert.deepEqual(splitName('Ichiro'), ['', 'Ichiro'])
  assert.deepEqual(splitName(undefined), ['', ''])
})

test('pastWinners leaves out the live season and sorts newest first, by league', () => {
  const family = {
    key: 'MVP',
    years: {
      2024: [w('Aaron Judge', 'AL'), w('Shohei Ohtani', 'NL')],
      2026: [w('Yordan Alvarez', 'AL'), w('Pete Crow-Armstrong', 'NL')],
      2025: [w('Aaron Judge', 'AL'), w('Shohei Ohtani', 'NL')],
    },
  }
  const { columns, rows } = pastWinners(family, 2026)
  assert.deepEqual(columns.map((c) => c.key), ['AL', 'NL'])
  assert.deepEqual(rows.map((r) => r.year), [2025, 2024])
  assert.equal(rows[0].cells.AL[0].name, 'Aaron Judge')
  assert.equal(rows[0].cells.NL[0].name, 'Shohei Ohtani')
})

test('pastWinners keeps every year when no season is in play', () => {
  const family = { key: 'MVP', years: { 2025: [w('A B', 'AL')], 2026: [w('C D', 'AL')] } }
  assert.deepEqual(pastWinners(family, null).rows.map((r) => r.year), [2026, 2025])
})

test('an MLB-wide award is one column', () => {
  const family = { key: 'Roberto Clemente Award', years: { 2025: [w('Mookie Betts')] } }
  const { columns, rows } = pastWinners(family)
  assert.deepEqual(columns.map((c) => c.key), ['MLB'])
  assert.equal(rows[0].cells.MLB[0].name, 'Mookie Betts')
})

test('mergeAllMlb joins the two teams into one family with First and Second columns', () => {
  const families = [
    { key: 'MVP', years: {} },
    { key: 'All-MLB First Team', years: { 2025: [w('Aaron Judge')] } },
    { key: 'All-MLB Second Team', years: { 2025: [w('Bo Bichette')], 2024: [w('Juan Soto')] } },
  ]
  const merged = mergeAllMlb(families)
  assert.deepEqual(merged.map((f) => f.key), ['MVP', ALL_MLB_KEY])
  const { columns, rows } = pastWinners(merged[1])
  assert.deepEqual(columns.map((c) => c.key), ['First', 'Second'])
  assert.deepEqual(rows.map((r) => r.year), [2025, 2024])
  assert.equal(rows[0].cells.First[0].name, 'Aaron Judge')
  assert.equal(rows[0].cells.Second[0].name, 'Bo Bichette')
  assert.deepEqual(rows[1].cells.First, [])
})

test('mergeAllMlb leaves a file with no All-MLB teams alone', () => {
  const families = [{ key: 'MVP', years: {} }]
  assert.deepEqual(mergeAllMlb(families), families)
})

test('roster awards are the multi-winner ones', () => {
  assert.equal(isRosterAward('Gold Glove'), true)
  assert.equal(isRosterAward('Silver Slugger'), true)
  assert.equal(isRosterAward('All-MLB First Team'), true)
  assert.equal(isRosterAward('Platinum Glove'), false)
  assert.equal(isRosterAward('MVP'), false)
})

test('seasonRows marks league splits and countAnnounced counts whole families', () => {
  const families = [
    { key: 'MVP', label: 'MVP', awards: [
      { id: 'ALMVP', league: 'AL', status: 'announced', recipients: [w('Y A', 'AL')] },
      { id: 'NLMVP', league: 'NL', status: 'pending', recipients: [] },
    ] },
    { key: 'Roberto Clemente Award', label: 'Roberto Clemente Award', awards: [
      { id: 'MLBRC', league: null, status: 'announced', recipients: [w('F L')] },
    ] },
  ]
  const rows = seasonRows(families)
  assert.equal(rows[0].split, true)
  assert.equal(rows[1].split, false)
  assert.equal(rows[0].cells[1].status, 'pending')
  assert.equal(countAnnounced(families), 1)
})
