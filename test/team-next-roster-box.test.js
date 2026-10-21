import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  benchRows,
  lineupRows,
  metaById,
  penRows,
  penWeekFigures,
  rotationRows,
  seasonLineOf,
  warLeaderId,
  warSum,
  warText,
} from '../src/screens/team/next/roster/boxRows.js'

const none = new Set()

test('WAR reads to one place, and a missing WAR is a dash', () => {
  assert.equal(warText(5.94), '5.9')
  assert.equal(warText(-0.1), '-0.1')
  assert.equal(warText(null), '—')
  assert.equal(warText(undefined), '—')
})

test('the WAR leader is the highest WAR; a tie keeps the first; no WAR, no leader', () => {
  assert.equal(warLeaderId([{ id: 1, war: 2 }, { id: 2, war: 5.9 }, { id: 3, war: 5.9 }]), 2)
  assert.equal(warLeaderId([{ id: 1, war: null }, { id: 2, war: -1 }]), 2)
  assert.equal(warLeaderId([{ id: 1, war: undefined }]), null)
})

test('the WAR sum skips a row with no WAR', () => {
  assert.equal(warSum([{ war: 1.5 }, { war: null }, { war: 2 }]).toFixed(1), '3.5')
})

test('a lineup spot takes its number, WAR and marks from the roster lists', () => {
  const d = {
    position: [{ id: 7, jersey: '24', war: 3, allStar: true, rookie: false, prospect: null }],
    pitchers: [{ id: 7, jersey: '24', war: 9 }],
  }
  const [row] = lineupRows([{ id: 7, name: 'William Contreras', position: 'C', hurt: true }], metaById(d))
  assert.deepEqual(row, { id: 7, name: 'William Contreras', jersey: '24', war: 3, allStar: true, prospect: null, rookie: false, hurt: true, lead: 'C', line: '' })
})

test('a lineup spot missing from every list still draws, with no number and no WAR', () => {
  const [row] = lineupRows([{ id: 9, name: 'Jake Bauers', position: '1B' }], metaById({}))
  assert.equal(row.jersey, '')
  assert.equal(row.war, null)
  assert.equal(row.lead, '1B')
})

test('a substitute is led by his roster position and flagged when he is on the IL', () => {
  const [row] = benchRows([{ id: 3, name: 'Joey Ortiz', jersey: '3', pos: 'SS', war: 2.9 }], new Map(), new Set([3]))
  assert.equal(row.lead, 'SS')
  assert.equal(row.hurt, true)
})

test('the rotation is led by its slot, in the loader order', () => {
  const rows = rotationRows([{ id: 1, name: 'A' }, { id: 2, name: 'B' }], none)
  assert.deepEqual(rows.map((r) => r.lead), ['1', '2'])
})

test('the bullpen reads CL only for the 40-man closer, RP for everyone else', () => {
  const rows = penRows([{ id: 29, name: 'Trevor Megill' }, { id: 26, name: 'Aaron Ashby' }, { id: 52, name: 'Kyle Harrison' }], none, [
    { id: 29, role: 'CL' },
    { id: 52, role: 'SP' },
  ])
  assert.deepEqual(rows.map((r) => r.lead), ['CL', 'RP', 'RP'])
})

test('the season line needs an outing; the Current view lists carry none', () => {
  assert.equal(seasonLineOf({ appearances: 30, ip: '174.2', era: '3.12' }), '30 G · 174.2 IP · 3.12 ERA')
  assert.equal(seasonLineOf({ appearances: 4 }), '4 G · — IP · — ERA')
  assert.equal(seasonLineOf({ name: 'Current-view arm' }), '')
  assert.equal(seasonLineOf({ appearances: 0, ip: '0.0' }), '')
})

test('the pen week figures read yesterday off the cell before today', () => {
  const cell = (pitches, today = false) => ({ pitches, today })
  const grid = [
    { name: 'Aaron Ashby', last7dayPitches: 39, cells: [cell(0), cell(39), cell(0, true)] },
    { name: 'DL Hall', last7dayPitches: 28, cells: [cell(28), cell(0), cell(0, true)] },
  ]
  const fig = penWeekFigures(grid)
  assert.equal(fig.pitched, 1)
  assert.equal(fig.arms, 2)
  assert.equal(fig.total, 67)
  assert.equal(fig.busiest.name, 'Aaron Ashby')
})

test('a quiet pen week has no busiest arm, and no grid has no figures', () => {
  const fig = penWeekFigures([{ name: 'A', last7dayPitches: 0, cells: [{}, {}] }])
  assert.equal(fig.busiest, null)
  assert.equal(penWeekFigures(null), null)
  assert.equal(penWeekFigures([]), null)
})
