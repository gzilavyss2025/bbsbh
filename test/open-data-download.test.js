import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadTo } from '../scripts/lib/open-data/download.mjs'

// The hand-run download helper for the open datasets (ADR-0100). The fetch is
// injected, so this suite stays offline.

const BODY = new TextEncoder().encode('id,name\n1,a\n')
const okFetch = async () => new Response(BODY, { status: 200 })
const quiet = () => {}

const freshDir = async () => mkdtemp(join(tmpdir(), 'open-data-'))

test('saves the body under the last URL segment and reports the byte count', async () => {
  const dir = await freshDir()
  const lines = []
  const out = await downloadTo('https://example.org/downloads/biodata.zip', dir, {
    fetchFn: okFetch,
    log: (line) => lines.push(line),
  })
  assert.equal(out.bytes, BODY.length)
  assert.equal(out.path, join(dir, 'biodata.zip'))
  assert.deepEqual(await readdir(dir), ['biodata.zip'])
  assert.equal(await readFile(out.path, 'utf8'), 'id,name\n1,a\n')
  assert.match(lines.join('\n'), new RegExp(`${BODY.length} bytes`))
})

test('creates the folder when it does not exist yet', async () => {
  const dir = join(await freshDir(), 'nested', 'new')
  const out = await downloadTo('https://example.org/x.csv', dir, { fetchFn: okFetch, log: quiet })
  assert.equal(out.path, join(dir, 'x.csv'))
})

test('refuses a folder that already holds a file', async () => {
  const dir = await freshDir()
  await writeFile(join(dir, 'planted.py'), '')
  await assert.rejects(downloadTo('https://example.org/x.csv', dir, { fetchFn: okFetch, log: quiet }), /not empty/)
})

test('refuses a folder inside the repo', async () => {
  const inRepo = join(process.cwd(), 'public', 'data', 'never-here')
  await assert.rejects(downloadTo('https://example.org/x.csv', inRepo, { fetchFn: okFetch, log: quiet }), /inside the repo/)
  await assert.rejects(readdir(inRepo), { code: 'ENOENT' })
})

test('a bad status throws and leaves the folder empty', async () => {
  const dir = await freshDir()
  const notFound = async () => new Response('no', { status: 404 })
  await assert.rejects(downloadTo('https://example.org/x.csv', dir, { fetchFn: notFound, log: quiet }), /HTTP 404/)
  assert.deepEqual(await readdir(dir), [])
})

test('a URL with no file name is refused before any request', async () => {
  const dir = await freshDir()
  let called = false
  const spy = async () => ((called = true), okFetch())
  await assert.rejects(downloadTo('https://example.org/', dir, { fetchFn: spy, log: quiet }), /file name/)
  assert.equal(called, false)
})
