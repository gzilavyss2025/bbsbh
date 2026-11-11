// The route table (src/lib/route/table.js): one entry per page, read by the
// parser, the builders, App.jsx's screen map and the menu. These tests are what
// keep those four readers agreeing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ROUTE_TABLE, NAME_BY_PATH, pathOf } from '../src/lib/route/table.js'
import { parseRoute, LEAGUE_SLUG } from '../src/lib/route.js'
import { PAGE_GROUPS } from '../src/lib/reportPages.js'

test('every table address parses back to its own route name', () => {
  for (const r of ROUTE_TABLE) {
    for (const p of [r.path, ...(r.aliases ?? [])]) {
      assert.equal(parseRoute(p).name, r.name, p)
    }
    assert.equal(parseRoute(pathOf(r.name)).name, r.name)
  }
})

test('a static page parses to its name alone; a season view keeps its year', () => {
  for (const r of ROUTE_TABLE.filter((x) => !x.season)) {
    assert.deepEqual(parseRoute(r.path), { name: r.name }, r.path)
  }
  for (const r of ROUTE_TABLE.filter((x) => x.season)) {
    assert.deepEqual(parseRoute(`${r.path}/2024`), { name: r.name, seasonYear: 2024 }, r.path)
  }
})

test('names and addresses are unique', () => {
  const names = ROUTE_TABLE.map((r) => r.name)
  assert.equal(new Set(names).size, names.length)
  const paths = ROUTE_TABLE.flatMap((r) => [r.path, ...(r.aliases ?? [])])
  assert.equal(new Set(paths).size, paths.length)
})

// The table is looked up before parseRoute's hand branches, so no table
// address may be something those branches own: the dated slate ('/07172026')
// or a league slate ('/aaa').
test('no table address collides with a dated or league slate', () => {
  const leagues = new Set(Object.values(LEAGUE_SLUG))
  for (const p of NAME_BY_PATH.keys()) {
    const head = p.split('/')[1]
    assert.ok(!/^\d{8}$/.test(head), `${p} looks like a slate date`)
    assert.ok(!leagues.has(head), `${p} is a league slate`)
  }
})

test('pathOf refuses a name the table does not have', () => {
  assert.throws(() => pathOf('no-such-page'), /No route named/)
})

// App.jsx can't be imported in plain node (JSX), so read its screen map's keys
// from the source. Every table route needs a screen, and every screen in that
// map needs a table route.
test("App.jsx's BARE_ROUTES screen map matches the table exactly", () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const block = src.match(/const BARE_ROUTES = \{\n([\s\S]*?)\n\}/)
  assert.ok(block, 'BARE_ROUTES not found in App.jsx')
  const keys = [...block[1].matchAll(/^ {2}'?([a-z-]+)'?:/gm)].map((m) => m[1])
  assert.deepEqual([...keys].sort(), ROUTE_TABLE.map((r) => r.name).sort())
})

test('every in-app menu row parses to a real page, not the slate fallback', () => {
  for (const group of PAGE_GROUPS) {
    for (const page of group.pages) {
      if (page.path.startsWith('/learn')) continue
      const route = parseRoute(page.path)
      assert.ok(route.name !== 'home' || page.path === '/', `${page.label}: ${page.path} falls through to the slate`)
    }
  }
})
