// Unit coverage for firstNonNull (api/_lib/cards.js), the race helper behind
// resolveGame's fix for a reproduced bug: a shared game link could fall back
// to the static default preview card because resolveGame waited on
// Promise.allSettled across all 5 sport-level schedule calls even after the
// MLB answer was already in — one slow/hung MiLB-level response (more likely
// exactly when a game is live and statsapi is busier) gated an already-found
// match. Exercised here with plain fake-delay promises rather than mocked
// fetch/statsapi calls, since the race behavior itself is network-agnostic.
import assert from 'node:assert/strict'
import test from 'node:test'
import { firstNonNull, buildCard, TEAM_TABS } from '../api/_lib/cards.js'

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
  'team-records',
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
