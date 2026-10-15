import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Row 6g (#1107): no native title= tooltips (dead on touch) in the shared club strip and
// roster list, with the accessible name kept; and the two reads the one-scroll page made
// twice (affiliates.json, the club's coaches) fire once.

const urls = []
globalThis.fetch = async (url) => {
  const u = String(url)
  urls.push(u)
  const body = u.includes('/coaches')
    ? { roster: [{ jobId: 'MNGR', job: 'Manager', person: { id: 9, fullName: 'Pat Murphy' } }] }
    : { season: 2026, byOrgId: { 158: [{ id: 1 }] } }
  return { ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }
}

const { fetchStaticAffiliates } = await import('../src/api/team.js')
const { fetchAffiliateParentMap } = await import('../src/api/transactions/leagueFeed.js')
const { SHARED } = await import('../src/screens/team/next/once.js')

// The suite imports no .jsx (test/CLAUDE.md), so the two components are read as source.
const jsx = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8')

test('TeamFilterStrip: no title=, the MLB pin and every club keep a name', () => {
  const src = jsx('components/team/TeamFilterStrip.jsx')
  assert.ok(!/\stitle=/.test(src))
  assert.ok(src.includes('aria-label="MLB"'))
  assert.ok(src.includes('aria-label={t.name}'))
})

test('RosterList: no title=, the All Star star and the WAR pill keep a name', () => {
  const src = jsx('screens/team/modules/RosterList.jsx')
  assert.ok(!/\stitle=/.test(src))
  assert.ok(src.includes('role="img" aria-label={`${season} All Star`}'))
  assert.ok(src.includes('aria-label={`Season WAR (MLB calc)'))
})

test('the schedule strip and ballpark card carry no title=; the empty cell buttons keep a name', () => {
  const strip = jsx('screens/team/modules/SeasonSchedule.jsx')
  assert.ok(!/\stitle=/.test(strip))
  assert.equal(strip.match(/aria-label=\{`\$\{(it|g)\.apiDate\}/g).length, 2)
  const park = jsx('screens/team/modules/ballpark/BallparkCard.jsx')
  // The only title= left are RankGroup's two props (a heading, not a tooltip).
  assert.equal(park.match(/\stitle=/g).length, 2)
  assert.ok(jsx('screens/team/modules/ballpark/BallparkAdminBar.jsx').includes('aria-label="Edit this ballpark"'))
})

test('affiliates.json is fetched once for the Farm and Games readers', async () => {
  urls.length = 0
  const [a, , map] = await Promise.all([fetchStaticAffiliates(), fetchStaticAffiliates(), fetchAffiliateParentMap()])
  assert.equal(urls.filter((u) => u.endsWith('/data/affiliates.json')).length, 1)
  assert.equal(a.season, 2026)
  assert.equal(map.get(1), 158)
})

test('the club coaches read is bought once through SHARED', async () => {
  urls.length = 0
  const [x, y] = await Promise.all([SHARED.fetchManager(158, 2026), SHARED.fetchManager(158, 2026)])
  assert.equal(urls.filter((u) => u.includes('/coaches')).length, 1)
  assert.equal(x.name, 'Pat Murphy')
  assert.equal(y, x)
})
