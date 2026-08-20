// Unit coverage for firstNonNull (api/_lib/cards.js), the race helper behind
// resolveGame's fix for a reproduced bug: a shared game link could fall back
// to the static default preview card because resolveGame waited on
// Promise.allSettled across all 5 sport-level schedule calls even after the
// MLB answer was already in — one slow/hung MiLB-level response (more likely
// exactly when a game is live and statsapi is busier) gated an already-found
// match. Exercised here with plain fake-delay promises rather than mocked
// fetch/statsapi calls, since the race behavior itself is network-agnostic.
import { readFileSync } from 'node:fs'

import assert from 'node:assert/strict'
import test from 'node:test'
import { firstNonNull, buildCard, TEAM_TABS } from '../api/_lib/cards.js'
// The slug helpers moved to api/_lib/entity.js when the crawlable body gave them
// a second caller (ADR-0058). Still the edge-side copies this asserts against
// the app's own — the file changed, the claim did not.
import { slugify as edgeSlugify, idFromSlug as edgeIdFromSlug } from '../api/_lib/entity.js'
import { slugify, idFromSlug } from '../src/lib/route.js'
import { canonicalUrl, renderHead } from '../api/preview.js'
import { SITE_URL } from '../src/copy/landing/site.js'

const delay = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms))
const rejectAfter = (ms, err) => new Promise((_, reject) => setTimeout(() => reject(err), ms))

test('resolves as soon as the first match lands, without waiting on a slower miss', async () => {
  const start = Date.now()
  // Stands in for: sportId 1 (MLB) answers fast with the real match, sportId
  // 13 (A+) is the one that's slow this time and finds nothing.
  const result = await firstNonNull([delay(10, 'mlb-match'), delay(300, null)])
  const elapsed = Date.now() - start
  assert.equal(result, 'mlb-match')
  // The regression this guards against: the old Promise.allSettled shape
  // waited for every promise to settle, so this would have taken ~300ms.
  assert.ok(elapsed < 150, `expected to resolve well before the slow miss (300ms), took ${elapsed}ms`)
})

test('a match wins the race regardless of which position finds it', async () => {
  const result = await firstNonNull([delay(300, null), delay(10, 'mlb-match')])
  assert.equal(result, 'mlb-match')
})

test('falls through to null only once every level has settled', async () => {
  const start = Date.now()
  const result = await firstNonNull([delay(10, null), delay(120, null)])
  const elapsed = Date.now() - start
  assert.equal(result, null)
  // The intent: firstNonNull waits for the SLOW miss (120ms), never bailing at
  // the fast one (10ms). Assert well past 10ms rather than the exact 120ms — a
  // real setTimeout(120) can be measured a hair under 120ms by Date.now()
  // (timer/clock rounding), which flaked CI at 119ms. 100ms still proves it
  // didn't give up early while tolerating that sub-millisecond jitter.
  assert.ok(elapsed >= 100, `expected to wait for the slow miss (~120ms), took ${elapsed}ms`)
})

test('a rejected promise counts as a miss, not an unhandled rejection', async () => {
  const result = await firstNonNull([rejectAfter(10, new Error('statsapi 500')), delay(50, 'mlb-match')])
  assert.equal(result, 'mlb-match')
})

test('an empty list resolves to null immediately', async () => {
  assert.equal(await firstNonNull([]), null)
})

// Coverage gap fixed here: vercel.json's rewrite list (and this switch) had
// drifted behind REPORT_PAGES (src/lib/reportPages.js) and the team-hub's
// five tabs (ADR-0034, src/CLAUDE.md) — 12 report pages and 4 team tabs fell
// through to the static default card with no dynamic resolution attempted at
// all, confirmed live against production. These routes build with no
// statsapi call (genericCard is pure), so they're testable without mocking
// fetch, unlike playerCard/teamCard/gameCard above.
const STATIC_REPORT_ROUTES = [
  'leaders',
  'standings',
  'prospects',
  'rehab',
  'about',
  'logos',
  'fouls',
  'situational-records',
  'milestones',
  'umpires',
  'awards',
  'postseason-history',
  'postseason-leaders',
  'trade-deadline',
  'all-star-rosters',
  'all-star-legacy',
  'logbook',
  'first-scorebook',
  'photos',
  // The five broadcast reports (src/screens/around-the-game/).
  'attendance',
  'pace',
  'farm-system',
  'bullpens',
]

