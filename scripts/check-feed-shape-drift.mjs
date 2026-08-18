#!/usr/bin/env node
// Automates the half of CLAUDE.md's "verify feed field paths against a live
// game... confirm a new field against a real response; do not guess" rule that
// a script can actually do: catching when a path bbsbh's captured e2e fixture
// depends on stops resolving in the real API.
//
// NEEDS LIVE NETWORK, so it is NOT part of `npm run lint` — CI usually can't
// reach statsapi.mlb.com (see the PR template's Verification note). Run it
// manually (`npm run check:feed-shape-drift`) or from the nightly cron
// (update-nightly-data.yml), which does have real network.
//
// Fetches a FRESH copy of the same anchor game (823035) the fixture was
// captured from — a completed historical game's own content never changes, so
// any path present in the captured fixture but missing from a fresh fetch is
// real API-shape drift (MLB renamed/removed/restructured something), not the
// game moving on. One-directional on purpose: a field MLB ADDED since capture
// isn't a break and isn't flagged, only a path bbsbh already depends on that
// disappeared.
//
// Coarse by design — it checks that whole branches still exist (dict/array
// values are represented by one child so paths don't multiply per player/play),
// not that every leaf value's TYPE is unchanged. That's enough to catch the
// class of break this repo has actually hit (a field selectors read moving or
// disappearing), without pretending to be a full JSON-schema diff.

const ANCHOR_GAME_PK = 823035
const FEED_URL = `https://statsapi.mlb.com/api/v1.1/game/${ANCHOR_GAME_PK}/feed/live`
const MAX_DEPTH = 5

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')
const FIXTURE_PATH = path.join(ROOT, 'e2e/fixtures/api', `feed-${ANCHOR_GAME_PK}.json`)

function collectPaths(value, prefix, depth, out) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    // Represent an array by its first element's shape only — a play or
    // player missing an optional block (e.g. no `review`) shouldn't read as
    // drift just because it isn't the SAME element on the fresh fetch.
    if (value.length) collectPaths(value[0], `${prefix}[]`, depth + 1, out)
    return
  }
  for (const key of Object.keys(value)) {
    const p = prefix ? `${prefix}.${key}` : key
    out.add(p)
    collectPaths(value[key], p, depth + 1, out)
  }
}

function resolvePath(root, dotPath) {
  let cur = root
  for (const seg of dotPath.split('.')) {
    const isArray = seg.endsWith('[]')
    const key = isArray ? seg.slice(0, -2) : seg
    cur = cur?.[key]
    if (isArray) cur = Array.isArray(cur) && cur.length ? cur[0] : undefined
    if (cur === undefined) return undefined
  }
  return cur
}

let fixture
try {
  fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
} catch (error) {
  console.error(`\n✗ Feed-shape drift check couldn't read ${FIXTURE_PATH}: ${error.message}\n`)
  process.exit(1)
}

const expectedPaths = new Set()
collectPaths(fixture, '', 0, expectedPaths)

// process.exitCode (not process.exit()) from here on: Node on Windows hits a
// libuv assertion tearing down a fetch's still-closing handle if the process
// exits immediately after an await fetch() — exitCode lets the loop drain
// naturally instead of forcing a teardown mid-close.
let fresh
try {
  const res = await fetch(FEED_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  fresh = await res.json()
} catch (error) {
  console.error(
    `\n✗ Feed-shape drift check couldn't reach statsapi (${error.message}).\n` +
      '  This needs real network — run it from the nightly cron, or manually somewhere\n' +
      '  that can reach statsapi.mlb.com. It is deliberately not part of `npm run lint`.\n',
  )
  process.exitCode = 1
  fresh = null
}

if (fresh) {
  const missing = [...expectedPaths].filter((p) => resolvePath(fresh, p) === undefined).sort()

  if (missing.length) {
    console.error(
      `\n✗ Feed-shape drift: ${missing.length} path(s) the captured anchor-game fixture depends ` +
        `on\n  no longer resolve in a fresh fetch of gamePk ${ANCHOR_GAME_PK}'s feed. MLB changed\n` +
        '  the API shape, not the game — verify against a real response (CLAUDE.md), then\n' +
        '  recapture the fixture (docs/testing.md) and update e2e/fixtures/manifest.json.\n\n',
    )
    for (const p of missing) console.error(`  ${p}`)
    console.error('')
    process.exitCode = 1
  } else {
    console.log(
      `✓ Feed-shape check holds — ${expectedPaths.size} path(s) from the captured anchor-game ` +
        'fixture still resolve in a fresh fetch.',
    )
  }
}
