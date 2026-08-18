import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// A shared, offline-first stand-in for statsapi.mlb.com + the mlbstatic.com
// image CDNs, for specs that would otherwise hand-roll a mock feed/schedule
// or depend on reaching the real network. Two things prompted this:
//
// 1. Every spec that needed a mock was inventing its own (see git history on
//    pregame-scoreboard.spec.js), which is duplicated, token-costly work for
//    the same underlying data.
// 2. Some sandboxes can't reach statsapi.mlb.com from Chromium at all (see
//    the PR template's Verification section) — the old workaround was
//    troubleshooting with a headed/debug browser, which doesn't fix a
//    network block and is why real windows started popping up locally too.
//
// Strategy: serve a captured real response when one exists for the request,
// otherwise relay the request through Node's `fetch` (which reaches the
// network in sandboxes where Chromium's own requests are blocked — the
// technique scorecard.spec.js proved first) and abort only if that also
// fails. A spec never hangs or hard-fails just because a corner of the API
// surface isn't captured yet.
//
// ANCHOR_GAME_PK/ANCHOR_DATE match docs/test-games.md's pinned anchor game —
// reuse them so a new capture stays keyed to the same well-understood game
// instead of introducing another one-off gamePk.
export const ANCHOR_GAME_PK = 823035
export const ANCHOR_DATE = '2026-07-07'

const DIR = path.dirname(fileURLToPath(import.meta.url))

function readJson(relPath) {
  return JSON.parse(readFileSync(path.join(DIR, relPath), 'utf8'))
}

// Returns a FRESH parse every call, so a spec that mutates the result (e.g.
// pregame-scoreboard.spec.js repurposing the anchor feed as a different,
// fictional game) never leaks state into another test.
export function loadFixture(name) {
  return readJson(`api/${name}.json`)
}

// pathname (query-string ignored) -> loader returning a JSON body, or null
// to fall through to the live relay. Add an entry here, plus a captured file
// under api/, to cover another endpoint/game.
const API_FIXTURES = [
  {
    test: (url) => url.pathname === `/api/v1.1/game/${ANCHOR_GAME_PK}/feed/live`,
    load: () => loadFixture(`feed-${ANCHOR_GAME_PK}`),
  },
  {
    test: (url) => url.pathname === '/api/v1/schedule' && url.searchParams.get('date') === ANCHOR_DATE,
    load: () => loadFixture(`schedule-${ANCHOR_DATE.replace(/-/g, '')}`),
  },
]

// Logos/headshots/ballpark photos rarely need to be the CORRECT image for a
// spec to prove layout — one real captured file per image family covers
// almost every case. Specs that genuinely assert on branding should route
// around this (or extend it) rather than rely on it.
const IMAGE_FIXTURES = [
  {
    test: (url) => url.hostname === 'www.mlbstatic.com' && url.pathname.includes('team-logos'),
    file: 'images/team-logo.svg',
    contentType: 'image/svg+xml',
  },
  {
    test: (url) => url.hostname === 'img.mlbstatic.com' && url.pathname.includes('headshot'),
    file: 'images/headshot.png',
    contentType: 'image/png',
  },
]

async function relayOrAbort(route, relay) {
  if (!relay) {
    await route.abort()
    return
  }
  try {
    const res = await fetch(route.request().url())
    const body = Buffer.from(await res.arrayBuffer())
    await route.fulfill({
      status: res.status,
      contentType: res.headers.get('content-type') ?? 'application/json',
      body,
    })
  } catch {
    await route.abort()
  }
}

// Install once per test/page. `relay: false` makes any uncaptured request
// abort instead of hitting the real network — useful for proving a spec is
// fully offline-covered, but off by default so new endpoints don't silently
// break specs that haven't been captured yet.
export async function installMockApi(page, { relay = true } = {}) {
  await page.route('https://statsapi.mlb.com/**', async (route) => {
    const url = new URL(route.request().url())
    const fixture = API_FIXTURES.find((f) => f.test(url))
    const body = fixture?.load()
    if (body) {
      await route.fulfill({ json: body })
      return
    }
    await relayOrAbort(route, relay)
  })

  await page.route(/mlbstatic\.com/, async (route) => {
    const url = new URL(route.request().url())
    const fixture = IMAGE_FIXTURES.find((f) => f.test(url))
    if (fixture) {
      await route.fulfill({ path: path.join(DIR, fixture.file), contentType: fixture.contentType })
      return
    }
    await relayOrAbort(route, relay)
  })
}
