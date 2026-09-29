import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_CLUBS,
  archiveRows,
  clubOptions,
  csvFileName,
  csvText,
  defaultClub,
} from '../src/lib/gameNotes/archive.js'

// Pure helpers behind the /game-notes archive page (#1258). Nothing here fetches:
// the page hands in the shards it loaded and a name lookup.

const NAMES = { 158: 'Milwaukee Brewers', 138: 'St. Louis Cardinals', 112: 'Chicago Cubs' }
const nameOf = (id) => NAMES[id] ?? ''
const note = (date, title, url = `https://img.mlbstatic.com/x/${date}-${title}.pdf`) => ({
  date,
  title,
  url,
})

test('archiveRows flattens shards into one row per note, newest first', () => {
  const rows = archiveRows(
    [
      { teamId: 158, notes: [note('2026-09-26', 'B'), note('2026-09-27', 'A')] },
      { teamId: 138, notes: [note('2026-09-27', 'C')] },
    ],
    nameOf,
  )
  assert.equal(rows.length, 3)
  assert.deepEqual(
    rows.map((r) => r.date),
    ['2026-09-27', '2026-09-27', '2026-09-26'],
  )
})

test('archiveRows breaks a date tie by club name, then title, so the order never shifts', () => {
  const shards = [
    { teamId: 158, notes: [note('2026-09-27', 'Game 2'), note('2026-09-27', 'Game 1')] },
    { teamId: 138, notes: [note('2026-09-27', 'Game 1')] },
  ]
  const a = archiveRows(shards, nameOf)
  const b = archiveRows([...shards].reverse(), nameOf)
  assert.deepEqual(
    a.map((r) => [r.club, r.title]),
    [
      ['Milwaukee Brewers', 'Game 1'],
      ['Milwaukee Brewers', 'Game 2'],
      ['St. Louis Cardinals', 'Game 1'],
    ],
  )
  assert.deepEqual(b, a)
})

test('archiveRows row shape is date, teamId, club, title, url', () => {
  const [row] = archiveRows(
    [{ teamId: 158, notes: [note('2026-09-27', 'T', 'https://u/p.pdf')] }],
    nameOf,
  )
  assert.deepEqual(row, {
    date: '2026-09-27',
    teamId: 158,
    club: 'Milwaukee Brewers',
    title: 'T',
    url: 'https://u/p.pdf',
  })
})

test('archiveRows drops a row with no url or no date, and never throws on a bad shard', () => {
  const rows = archiveRows(
    [
      {
        teamId: 158,
        notes: [note('2026-09-27', 'ok'), { date: '2026-09-26', title: 'x' }, { title: 'y', url: 'u' }],
      },
      { teamId: 138 },
      null,
    ],
    nameOf,
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, 'ok')
})

test('archiveRows falls back to a plain title when the row has none', () => {
  const [row] = archiveRows([{ teamId: 158, notes: [{ date: '2026-09-27', url: 'u' }] }], nameOf)
  assert.equal(row.title, 'Game Notes')
})

test('clubOptions puts the favorite first, then All clubs, then the rest by name', () => {
  const clubs = [
    { id: 158, name: 'Milwaukee Brewers' },
    { id: 138, name: 'St. Louis Cardinals' },
    { id: 112, name: 'Chicago Cubs' },
  ]
  assert.deepEqual(
    clubOptions(clubs, 138).map((o) => o.value),
    [138, ALL_CLUBS, 112, 158],
  )
})

test('clubOptions with no MLB favorite starts at All clubs (a MiLB id never appears)', () => {
  const clubs = [
    { id: 158, name: 'Milwaukee Brewers' },
    { id: 112, name: 'Chicago Cubs' },
  ]
  for (const fav of [null, undefined, 999, 'x']) {
    assert.deepEqual(
      clubOptions(clubs, fav).map((o) => o.value),
      [ALL_CLUBS, 112, 158],
    )
  }
})

test('defaultClub is the MLB favorite, else All clubs, and a valid ?team= wins over both', () => {
  const ids = [158, 138]
  assert.equal(defaultClub({ favoriteId: 138, requestedId: null, clubIds: ids }), 138)
  assert.equal(defaultClub({ favoriteId: 999, requestedId: null, clubIds: ids }), ALL_CLUBS)
  assert.equal(defaultClub({ favoriteId: null, requestedId: null, clubIds: ids }), ALL_CLUBS)
  assert.equal(defaultClub({ favoriteId: 138, requestedId: 158, clubIds: ids }), 158)
  assert.equal(defaultClub({ favoriteId: 138, requestedId: 999, clubIds: ids }), 138)
})

test('csvText writes the header, then one line per row, and quotes a title with a comma', () => {
  const rows = [
    {
      date: '2026-09-27',
      teamId: 158,
      club: 'Milwaukee Brewers',
      title: 'Game Notes, September 27 vs. St. Louis',
      url: 'https://img.mlbstatic.com/a.pdf',
    },
  ]
  const lines = csvText(rows).split('\r\n')
  assert.equal(lines[0], 'date,teamId,club,title,url')
  assert.equal(
    lines[1],
    '2026-09-27,158,Milwaukee Brewers,"Game Notes, September 27 vs. St. Louis",https://img.mlbstatic.com/a.pdf',
  )
  assert.equal(lines.length, 3) // header, row, trailing newline
  assert.equal(lines[2], '')
})

test('csvText doubles a quote and quotes a field holding a line break', () => {
  const rows = [{ date: 'd', teamId: 1, club: 'c', title: 'He said "go"\nnow', url: 'u' }]
  assert.equal(csvText(rows).split('\r\n')[1], 'd,1,c,"He said ""go""\nnow",u')
})

test('csvText of no rows is the header alone', () => {
  assert.equal(csvText([]), 'date,teamId,club,title,url\r\n')
})

test('csvFileName carries the day it was saved', () => {
  assert.equal(csvFileName('2026-09-29'), 'game-notes-links-2026-09-29.csv')
})