for (const route of STATIC_REPORT_ROUTES) {
  test(`buildCard resolves a dynamic card for route=${route}, not null`, async () => {
    const card = await buildCard(new URLSearchParams({ route }), 'https://example.test')
    assert.ok(card, `expected a card for route=${route}`)
    assert.ok(card.title.includes('Tally Baseball'), `title should be branded: ${card.title}`)
    assert.ok(card.image.startsWith('https://example.test/api/og?'), `image should be a same-origin /api/og URL: ${card.image}`)
  })
}

test('buildCard still falls back to null for an unrecognized route', async () => {
  const card = await buildCard(new URLSearchParams({ route: 'not-a-real-route' }), 'https://example.test')
  assert.equal(card, null)
})

// ------------------------------------------------- canonical origin (preview)
//
// The bug these pin: three hostnames served identical bytes — tallybb.com,
// www.tallybb.com and the bbsbh.vercel.app deployment name — and the pages
// advertised the deployment name while readers arrived on the apex. The whole
// site now names ONE origin, SITE_URL, and api/preview.js is the only surface
// able to emit a per-route canonical (the static shell is the SPA fallback for
// every unrewritten route and cannot know which page it is about to boot).

test('a route canonical is built on SITE_URL, never on the requested host', () => {
  const params = new URLSearchParams({ route: 'player', id: '668227' })
  assert.equal(canonicalUrl(params), `${SITE_URL}/player/668227`)
  // The old signature took the request origin and used it. Nothing about the
  // hostname a reader (or a preview deployment) arrived on may reach the tag.
  assert.doesNotMatch(canonicalUrl(params), /vercel\.app|www\./)
})

test('every rewritten route resolves to its own canonical path, not the home page', () => {
  const cases = [
    [{ route: 'team', id: '158' }, '/team/158'],
    [{ route: 'team-roster', id: '158' }, '/team/158/roster'],
    [{ route: 'leaders', scope: 'pitching' }, '/leaders/pitching'],
    [{ route: 'leaders-org', orgId: '158' }, '/leaders/org/158'],
    [{ route: 'standings' }, '/standings'],
    [{ route: 'game', date: '20260817', matchup: 'mil-chc', section: 'boxscore' }, '/20260817/mil-chc/boxscore'],
  ]
  for (const [params, path] of cases) {
    assert.equal(canonicalUrl(new URLSearchParams(params)), `${SITE_URL}${path}`)
  }
  // An unresolvable route falls back to the home page, which is the one case
  // where "/" is the honest answer.
  assert.equal(canonicalUrl(new URLSearchParams({ route: 'nope' })), `${SITE_URL}/`)
})

// The hand-written list above is what let six routes ship pointing at "/": a
// page added to vercel.json gets its card from cards.js and is never noticed to
// be missing a canonical, because nothing here knew to ask about it. So take the
// list from vercel.json itself — every route the server actually rewrites
// through api/preview has to answer with a path of its own.
//
// A wrong canonical is worse than none: it tells a search engine that six
// distinct season boards ARE the home page, which is the one claim that can
// de-index them all.
test('every route vercel.json rewrites through api/preview has its own canonical', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const routes = new Set()
  for (const { destination } of config.rewrites ?? []) {
    const match = /^\/api\/preview\?route=([a-z-]+)/.exec(destination ?? '')
    if (match) routes.add(match[1])
  }
  assert.ok(routes.size > 20, `expected the preview rewrites to be found, saw ${routes.size}`)

  const homed = []
  for (const route of routes) {
    // Give the parameterised routes their parameters; the rest take none.
    const params = new URLSearchParams({ route, id: '158', scope: 'pitching', orgId: '158' })
    if (canonicalUrl(params) === `${SITE_URL}/`) homed.push(route)
  }
  assert.deepEqual(homed, [], `these routes canonicalise to the home page: ${homed.join(', ')}`)
})

test('the canonical names the SLUGGED address, spelled from the resolved name', () => {
  // The point of the whole scheme. Both '/player/545361' and
  // '/player/mike-trout-545361' resolve (route.js keeps every pre-slug link
  // working), so it is rel=canonical that decides which one a search engine
  // counts — and if it kept naming the bare id, the slug would earn nothing.
  const params = new URLSearchParams({ route: 'player', id: '545361' })
  const card = { segment: 'mike-trout-545361' }
  assert.equal(canonicalUrl(params, card), `${SITE_URL}/player/mike-trout-545361`)

  const team = new URLSearchParams({ route: 'team-roster', id: '158' })
  assert.equal(
    canonicalUrl(team, { segment: 'milwaukee-brewers-158' }),
    `${SITE_URL}/team/milwaukee-brewers-158/roster`,
  )
})

