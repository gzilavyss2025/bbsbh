// Checks on the REAL generator state (the SQLite dumps), not on fixtures. That state
// lives in the private bbsbh-state repo (#2886), so these run apart from `npm test`:
// `npm run state:pull`, then `npm run test:state`. CI and the nightly run both.
// Each test moved here unchanged from the file named above it.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { openDb } from '../scripts/lib/db.js'
import { exportFouls } from '../scripts/gen-fouls.mjs'
import { exportGameFouls } from '../scripts/lib/fouls/byCount.mjs'
import { exportPitchArsenal } from '../scripts/gen-pitch-arsenal.mjs'

// From test/abs-scope.test.js.
// THE BACKFILL, PINNED ON THE COMMITTED DUMP. The 23 games below are every
// postseason game the schedule listed (gameType F, D, L, W, by gamePk) that was
// on file when the scope arrived. 2026's regular season ended on September 27
// (MLB) and September 20 (Triple-A), so no later game may still read 'R'.
test('the committed dump: every 2026 postseason game is P, and no October game is left in R', async () => {
  const db = await openDb()
  const scopeOf = new Map(db.prepare('SELECT game_pk, scope FROM abs_ingested_games').all().map((g) => [g.game_pk, g.scope]))
  const post = [
    849823, 849825, 849828, 849829, 849830, 849834, 849835, 849839, 849841, 849842, 849843, 849844,
    849845, 849846, 849848, 849849, 849851, 850987, 850988, 850989, 850991, 850992, 850993,
  ]
  for (const pk of post) assert.equal(scopeOf.get(pk), 'P', `${pk}`)
  const late = db
    .prepare("SELECT game_pk FROM abs_ingested_games WHERE season = 2026 AND scope = 'R' AND date > CASE level WHEN 'MLB' THEN '2026-09-27' ELSE '2026-09-20' END")
    .all()
  assert.deepEqual(late, [])
})

// From test/fouls.test.js.
test('the committed dump loads and exports the by-count cells and the per-game rows (after the 2026 re-read)', async () => {
  const db = await openDb()
  const out = exportFouls(db, 2026)
  assert.ok(Object.keys(out.batters).length > 100)
  assert.equal(Object.values(out.batters).some((b) => 'byCount' in b), true)
  assert.notEqual(out.league.byCount, null)
  assert.ok(Object.keys(exportGameFouls(db, 2026)).length > 100)
  // Turang 668930: 573 regular-season fouls, and his cells cover all 677 PA.
  assert.equal(out.batters['668930'].fouls, 574)
  assert.equal(out.batters['668930'].byCount.reach[0], 677)
})

// From test/team-records.test.js.
test('the committed ledger carries no tie that was never played', () => {
  const sql = readFileSync('scripts/data/team-records.sql', 'utf8')
  const phantoms = sql
    .split('\n')
    .filter((line) => line.startsWith('INSERT INTO team_record_games') && line.includes(", 'T', ") && line.includes('"innings":[]'))
  assert.deepEqual(phantoms.slice(0, 3), [], `${phantoms.length} rows are a 0-0 tie with no innings: a cancelled or postponed game`)
})

// From test/pitch-arsenal.test.js.
test('the committed dump loads, and after the 2026 re-walk its rows carry physics', async () => {
  const db = await openDb()
  const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
  assert.ok(count('pitch_arsenal_totals') > 0, 'the dump has rows')
  assert.ok(count('pitch_arsenal_physics') > 0, 'the re-walk filled the physics table')
  const out = exportPitchArsenal(db, {}, 2026)
  const typed = Object.values(out.pit).flatMap((e) => e.mlb.filter((t) => t.phys))
  assert.ok(typed.length > 0, 'some tracked type carries phys')
  assert.ok(typed.every((t) => t.phys.some((v) => v !== 0)), 'unknown, never zero: no phys is all zeros')
  const ff = out.pit[688107].mlb.find((t) => t.code === 'FF')
  assert.equal(ff.phys.length, 7, 'Gasser FF: seven physics means')
  assert.ok(ff.phys.every((v) => v !== null), 'Gasser FF: none null')
})

// From test/season-store.test.js.
test('every season group\'s committed dumps survive an openDb round trip byte for byte', async () => {
  // The 18 MB pitch-arsenal dump included: a re-dump of the rows on file must
  // give back the same live file and the same frozen files, or a nightly run
  // would rewrite a season it did not touch.
  const { GROUPS, openDb, dumpGroup } = await import('../scripts/lib/db.js')
  const { mkdtempSync, readdirSync: ls, readFileSync: rd } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const db = await openDb()
  const dir = mkdtempSync(join(tmpdir(), 'redump-'))
  const committed = new URL('../scripts/data/', import.meta.url)
  for (const [name, group] of Object.entries(GROUPS)) {
    if (!group.bySeason) continue
    await dumpGroup(db, name, dir)
  }
  for (const f of ls(dir)) assert.ok(rd(join(dir, f), 'utf8') === rd(new URL(f, committed), 'utf8'), `${f} changed`)
})
