import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pdfPath, downloadMissing } from '../scripts/lib/game-notes-download.mjs'

// The half of scripts/download-game-notes.mjs that can be tested (#1258): where a
// PDF lands, and the skip-what-you-have loop. The fetch is injected, so this
// suite stays offline.

const row = (teamId, date, id) => ({
  teamId,
  date,
  title: `Game Notes ${id}`,
  url: `https://img.mlbstatic.com/mlb-images/image/upload/mlb/${id}.pdf`,
})

const PDF = new TextEncoder().encode('%PDF-1.7 fake body')
const okFetch = (log) => async (url) => {
  log.push(url)
  return new Response(PDF, { status: 200, headers: { 'content-type': 'application/pdf' } })
}

async function scratchDir() {
  return mkdtemp(join(tmpdir(), 'game-notes-'))
}

test('pdfPath is {teamId}/{date}_{publicId}.pdf, from the URL id so a doubleheader never collides', () => {
  assert.equal(pdfPath(row(158, '2026-09-27', 'abc123')), '158/2026-09-27_abc123.pdf')
  assert.notEqual(
    pdfPath(row(158, '2026-09-27', 'game1')),
    pdfPath(row(158, '2026-09-27', 'game2')),
  )
})

test('pdfPath is safe to join onto a folder whatever the URL holds', () => {
  const p = pdfPath({ teamId: 1, date: '2026-01-01', url: 'https://x/a/../../evil%2F.pdf?q=1#h' })
  assert.ok(!p.includes('..'), p)
  assert.match(p, /^1\/2026-01-01_[A-Za-z0-9_-]+\.pdf$/)
})

test('downloadMissing saves every row on a first run', async () => {
  const dir = await scratchDir()
  const log = []
  const rows = [row(158, '2026-09-27', 'a'), row(138, '2026-09-27', 'b')]
  const out = await downloadMissing({ rows, dir, fetchFn: okFetch(log), concurrency: 2 })
  assert.deepEqual([out.saved, out.skipped, out.failed.length], [2, 0, 0])
  assert.equal(log.length, 2)
  assert.equal((await readFile(join(dir, pdfPath(rows[0])))).toString(), '%PDF-1.7 fake body')
  await rm(dir, { recursive: true })
})

test('a second run downloads nothing new', async () => {
  const dir = await scratchDir()
  const rows = [row(158, '2026-09-27', 'a'), row(158, '2026-09-26', 'b')]
  await downloadMissing({ rows, dir, fetchFn: okFetch([]), concurrency: 2 })
  const log = []
  const again = await downloadMissing({ rows, dir, fetchFn: okFetch(log), concurrency: 2 })
  assert.deepEqual([again.saved, again.skipped], [0, 2])
  assert.equal(log.length, 0, 'the second run must not touch the network')
  await rm(dir, { recursive: true })
})

test('a new row on a later run is the only thing fetched', async () => {
  const dir = await scratchDir()
  const first = [row(158, '2026-09-26', 'a')]
  await downloadMissing({ rows: first, dir, fetchFn: okFetch([]), concurrency: 1 })
  const log = []
  const later = [...first, row(158, '2026-09-27', 'b')]
  const out = await downloadMissing({ rows: later, dir, fetchFn: okFetch(log), concurrency: 1 })
  assert.deepEqual([out.saved, out.skipped], [1, 1])
  assert.deepEqual(log, [later[1].url])
  await rm(dir, { recursive: true })
})

test('a failed download leaves no file, is reported, and is retried on the next run', async () => {
  const dir = await scratchDir()
  const rows = [row(158, '2026-09-27', 'a')]
  const bad = async () => new Response('nope', { status: 503 })
  const out = await downloadMissing({ rows, dir, fetchFn: bad, concurrency: 1 })
  assert.equal(out.saved, 0)
  assert.equal(out.failed.length, 1)
  assert.match(out.failed[0].reason, /503/)
  const files = await readdir(join(dir, '158')).catch(() => [])
  assert.deepEqual(files, [], 'no half-written file may be left behind')
  const retry = await downloadMissing({ rows, dir, fetchFn: okFetch([]), concurrency: 1 })
  assert.equal(retry.saved, 1)
  await rm(dir, { recursive: true })
})

test('a body that is not a PDF is refused, not saved as one', async () => {
  const dir = await scratchDir()
  const rows = [row(158, '2026-09-27', 'a')]
  const html = async () => new Response('<html>blocked</html>', { status: 200 })
  const out = await downloadMissing({ rows, dir, fetchFn: html, concurrency: 1 })
  assert.equal(out.saved, 0)
  assert.equal(out.failed.length, 1)
  assert.match(out.failed[0].reason, /not a PDF/i)
  await rm(dir, { recursive: true })
})

test('a leftover .part file from a killed run does not count as a saved PDF', async () => {
  const dir = await scratchDir()
  const rows = [row(158, '2026-09-27', 'a')]
  await mkdir(join(dir, '158'), { recursive: true })
  await writeFile(join(dir, pdfPath(rows[0]) + '.part'), 'half')
  const log = []
  const out = await downloadMissing({ rows, dir, fetchFn: okFetch(log), concurrency: 1 })
  assert.equal(out.saved, 1)
  assert.equal(log.length, 1)
  await rm(dir, { recursive: true })
})

test('downloadMissing never runs more fetches at once than the concurrency it was given', async () => {
  const dir = await scratchDir()
  const rows = Array.from({ length: 12 }, (_, i) => row(158, '2026-09-27', `id${i}`))
  let live = 0
  let peak = 0
  const slow = async () => {
    live += 1
    peak = Math.max(peak, live)
    await new Promise((r) => setTimeout(r, 5))
    live -= 1
    return new Response(PDF, { status: 200 })
  }
  await downloadMissing({ rows, dir, fetchFn: slow, concurrency: 3 })
  assert.ok(peak <= 3, `peak ${peak}`)
  assert.ok(peak >= 2, `expected some overlap, peak ${peak}`)
  await rm(dir, { recursive: true })
})

// Two ids that differ only in punctuation flatten to one file name. The second PDF
// cannot be saved without overwriting the first, and it must not vanish: it is
// counted, so the buckets add up to the rows announced.
test('a row whose file name clashes with another PDF is reported, not silently dropped', async () => {
  const dir = await scratchDir()
  const rows = [row(158, '2026-09-27', 'a.b'), row(158, '2026-09-27', 'a_b')]
  assert.equal(pdfPath(rows[0]), pdfPath(rows[1]))
  const out = await downloadMissing({ rows, dir, fetchFn: okFetch([]), concurrency: 1 })
  assert.equal(out.saved, 1)
  assert.equal(out.collided.length, 1)
  assert.equal(out.collided[0].row.url, rows[1].url)
  assert.equal(out.collided[0].sameAs.url, rows[0].url)
  assert.equal(out.saved + out.skipped + out.failed.length + out.repeats + out.collided.length, rows.length)
  await rm(dir, { recursive: true })
})

test('the same PDF listed twice is one download and one counted repeat', async () => {
  const dir = await scratchDir()
  const log = []
  const r = row(158, '2026-09-27', 'a')
  const out = await downloadMissing({ rows: [r, { ...r }], dir, fetchFn: okFetch(log), concurrency: 1 })
  assert.deepEqual([out.saved, out.repeats, out.collided.length], [1, 1, 0])
  assert.equal(log.length, 1)
  await rm(dir, { recursive: true })
})