test('a stale or absent slug on the way IN is re-spelled on the way OUT', () => {
  // A link carrying a player's old club, a truncated slug, or no slug at all
  // must still name the one canonical page — which is why the segment is built
  // from what statsapi just returned, never from what the visitor arrived on.
  const card = { segment: 'mike-trout-545361' }
  for (const arrived of ['545361', 'mike-trout-545361', 'completely-wrong-545361']) {
    const params = new URLSearchParams({ route: 'player', id: arrived })
    assert.equal(canonicalUrl(params, card), `${SITE_URL}/player/mike-trout-545361`, arrived)
  }
})

test('with no card resolved the canonical still names a working address', () => {
  // statsapi down, or a card that would not build: the page falls back to the
  // static default block, and the canonical falls back to the segment the
  // request arrived on. It must stay a real address — the next crawl, with
  // statsapi back, re-spells it.
  const params = new URLSearchParams({ route: 'player', id: 'mike-trout-545361' })
  assert.equal(canonicalUrl(params, null), `${SITE_URL}/player/mike-trout-545361`)
  assert.equal(
    canonicalUrl(new URLSearchParams({ route: 'team', id: '158' }), null),
    `${SITE_URL}/team/158`,
  )
})

test('the injected head carries a rel=canonical, and it agrees with og:url', () => {
  const card = {
    title: 'Christian Yelich | Tally Baseball',
    description: 'Season line, splits and recent form.',
    image: 'https://deploy-abc123.vercel.app/api/og?card=player',
    alt: 'Christian Yelich',
  }
  const url = canonicalUrl(new URLSearchParams({ route: 'player', id: '592885' }))
  const head = renderHead(card, url)

  const canonical = head.match(/<link rel="canonical" href="([^"]+)"/)
  const ogUrl = head.match(/<meta property="og:url" content="([^"]+)"/)
  assert.ok(canonical, 'a canonical tag is emitted')
  assert.ok(ogUrl, 'an og:url is emitted')
  // site.js's rule: a canonical and an og:url that disagree are worse than
  // neither, because the crawler picks one and does not tell you which.
  assert.equal(canonical[1], ogUrl[1])
  assert.equal(canonical[1], `${SITE_URL}/player/592885`)
  // The IMAGE still comes off the serving deploy — only the page URL is pinned.
  assert.ok(head.includes(card.image))
})

// Every team-hub tab (Overview is untagged; the other five pass `tab`) needs
// its own eyebrow and a description that actually mentions the tab, so a
// copy-pasted config entry can't silently describe the wrong tab.
test('every team-hub tab has a distinct, non-empty eyebrow and description', () => {
  const tabs = Object.keys(TEAM_TABS)
  assert.deepEqual(tabs.sort(), ['games', 'leaders', 'minors', 'numbers', 'roster'].sort())
  const eyebrows = new Set()
  for (const tab of tabs) {
    const cfg = TEAM_TABS[tab]
    assert.ok(cfg.eyebrow, `${tab} needs a non-empty eyebrow`)
    assert.ok(!eyebrows.has(cfg.eyebrow), `${tab}'s eyebrow "${cfg.eyebrow}" collides with another tab`)
    eyebrows.add(cfg.eyebrow)
    const desc = cfg.description('Milwaukee Brewers')
    assert.ok(desc.includes('Milwaukee Brewers'), `${tab}'s description should mention the team name`)
  }
})

// ------------------------------------------------ the mirrored slug helpers
//
// cards.js keeps its own copies of route.js's slugify/idFromSlug, because the
// edge runtime cannot import the app's ESM module graph, and its header says to
// keep them in sync. Saying so is what every drifted copy in this repo's history
// also did, so this asserts it instead: the two must agree on the same battery
// of inputs, or the client links to one address while the canonical names
// another — which is the exact failure the slug scheme exists to avoid.
test('the edge copies of slugify/idFromSlug match the app’s', () => {
  const names = [
    'Mike Trout',
    'José Ramírez',
    'Yoán Moncada',
    "D'Angelo Ortiz Jr.",
    'St. Louis Cardinals',
    'Rocket City Trash Pandas',
    'Athletics',
    'A'.repeat(60),
    '—',
    '',
    null,
    undefined,
  ]
  for (const name of names) {
    assert.equal(edgeSlugify(name), slugify(name), `slugify(${String(name)})`)
  }

  const segments = [
    '545361',
    'mike-trout-545361',
    'area-code-51-5015',
    'completely-wrong-158',
    'not-an-id',
    '',
  ]
  for (const seg of segments) {
    assert.equal(edgeIdFromSlug(seg), idFromSlug(seg), `idFromSlug(${seg})`)
  }
})
