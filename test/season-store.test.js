// A season store keeps every season (ADR-0086). umpires/ and spray/ keep one
// folder per season beside a seasons.json that names the season the app
// serves. #1168's simulated January 1 found the old layout losing 2026: the
// umpire run swept every shard, and the spray run wrote 100 empty buckets.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { seasonsAfter, seasonToServe } from '../scripts/lib/io.js'

const STORES = ['umpires', 'spray', 'umpire-accuracy', 'fouls', 'abs', 'pitch-arsenal', 'pitch-command', 'pitch-arsenal-pool']
const storeUrl = (store) => new URL(`../public/data/${store}/`, import.meta.url)

test('a new season is added to the index, and the old one stays', () => {
  assert.deepEqual(seasonsAfter({ seasons: [], current: null }, 2026), { seasons: [2026], current: 2026 })
  assert.deepEqual(seasonsAfter({ seasons: [2026], current: 2026 }, 2027), {
    seasons: [2026, 2027],
    current: 2027,
  })
  // A backfill of an older season does not move `current` back.
  assert.deepEqual(seasonsAfter({ seasons: [2026, 2027], current: 2027 }, 2025), {
    seasons: [2025, 2026, 2027],
    current: 2027,
  })
  // A second night of the same season changes nothing.
  assert.deepEqual(seasonsAfter({ seasons: [2026], current: 2026 }, 2026), { seasons: [2026], current: 2026 })
})

test('the season served is the last one with a game, whatever the calendar says', () => {
  // January 1: the new year has no game yet, so last season stays.
  assert.equal(seasonToServe('2027-01-01', [2026]), 2026)
  // The day after the first 2027 game lands on file, 2027 takes over.
  assert.equal(seasonToServe('2027-03-26', [2026, 2027]), 2027)
  assert.equal(seasonToServe('2027-01-01', []), null)
})

for (const store of STORES) {
  test(`${store}/ keeps one folder per season, and seasons.json names them`, () => {
    const index = JSON.parse(readFileSync(new URL('seasons.json', storeUrl(store)), 'utf8'))
    assert.ok(index.seasons.length > 0, `${store}: no season on file`)
    assert.equal(index.current, Math.max(...index.seasons), `${store}: current is not the latest season`)
    for (const season of index.seasons) {
      const dir = new URL(`${season}/`, storeUrl(store))
      assert.ok(existsSync(dir), `${store}: ${season} is listed but has no folder`)
      assert.ok(readdirSync(dir).some((f) => f.endsWith('.json')), `${store}/${season}/ is empty`)
    }
    // No shard left at the top level: a reader never looks there.
    const loose = readdirSync(storeUrl(store)).filter((f) => f.endsWith('.json') && f !== 'seasons.json')
    assert.deepEqual(loose, [], `${store}: shards outside a season folder`)
  })
}

test('the spray card reads the season that seasons.json names', async (t) => {
  const fetched = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    fetched.push(url)
    const body = url === '/data/spray/seasons.json' ? { seasons: [2026, 2027], current: 2026 } : { season: 2026, bat: {} }
    return { ok: true, status: 200, json: async () => body }
  })
  const { fetchSprayFor } = await import('../src/api/spray.js?case=season')
  await fetchSprayFor(660271)
  assert.deepEqual(fetched, ['/data/spray/seasons.json', '/data/spray/2026/71.json'])
})

// --- per-season SQLite dumps (#1200) -------------------------------------------
// A season group's live dump holds the newest season. An older season goes to
// `<group>-<season>.sql` once, at the first dump that sees a newer season, and
// is never rewritten.
test('a season group dumps an older season once to its own frozen file', async () => {
  const { openDb, dumpGroup } = await import('../scripts/lib/db.js')
  const { mkdtempSync, readdirSync: ls, readFileSync: rd } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'dump-'))
  const rows = (db) => db.prepare('SELECT * FROM foul_team_totals ORDER BY season, team_id').all()

  const db = await openDb(dir)
  const add = db.prepare('INSERT INTO foul_team_totals (season, team_id, games, fouls, two_strike_fouls) VALUES (?, ?, ?, ?, ?)')
  add.run(2026, 158, 162, 4000, 1500)
  add.run(2027, 158, 1, 30, 10)
  await dumpGroup(db, 'fouls', dir)

  assert.deepEqual(ls(dir).sort(), ['fouls-2026.sql', 'fouls.sql'])
  assert.match(rd(join(dir, 'fouls-2026.sql'), 'utf8'), /VALUES \(158, 2026, 162, 4000, 1500\)/)
  assert.doesNotMatch(rd(join(dir, 'fouls-2026.sql'), 'utf8'), /2027/)
  assert.doesNotMatch(rd(join(dir, 'fouls.sql'), 'utf8'), /2026/)
  const reopened = await openDb(dir)
  assert.deepEqual(rows(reopened), rows(db))

  // A second dump, after more 2027 rows, leaves the frozen file as it was.
  const frozen = rd(join(dir, 'fouls-2026.sql'), 'utf8')
  reopened.prepare('UPDATE foul_team_totals SET games = 2 WHERE season = 2027').run()
  await dumpGroup(reopened, 'fouls', dir)
  assert.equal(rd(join(dir, 'fouls-2026.sql'), 'utf8'), frozen)

  // A change to a frozen season fails loudly, so it is never dropped in silence.
  reopened.prepare('UPDATE foul_team_totals SET games = 163 WHERE season = 2026').run()
  await assert.rejects(dumpGroup(reopened, 'fouls', dir), /frozen.*REFREEZE=1/)
  // A deliberate change (a backfill, a new column) re-freezes from the rows in
  // memory, so nothing has to be deleted to get there.
  process.env.REFREEZE = '1'
  try {
    await dumpGroup(reopened, 'fouls', dir)
  } finally {
    delete process.env.REFREEZE
  }
  assert.match(rd(join(dir, 'fouls-2026.sql'), 'utf8'), /VALUES \(158, 2026, 163, 4000, 1500\)/)
})

test('a frozen season never goes back into the live dump, even when the newest season empties', async () => {
  const { openDb, dumpGroup } = await import('../scripts/lib/db.js')
  const { mkdtempSync, readFileSync: rd } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'dump-'))
  const db = await openDb(dir)
  const add = db.prepare('INSERT INTO foul_team_totals (season, team_id, games, fouls, two_strike_fouls) VALUES (?, ?, ?, ?, ?)')
  add.run(2026, 158, 162, 4000, 1500)
  add.run(2027, 158, 1, 30, 10)
  await dumpGroup(db, 'fouls', dir)
  // The one 2027 game is evicted (--recheck) or its season rebuilt.
  db.prepare('DELETE FROM foul_team_totals WHERE season = 2027').run()
  await dumpGroup(db, 'fouls', dir)
  assert.equal(rd(join(dir, 'fouls.sql'), 'utf8'), '')
  const rows = (await openDb(dir)).prepare('SELECT season, games FROM foul_team_totals').all()
  assert.deepEqual(rows.map((r) => [r.season, r.games]), [[2026, 162]])
})

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
