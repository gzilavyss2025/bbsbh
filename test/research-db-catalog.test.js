import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PANEL_PATHS,
  SKIPPED,
  buildAllViews,
  globToRegExp,
  isRegistered,
  isSkipped,
} from '../scripts/research-db.mjs'

// scripts/research-db.mjs is the front door of the research work (#1117): a
// spike queries what already exists before it pulls anything from statsapi. The
// door only works if three things stay true, and these tests pin them.
//   1. The registered list points at files that exist.
//   2. The catalog in docs/agents/research-database.md names every view and
//      every skipped file, so the first move on a new question is to read it.
//   3. A rebuild leaves no stale view behind from an older list.
// They do NOT fail when a new JSON file appears under .scratch/ or public/data/.
// The nightly crons write there. `node scripts/research-db.mjs --uncovered`
// lists new files for a person to triage.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOC = readFileSync(join(ROOT, 'docs/agents/research-database.md'), 'utf8')

function filesMatching(glob) {
  const dir = join(ROOT, dirname(glob))
  if (!existsSync(dir)) return []
  const re = globToRegExp(glob)
  return readdirSync(dir).filter((f) => re.test(`${dirname(glob)}/${f}`))
}

test('every registered path exists, and every glob matches at least one file', () => {
  for (const p of PANEL_PATHS) {
    if (p.includes('*')) {
      assert.ok(filesMatching(p).length > 0, `${p}: the glob matches no file`)
    } else {
      assert.ok(existsSync(join(ROOT, p)), `${p}: registered but missing`)
    }
  }
})

test('no path is listed twice, and none is both registered and skipped', () => {
  assert.equal(new Set(PANEL_PATHS).size, PANEL_PATHS.length, 'a panel path is listed twice')
  for (const p of PANEL_PATHS) {
    if (p.includes('*')) {
      for (const f of filesMatching(p)) {
        assert.ok(!isSkipped(`${dirname(p)}/${f}`), `${dirname(p)}/${f} is registered and skipped`)
      }
    } else {
      assert.ok(!isSkipped(p), `${p} is registered and skipped`)
    }
  }
})

test('every skipped entry still points at something', () => {
  for (const [p, why] of SKIPPED) {
    assert.ok(why.length > 10, `${p}: a skip needs a reason`)
    const target = join(ROOT, p)
    assert.ok(existsSync(target), `${p}: skipped but gone. Remove the entry`)
  }
})

test('the matchers read a literal, a glob and a directory prefix', () => {
  const panels = ['a/one.json', 'b/*.json']
  const skipped = [['c/', 'a directory of probes'], ['d/x.json', 'a single file']]
  assert.equal(isRegistered('a/one.json', panels), true)
  assert.equal(isRegistered('b/2024.json', panels), true)
  assert.equal(isRegistered('b/deep/2024.json', panels), false, '* stops at a slash')
  assert.equal(isRegistered('a/two.json', panels), false)
  assert.equal(isSkipped('c/deep/probe.json', skipped), true)
  assert.equal(isSkipped('d/x.json', skipped), true)
  assert.equal(isSkipped('d/y.json', skipped), false)
  assert.equal(globToRegExp('x/a.b*.json').test('x/a.b1.json'), true)
  assert.equal(globToRegExp('x/a.b*.json').test('x/aXb1.json'), false, 'a dot is literal')
})

test('the catalog names every registered source and every skipped path', () => {
  for (const p of PANEL_PATHS) {
    assert.ok(DOC.includes(`\`${p}\``), `${p}: not in the catalog (docs/agents/research-database.md)`)
  }
  for (const [p] of SKIPPED) {
    assert.ok(DOC.includes(`\`${p}\``), `${p}: not in the Skipped list of the catalog`)
  }
})

test('the catalog states the rule where a spike reads it', () => {
  assert.match(DOC, /before a spike pulls anything from statsapi/i)
  for (const file of [
    'docs/agents/research-diary.md',
    'docs/agents/contender-diary.md',
    'docs/team-success-research.md',
  ]) {
    const text = readFileSync(join(ROOT, file), 'utf8')
    assert.ok(text.includes('research-database.md'), `${file} does not point at the catalog`)
    assert.match(text, /Before a spike[^.]*(pulls|re-pulls)/i, `${file} does not state the rule`)
  }
})

// The three tests below share ONE real in-memory DuckDB, built once, and read
// the JSON on disk. A full build of every view takes over a minute and they
// used to make three of them, with the instances left open. Run beside the rest
// of the suite on a machine short of memory that ran DuckDB out of it
// ("Out of Memory Error: Allocation failure"): the terms view then failed to
// build, buildAllViews logged it and moved on, and the catalog test blamed the
// catalog. One build, closed when the file is done, is a third of the memory.
// The stale view is planted BEFORE that build, so the first test still proves a
// rebuild drops what an older list left behind.
let shared
function sharedBuild() {
  shared ??= (async () => {
    const { DuckDBInstance } = await import('@duckdb/node-api')
    const instance = await DuckDBInstance.create(':memory:')
    const conn = await instance.connect()
    await conn.run('CREATE VIEW stale_from_an_older_list AS SELECT 1 AS x')
    const built = await buildAllViews(conn)
    return { instance, conn, built }
  })()
  return shared
}
after(async () => {
  if (!shared) return
  const { instance, conn } = await shared
  conn.closeSync()
  instance.closeSync()
})

test('a rebuild drops a view that an older list left behind', async () => {
  const { conn } = await sharedBuild()
  const left = (
    await conn.runAndReadAll("SELECT view_name FROM duckdb_views() WHERE view_name = 'stale_from_an_older_list'")
  ).getRowObjectsJson()
  assert.equal(left.length, 0)
})

test('the catalog rows and the built views are the same set, and each view has a row', async () => {
  const { conn, built } = await sharedBuild()
  const names = built.map(([v]) => v)
  const documented = [...DOC.matchAll(/^\| `([a-z0-9_]+)` \|/gm)].map((m) => m[1])

  const undocumented = names.filter((v) => !documented.includes(v))
  const invented = documented.filter((v) => !names.includes(v))
  assert.deepEqual(undocumented, [], 'views built but missing from the catalog')
  assert.deepEqual(invented, [], 'catalog rows that name no built view')
  assert.equal(new Set(documented).size, documented.length, 'a view is in the catalog twice')

  const empty = []
  for (const v of names) {
    const rows = (await conn.runAndReadAll(`SELECT 1 FROM "${v}" LIMIT 1`)).getRowObjectsJson()
    if (rows.length === 0) empty.push(v)
  }
  assert.deepEqual(empty, [], 'views that return no rows')
})

test('a full scan of the contract terms view reads every row', async () => {
  // Some shards hold a number in a money field and "forfeited" in another row.
  // DuckDB's default sampling threw on the first text value.
  const { conn } = await sharedBuild()
  const [{ n }] = (await conn.runAndReadAll('SELECT count(*) AS n FROM public_contracts_history_terms')).getRowObjectsJson()
  assert.ok(Number(n) > 36000, `expected the full terms table, got ${n}`)
  const [{ s }] = (
    await conn.runAndReadAll('SELECT count(terms.salary) AS s FROM public_contracts_history_terms')
  ).getRowObjectsJson()
  assert.ok(Number(s) > 0)
})
