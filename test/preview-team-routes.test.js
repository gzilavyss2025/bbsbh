// The old team tab addresses (/team/{id}/roster|games|numbers|contracts|minors) are
// redirects to the one-scroll team page (ADR-0082, #1107). The link-preview function
// must send a crawler to the SAME card as the bare /team/{id}, not to a route name
// for a tab that no longer exists.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { SITE_URL } from '../src/copy/landing/site.js'
import { canonicalUrl } from '../api/preview.js'
import { buildCard, TEAM_TABS } from '../api/_lib/cards.js'
import { teamCrawl } from '../api/_lib/crawl.js'

const OLD_TABS = ['roster', 'games', 'numbers', 'contracts', 'minors']
const { rewrites } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))

// First matching rewrite wins, as on Vercel. `:id` is one segment; `:tab(a|b)` is a group.
function resolve(path) {
  for (const { source, destination } of rewrites) {
    const re = new RegExp(`^${source.replace(/:\w+\(([^)]*)\)/g, '($1)').replace(/:\w+/g, '([^/]+)')}$`)
    if (re.test(path)) return destination
  }
  return null
}

test('each old team tab address is rewritten to the bare team card', () => {
  for (const tab of OLD_TABS) {
    assert.equal(resolve(`/team/158/${tab}`), '/api/preview?route=team&id=:id', tab)
  }
})

test('no preview rewrite names an old tab route', () => {
  const stale = rewrites.filter((r) => /route=team-(roster|games|numbers|contracts|minors)\b/.test(r.destination))
  assert.deepEqual(stale, [])
})

test('the card builder and the team tab table carry no old tab names', async () => {
  assert.deepEqual(Object.keys(TEAM_TABS), ['leaders'])
  for (const tab of OLD_TABS) {
    assert.equal(await buildCard(new URLSearchParams({ route: `team-${tab}`, id: '158' }), 'https://x.test'), null, tab)
  }
})

test('a team page canonicalises to /team/{slug}, whatever the arriving address and ?d=/?s=', () => {
  const card = { segment: 'milwaukee-brewers-158' }
  // vercel.json hands the function only route + id, but a stray cutoff hint must not reach the tag.
  const params = new URLSearchParams({ route: 'team', id: '158', d: '2026-10-01', s: '1' })
  assert.equal(canonicalUrl(params, card), `${SITE_URL}/team/milwaukee-brewers-158`)
})

test('the club body links no old tab address', () => {
  const t = { id: 158, name: 'Milwaukee Brewers' }
  const { links } = teamCrawl(t, { id: 158, name: t.name, level: 'MLB', league: '', tab: '' })
  const hrefs = links.items.map((i) => i.href)
  for (const tab of OLD_TABS) assert.ok(!hrefs.some((h) => h.endsWith(`/${tab}`)), `${tab} door is gone`)
  assert.ok(hrefs.includes('/team/milwaukee-brewers-158/leaders'))
})
