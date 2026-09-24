// The fixture-freshness guard runs in `npm run lint`, which gates every PR. A
// fixture of a FINISHED game day cannot go stale, so the guard must not fail on
// one just because the calendar moved. Before #1194, the two anchor-day
// fixtures (captured 2026-08-18) turned lint red on 2027-02-15 with no code
// change. The guard still fails a fixture of data that moves.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const SCRIPT = path.join(fileURLToPath(new URL('.', import.meta.url)), '../scripts/check-fixture-freshness.mjs')

function runGuard(env) {
  const base = { ...process.env }
  delete base.FIXTURE_FRESHNESS_DIR
  delete base.FIXTURE_FRESHNESS_NOW
  return spawnSync(process.execPath, [SCRIPT], { env: { ...base, ...env }, encoding: 'utf8' })
}

test('the committed manifest still passes past its 180-day budget', () => {
  // 2027-03-01 is past the 180-day budget of the 2026-08-18 captures.
  const res = runGuard({ FIXTURE_FRESHNESS_NOW: '2027-03-01' })
  assert.equal(res.status, 0, res.stderr)
})

test('a fixture of moving data still fails once it is over 180 days old', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fixture-freshness-'))
  try {
    mkdirSync(path.join(dir, 'api'))
    writeFileSync(path.join(dir, 'api', 'roster.json'), '{}')
    writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ 'api/roster.json': { capturedAt: '2026-08-18', note: 'a roster: moving data' } }),
    )
    const res = runGuard({ FIXTURE_FRESHNESS_DIR: dir, FIXTURE_FRESHNESS_NOW: '2027-03-06' })
    assert.equal(res.status, 1)
    assert.match(res.stderr, /api\/roster\.json — captured 200 days ago/)

    // The same fixture on day 180 is inside the budget, so the guard reads the
    // injected date and not the real one.
    const fresh = runGuard({ FIXTURE_FRESHNESS_DIR: dir, FIXTURE_FRESHNESS_NOW: '2027-02-14' })
    assert.equal(fresh.status, 0, fresh.stderr)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
