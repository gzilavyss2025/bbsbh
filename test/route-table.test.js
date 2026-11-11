// The route table (src/lib/route/table.js): one entry per page, read by the
// parser, the builders, App.jsx's screen map and the menu. These tests are what
// keep those four readers agreeing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ROUTE_TABLE, NAME_BY_PATH, pathOf } from '../src/lib/route/table.js'
import { PATTERN_ROUTES, buildPath } from '../src/lib/route/patterns.js'
import { parseRoute, parseRouteByHand, LEAGUE_SLUG, bookPath, bookStatsPath } from '../src/lib/route.js'
import { canonicalUrl } from '../api/preview.js'
import { SITE_URL } from '../src/copy/landing/site.js'
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

// The table is looked up first, so a hand branch that also matched a table
// address would be shadowed silently. With the table out of the way, every
// static table address must fall through to the slate.
test('no hand-written branch also claims a table address', () => {
  for (const p of NAME_BY_PATH.keys()) {
    assert.deepEqual(parseRouteByHand(p), { name: 'home' }, `${p} is also parsed by hand`)
  }
})

test("a link preview's canonical URL for a table page is the table's address", () => {
  for (const r of ROUTE_TABLE) {
    const url = canonicalUrl(new URLSearchParams({ route: r.name }))
    assert.equal(url, `${SITE_URL}${r.path}`, r.name)
  }
  // The two card keys older than the table's names for the same pages.
  assert.equal(canonicalUrl(new URLSearchParams({ route: 'umpires' })), `${SITE_URL}${pathOf('umpire-rankings')}`)
  assert.equal(canonicalUrl(new URLSearchParams({ route: 'awards' })), `${SITE_URL}${pathOf('awards-history')}`)
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
      // The slate fallback and the generic three-segment game route are what an
      // unknown address lands on; a menu row must name a page, not either.
      const { name } = parseRoute(page.path)
      assert.ok(name !== 'home' && name !== 'game', `${page.label}: ${page.path} parses as '${name}'`)
    }
  }
})

// Part two (#3034): the pattern entries. One sample route per entry, in the
// shape its parse returns; `slugName` rides on some to exercise the slug.
const PATTERN_SAMPLES = {
  player: [
    { id: '545361', asOf: null, sportId: null },
    { id: '545361', asOf: '2025-06-01', sportId: 11, tab: 'stats', slugName: 'Mike Trout' },
  ],
  team: [
    { id: '158', asOf: null, sportId: null },
    { id: '4124', asOf: '2018-12-31', sportId: 12, tab: 'roster', slugName: 'Pensacola Blue Wahoos' },
  ],
  'team-stamp-in': [{ id: '158', asOf: null, sportId: null }],
  'team-transactions': [{ id: '158', asOf: '2025-06-01', sportId: null }],
  'team-franchise': [{ id: '158', asOf: null, sportId: null }],
  'team-leaders': [{ id: '158', asOf: null, sportId: 1 }],
  'team-photos': [
    { id: '158', asOf: null, sportId: null },
    { id: '158', asOf: null, sportId: null, allGames: true },
  ],
  manager: [{ id: '121767', slugName: 'Pat Murphy' }],
  leaders: [
    { scope: 'mlb', asOf: null, sportId: null },
    { scope: 'aaa', asOf: '2025-06-01', sportId: null },
    { scope: 'org', orgId: 158, asOf: null, sportId: null },
  ],
  outliers: [{ asOf: '2025-06-01' }],
  'postseason-series': [{ seriesId: '2025-division-112-158', asOf: null }],
  'free-agents': [{ season: null }, { season: 2025 }],
  'trade-deadline-season': [{ season: 2022 }],
  'game-notes': [{ teamId: null }, { teamId: 'all' }, { teamId: 158 }],
  photos: [{}, { gamePk: 776543 }],
  'logbook-stats': [{}, { bookId: 'b1' }],
  logbook: [
    { season: null, placing: null },
    { season: 2024, placing: 776543 },
    { creating: true, season: null, placing: null },
    { bookId: 'b1', season: null, placing: null },
    { bookId: 'b1', season: 2023, placing: null },
  ],
}

test('every pattern entry has samples, and parse(build(x)) deep-equals x', () => {
  assert.deepEqual(Object.keys(PATTERN_SAMPLES).sort(), PATTERN_ROUTES.map((r) => r.name).sort())
  for (const entry of PATTERN_ROUTES) {
    for (const { slugName, ...params } of PATTERN_SAMPLES[entry.name]) {
      const route = { name: entry.name, ...params }
      const url = buildPath(entry.name, { ...params, slugName })
      assert.deepEqual(parseRoute(url), route, url)
    }
  }
})

// The pattern entries are tried BEFORE the hand branches, so a pattern head the
// hand parsers also own ('umpire' for the season views, 'scout', 'from',
// '/learn/x?edit', a records page) would steal their addresses silently. With
// the patterns out of the way, every shape under a pattern head must fall to
// the slate or the generic game route, i.e. no hand branch knows that head.
test('no hand-written branch owns a pattern head', () => {
  for (const { head } of PATTERN_ROUTES) {
    for (const tail of ['', '/x-1', '/x-1/2024', '/x-1/2024/y', '/x-1?edit']) {
      const url = `/${head}${tail}`
      const { name } = parseRouteByHand(url)
      assert.ok(name === 'home' || name === 'game', `${url} is parsed by hand, as '${name}'`)
    }
  }
})

test('no pattern head is a table address, a slate date or a league slate', () => {
  const leagues = new Set(Object.values(LEAGUE_SLUG))
  for (const { head } of PATTERN_ROUTES) {
    assert.ok(!NAME_BY_PATH.has(`/${head}`), head)
    assert.ok(!/^\d{8}$/.test(head) && !leagues.has(head), head)
  }
})

// A parsed route fed back into its build gives the same clean address: a Logbook
// with no stamp in hand carries `placing: null`, which must not become '?place=0'.
test('build(parse(url)) gives back the canonical url', () => {
  for (const url of ['/logbook', '/logbook/2024', '/logbook/book/b1', '/leaders', '/player/545361', '/team/milwaukee-brewers-158/roster']) {
    const { name, ...params } = parseRoute(url)
    assert.equal(buildPath(name, params), url)
  }
})

// A book whose id has not loaded must not quietly open the DEFAULT book's
// addresses: '/logbook/2024' is a different book, '/logbook/stats' the whole shelf.
test('a book builder with no id never builds a default-book address', () => {
  assert.notEqual(parseRoute(bookPath(undefined, 2024)).bookId, undefined)
  assert.notEqual(parseRoute(bookStatsPath(undefined)).bookId, undefined)
})
