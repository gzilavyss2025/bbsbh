import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ALL_CLUBS,
  PAGE_SIZE,
  archiveRows,
  clubOptions,
  csvFileName,
  csvForDownload,
  csvText,
  defaultClub,
  pageRows,
} from '../src/lib/gameNotes/archive.js'
import { fetchArchiveShard, resolveGameNotes } from '../src/api/gameNotes.js'

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

test('defaultClub: ?team=all opens on every club, even for a reader with a favorite', () => {
  assert.equal(defaultClub({ favoriteId: 138, requestedId: ALL_CLUBS, clubIds: [158, 138] }), ALL_CLUBS)
})

test('pageRows mounts one page and says how many rows are held back', () => {
  const rows = Array.from({ length: PAGE_SIZE * 2 + 5 }, (_, i) => i)
  const first = pageRows(rows, PAGE_SIZE)
  assert.equal(first.shown.length, PAGE_SIZE)
  assert.equal(first.left, PAGE_SIZE + 5)
  const all = pageRows(rows, PAGE_SIZE * 3)
  assert.equal(all.shown.length, rows.length)
  assert.equal(all.left, 0)
  assert.deepEqual(pageRows([], PAGE_SIZE), { shown: [], left: 0 })
})

test('csvForDownload is the CSV behind a UTF-8 byte-order mark, so Excel keeps the accents', () => {
  const rows = [{ date: '2026-09-27', teamId: 158, club: 'Milwaukee Brewers', title: 'Café', url: 'https://x/y.pdf' }]
  const text = csvForDownload(rows)
  assert.equal(text.charCodeAt(0), 0xfeff)
  assert.equal(text.slice(1), csvText(rows))
})

// One download per club: the team hub's button and the archive page read the
// same shard, and must not fetch it twice.
test('a shard is fetched once, whether the button or the archive page asks first', async () => {
  const realFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return new Response(JSON.stringify({ notes: [note('2026-01-05', 'Opening series')] }), { status: 200 })
  }
  try {
    const hit = await resolveGameNotes(9991, '2026-01-05')
    assert.equal(hit?.title, 'Opening series')
    const shard = await fetchArchiveShard(9991)
    assert.equal(shard.notes.length, 1)
    assert.equal(calls.filter((u) => u.includes('/data/game-notes/9991.json')).length, 1)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('the button swallows a failed shard, but the archive page still sees the error and can retry', async () => {
  const realFetch = globalThis.fetch
  let ok = false
  globalThis.fetch = async (url) => {
    const host = new URL(String(url)).hostname
    if (host === 'dapi.mlbinfra.com') return new Response('{}', { status: 500 })
    return ok ? new Response(JSON.stringify({ notes: [] }), { status: 200 }) : new Response('', { status: 503 })
  }
  try {
    assert.equal(await resolveGameNotes(9992, '2026-01-05'), null)
    await assert.rejects(fetchArchiveShard(9992), /HTTP 503/)
    ok = true
    assert.deepEqual((await fetchArchiveShard(9992)).notes, [])
  } finally {
    globalThis.fetch = realFetch
  }
})

// The team hub's "Notes archive" link is the archive's only door. It sits beside
// the newest-note button but must not wait on that button's lookup.
test('the Notes archive link renders whether or not the newest-note lookup found a PDF', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/screens/team/TeamHubShell.jsx', import.meta.url)), 'utf8')
  const fn = src.slice(src.indexOf('function GameNotesLink'), src.indexOf('// The chrome every team-hub tab'))
  assert.doesNotMatch(fn, /if \(!notes\?\.url\) return null/)
  assert.match(fn, /gameNotesPath\(teamId\)/)
  // A native title= tip never shows on a phone (house rule).
  const archiveLink = fn.slice(fn.indexOf('gameNotesPath(teamId)'))
  assert.doesNotMatch(archiveLink.slice(0, archiveLink.indexOf('</a>')), /title=/)
})
