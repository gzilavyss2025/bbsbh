// THE FREE-AGENT CLASS PAGE (#2509): the feed-row mapping, the filters, the
// WAR sort and the header summary. Row shapes are copied from the live
// /api/v1/people/freeAgents?season=2026 response (2026-11-02).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mapFreeAgent,
  filterFreeAgents,
  sortFreeAgents,
  topUnsigned,
  topCard,
  topByGroup,
  statLine,
  statsByPerson,
  cleanNote,
  dealFor,
  positionGroup,
} from '../src/api/free-agents/freeAgents.js'

const WAR = { bat: { 677800: 5.5, 600: 0.4 }, pit: { 669373: 5.2, 600: 0.3 } }

const unsigned = {
  player: { id: 677800, fullName: 'Randy Arozarena' },
  originalTeam: { id: 136, name: 'Seattle Mariners' },
  newTeam: { link: '/api/v1/teams/null' },
  dateDeclared: '2026-10-29',
  position: { abbreviation: 'LF' },
}
const signed = {
  player: { id: 691907, fullName: 'Tsung-Che Cheng' },
  originalTeam: { id: 111, name: 'Boston Red Sox' },
  newTeam: { id: 116, name: 'Detroit Tigers' },
  dateDeclared: '2026-10-05',
  dateSigned: '2026-10-30',
  notes: 'Traded for cash considerations.',
  position: { abbreviation: 'IF' },
}
const minor = {
  player: { id: 1, fullName: 'Minor Leaguer' },
  originalTeam: { id: 158, name: 'Milwaukee Brewers' },
  newTeam: {},
  notes: 'Minor League Free Agent',
  position: { abbreviation: 'RP' },
}
const declined = {
  player: { id: 669373, fullName: 'Tarik Skubal' },
  originalTeam: { id: 119, name: 'Los Angeles Dodgers' },
  newTeam: {},
  notes: 'Club Option Declined',
  position: { abbreviation: 'P' },
}

test('maps an unsigned row with WAR summed from bat and pit', () => {
  const r = mapFreeAgent(unsigned, { war: WAR })
  assert.equal(r.id, 677800)
  assert.equal(r.name, 'Randy Arozarena')
  assert.equal(r.group, 'OF')
  assert.equal(r.teamId, 136)
  assert.equal(r.signed, false)
  assert.equal(r.newTeamId, null)
  assert.equal(r.war, 5.5)
  assert.equal(r.minor, false)
  assert.equal(r.note, '')
  assert.equal(mapFreeAgent({ ...unsigned, player: { id: 600, fullName: 'X' } }, { war: WAR }).war, 0.7)
})

test('maps a signed row with its new club and a cleaned note', () => {
  const r = mapFreeAgent(signed, { war: WAR })
  assert.equal(r.signed, true)
  assert.equal(r.newTeamId, 116)
  assert.equal(r.newTeamName, 'Detroit Tigers')
  assert.equal(r.dateSigned, '2026-10-30')
  assert.equal(r.note, 'Traded for cash considerations')
  assert.equal(r.war, null)
})

test('a signing back with the same club is a re-signing', () => {
  const r = mapFreeAgent({ ...signed, newTeam: { id: 111, name: 'Boston Red Sox' } })
  assert.equal(r.signed, true)
  assert.equal(r.resigned, true)
  assert.equal(mapFreeAgent(signed).resigned, false)
  assert.equal(mapFreeAgent(unsigned).resigned, false)
})

test('a signed date with no new club id is not a signing', () => {
  const r = mapFreeAgent({ ...signed, newTeam: { link: '/api/v1/teams/null' } })
  assert.equal(r.signed, false)
  assert.equal(r.dateSigned, null)
})

test('the minor-league note marks the row and is not shown as a note', () => {
  const r = mapFreeAgent(minor)
  assert.equal(r.minor, true)
  assert.equal(r.note, '')
})

test('option-declined notes are counted in every spelling the feed uses', () => {
  for (const n of ['Club Option Declined', 'Club Option Declined.', 'Declined Player Option', 'Mutual Option Declined']) {
    assert.equal(mapFreeAgent({ ...declined, notes: n }).optionDeclined, true, n)
  }
  assert.equal(mapFreeAgent({ ...declined, notes: 'Claimed Off Waivers.' }).optionDeclined, false)
  assert.equal(cleanNote('Claimed Off Waivers.'), 'Claimed off waivers')
})

test('position groups', () => {
  assert.equal(positionGroup('SP'), 'P')
  assert.equal(positionGroup('TWP'), 'P')
  assert.equal(positionGroup('SS'), 'IF')
  assert.equal(positionGroup('CF'), 'OF')
  assert.equal(positionGroup('DH'), 'DH')
  assert.equal(positionGroup('??'), null)
})

const rows = [unsigned, signed, minor, declined].map((r) => mapFreeAgent(r, { war: WAR }))

test('the default filter is MLB only and hides only minor-league free agents', () => {
  const out = filterFreeAgents(rows)
  assert.deepEqual(out.map((r) => r.id), [677800, 691907, 669373])
  assert.equal(filterFreeAgents(rows, { includeMinors: true }).length, 4)
})

