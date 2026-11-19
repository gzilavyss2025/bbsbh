// How a player joined his club, his draft pedigree (src/lib/trade/pedigree.js),
// and the organization's depth before and after a deal (src/lib/trade/depth.js).
// Rows are shaped like statsapi's /people?hydrate=draft,transactions, trimmed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acquisitionOf, draftOf, pedigreeLine } from '../src/lib/trade/pedigree.js'
import { depthGrid, thinnest, needBy } from '../src/lib/trade/depth.js'

const MIL = 158
const orgOf = new Map([[158, 158], [556, 158], [5015, 158], [145, 145]])

test('a traded first-rounder reads as a trade, with the pick he was taken at', () => {
  // Andrew Vaughn: drafted 3rd overall by the White Sox in 2019, traded to Milwaukee 2025-06-13.
  const vaughn = {
    drafts: [{ year: '2019', pickRound: '1', pickNumber: 3, team: { id: 145 } }],
    transactions: [
      { typeCode: 'SGN', date: '2019-06-20', toTeam: { id: 145 } },
      { typeCode: 'TR', date: '2025-06-13', fromTeam: { id: 145 }, toTeam: { id: MIL } },
      { typeCode: 'OPT', date: '2025-07-01', fromTeam: { id: MIL }, toTeam: { id: 556 } },
    ],
  }
  assert.deepEqual(acquisitionOf(vaughn, MIL, { orgOf }), { kind: 'trade', date: '2025-06-13', fromId: 145 })
  assert.deepEqual(draftOf(vaughn), { year: 2019, round: '1', pick: 3, teamId: 145 })
})

test('a club draft pick reads as drafted; a move between its own affiliates is not an acquisition', () => {
  const frelick = {
    drafts: [{ year: '2021', pickRound: '1', pickNumber: 15, team: { id: MIL } }],
    transactions: [{ typeCode: 'TR', date: '2023-05-01', fromTeam: { id: 556 }, toTeam: { id: 5015 } }],
  }
  assert.equal(acquisitionOf(frelick, MIL, { orgOf }).kind, 'draft')
})

test('a teenage signing born abroad is an international signing; an older one is a free agent', () => {
  const sfa = (birthDate, birthCountry) => ({
    birthDate,
    birthCountry,
    transactions: [{ typeCode: 'SFA', date: '2024-01-15', toTeam: { id: MIL } }],
  })
  assert.equal(acquisitionOf(sfa('2007-05-08', 'Dominican Republic'), MIL, { orgOf }).kind, 'intl')
  assert.equal(acquisitionOf(sfa('1995-05-08', 'Venezuela'), MIL, { orgOf }).kind, 'fa')
  assert.equal(acquisitionOf(sfa('2007-05-08', 'USA'), MIL, { orgOf }).kind, 'fa')
})

test('a player re-drafted keeps his latest pick, and a player never drafted has none', () => {
  const ashby = { drafts: [{ year: '2017', pickRound: '25', pickNumber: 764 }, { year: '2018', pickRound: '4', pickNumber: 125 }] }
  assert.equal(draftOf(ashby).year, 2018)
  assert.equal(draftOf({ drafts: [] }), null)
})

test('the depth grid moves a traded player out of his cell and an arrival into his', () => {
  const mine = [
    { id: 1, pos: 'SS', level: 'MLB' },
    { id: 2, pos: 'SS', level: 'AA' },
    { id: 3, pos: 'RHP', level: 'AAA' },
  ]
  const rows = depthGrid(mine, { out: [{ id: 2 }], inn: [{ id: 9, pos: 'CF', level: 'MLB' }] })
  const ss = rows.find((r) => r.slot === 'SS').cells
  assert.deepEqual([ss.MLB.before, ss.MLB.after, ss.AA.before, ss.AA.after], [1, 1, 1, 0])
  assert.equal(rows.find((r) => r.slot === 'P').cells.AAA.before, 1)
  const of = rows.find((r) => r.slot === 'OF').cells.MLB
  assert.deepEqual([of.before, of.after, of.in.length], [0, 1, 1])
})

test('the thinnest slots are judged against what a club carries there', () => {
  const players = [
    ...Array.from({ length: 12 }, (_, i) => ({ id: i, pos: 'P', level: 'MLB' })),
    { id: 50, pos: 'C', level: 'MLB' },
    { id: 51, pos: 'C', level: 'AAA' },
    { id: 52, pos: '2B', level: 'MLB' },
  ]
  const need = thinnest(depthGrid(players), { count: 3 }).map((n) => n.slot)
  // 1B, SS, 3B and OF hold nobody; 1B comes first in slot order.
  assert.deepEqual(need, ['1B', 'SS', '3B'])
})

test('the pedigree line says how he came, then the pick when it is another fact', () => {
  const abbr = (id) => ({ 145: 'CWS' })[id]
  assert.equal(pedigreeLine({ kind: 'draft', date: '2021-07-01' }, { year: 2021, round: '1', pick: 15 }), "Drafted R1 #15 '21")
  assert.equal(pedigreeLine({ kind: 'trade', date: '2025-06-13', fromId: 145 }, { year: 2019, round: '1', pick: 3 }, abbr), "Trade · CWS '25 · R1 #3 '19")
  assert.equal(pedigreeLine({ kind: 'intl', date: '2024-01-15' }, null), "Intl signing '24")
  assert.equal(pedigreeLine(null, null), null)
})

test('need by WAR and by starter read the players left near the majors', () => {
  const mine = [
    { id: 1, pos: '2B', level: 'MLB', war: 5.9, name: 'Turang' },
    { id: 2, pos: '2B', level: 'MLB', war: 0.3, name: "O'Rae" },
    { id: 3, pos: 'SS', level: 'MLB', war: 2.1, name: 'Ortiz' },
  ]
  const rows = depthGrid(mine, { out: [{ id: 1 }] })
  const war = needBy(rows, 'war', { count: 7 }).find((n) => n.slot === '2B')
  assert.equal(Math.round(war.war * 10) / 10, 0.3)
  assert.equal(Math.round(war.change * 10) / 10, -5.9)
  const starter = needBy(rows, 'starter', { count: 6 })
  assert.equal(starter.find((n) => n.slot === '2B').starter, false)
  assert.equal(starter.find((n) => n.slot === 'SS').best.name, 'Ortiz')
})