test('position, club and unsigned-only filters combine', () => {
  assert.deepEqual(filterFreeAgents(rows, { group: 'P' }).map((r) => r.id), [669373])
  assert.deepEqual(filterFreeAgents(rows, { teamId: 111 }).map((r) => r.id), [691907])
  assert.deepEqual(filterFreeAgents(rows, { unsignedOnly: true }).map((r) => r.id), [677800, 669373])
  assert.deepEqual(filterFreeAgents(rows, { group: 'P', includeMinors: true }).map((r) => r.id), [1, 669373])
})

test('sorts by WAR, highest first, with no-WAR rows last by name', () => {
  assert.deepEqual(sortFreeAgents(rows).map((r) => r.id), [677800, 669373, 1, 691907])
})

test('stat lines for hitters and pitchers', () => {
  const stats = statsByPerson([
    {
      id: 1,
      currentAge: 30,
      stats: [
        { group: { displayName: 'hitting' }, splits: [{ stat: { avg: '.000', obp: '.000', slg: '.000', homeRuns: 0 } }] },
        { group: { displayName: 'pitching' }, splits: [{ stat: { era: '1.72', inningsPitched: '52.1', strikeOuts: 59, saves: 4 } }] },
      ],
    },
    { id: 2, currentAge: 31, stats: [{ group: { displayName: 'hitting' }, splits: [{ stat: { avg: '.281', obp: '.381', slg: '.484', homeRuns: 26 } }] }] },
  ])
  assert.equal(stats[1].age, 30)
  assert.equal(statLine(stats[1], true), '1.72 ERA · 52.1 IP · 59 K · 4 SV')
  assert.equal(statLine(stats[2], false), '.281/.381/.484 · 26 HR')
  assert.equal(statLine(stats[2], true), '')
  assert.equal(statLine(undefined, false), '')
})

test('a last deal shows only when the contract file is the class season', () => {
  const c = { season: 2026, terms: '1 y/$15.65M (26)' }
  assert.equal(dealFor(c, 2026), '1 y/$15.65M (26)')
  // /free-agents/2025 must not show the deal a player signed AFTER filing.
  assert.equal(dealFor(c, 2025), null)
  assert.equal(dealFor({ terms: 'x', source: { season: 2026 } }, 2026), 'x')
  assert.equal(dealFor(null, 2026), null)
})

test('topUnsigned keeps unsigned major leaguers only, best WAR first, capped', () => {
  const rows = [
    { name: 'Signed', war: 9, signed: true, minor: false },
    { name: 'Minor', war: 8, signed: false, minor: true },
    { name: 'Low', war: 1, signed: false, minor: false },
    { name: 'High', war: 5, signed: false, minor: false },
    { name: 'NoWar', war: null, signed: false, minor: false },
    ...['A', 'B', 'C', 'D'].map((name) => ({ name, war: 0.5, signed: false, minor: false })),
  ]
  assert.deepEqual(topUnsigned(rows, 2).map((r) => r.name), ['High', 'Low'])
  assert.deepEqual(topUnsigned(rows).map((r) => r.name), ['High', 'Low', 'A', 'B', 'C', 'D'])
})

test('topUnsigned hides the list when no row has WAR (no alphabetical "top")', () => {
  const rows = [{ name: 'Abner', war: null, signed: false, minor: false }, { name: 'Zed', war: null, signed: false, minor: false }]
  assert.deepEqual(topUnsigned(rows), [])
})

test('topCard: the person record names the two lines, suffix on the last', () => {
  const row = { id: 1, name: 'Carl Edwards Jr.', isPitcher: true }
  const card = topCard(row, { first: 'Carl', last: 'Edwards', suffix: 'Jr.', pitching: { wins: 3, losses: 2, era: '3.10', strikeOuts: 40, whip: '1.20', gamesStarted: 0, saves: 1 } })
  assert.equal(card.first, 'Carl')
  assert.equal(card.last, 'Edwards Jr.')
  assert.deepEqual(card.fields.map((f) => f.k), ['W–L', 'ERA', 'K', 'WHIP'])
  assert.equal(card.fields[1].v, '3.10')
})

test('topCard: a hitter gets hitter fields, and no stats is all dashes', () => {
  const hit = topCard({ id: 2, name: 'Randy Arozarena', isPitcher: false }, { hitting: { avg: '.281', homeRuns: 26, rbi: 79, ops: '.865' } })
  assert.deepEqual(hit.fields.map((f) => f.v), ['.281', '26', '79', '.865'])
  assert.equal(hit.first, 'Randy')
  assert.equal(hit.last, 'Arozarena')
  const none = topCard({ id: 3, name: 'Solo', isPitcher: false }, undefined)
  assert.deepEqual(none.fields.map((f) => f.v), ['—', '—', '—', '—'])
  assert.equal(none.first, '')
  assert.equal(none.last, 'Solo')
})

test('topByGroup: six per position group plus all, each from unsigned only', () => {
  const rows = []
  for (let i = 0; i < 8; i++) rows.push({ id: i, name: `P${i}`, group: 'P', war: i, signed: false, minor: false })
  rows.push({ id: 100, name: 'C0', group: 'C', war: 3.5, signed: false, minor: false })
  rows.push({ id: 101, name: 'C1', group: 'C', war: 9, signed: true, minor: false })
  const g = topByGroup(rows)
  assert.deepEqual(g.all.map((r) => r.id), [7, 6, 5, 4, 100, 3])
  assert.deepEqual(g.P.map((r) => r.id), [7, 6, 5, 4, 3, 2])
  assert.deepEqual(g.C.map((r) => r.id), [100])
  assert.deepEqual(g.OF, [])
})
