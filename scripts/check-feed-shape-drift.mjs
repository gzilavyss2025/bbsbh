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
// Fetches a FRESH copy of each captured anchor-day fixture — the anchor game's
// feed (823035) and that day's schedule (2026-07-07). A completed historical
// game day's own content never changes, so any path present in a captured
// fixture but missing from a fresh fetch is real API-shape drift (MLB
// renamed/removed/restructured something), not the game moving on. This is why
// those two fixtures carry noExpiry in e2e/fixtures/manifest.json: their risk is
// shape, not age (#1194). One-directional on purpose: a field MLB ADDED since capture
// isn't a break and isn't flagged, only a path bbsbh already depends on that
// disappeared.
//
// Coarse by design — it checks that whole branches still exist (dict/array
// values are represented by one child so paths don't multiply per player/play),
// not that every leaf value's TYPE is unchanged. That's enough to catch the
// class of break this repo has actually hit (a field selectors read moving or
// disappearing), without pretending to be a full JSON-schema diff.

const MAX_DEPTH = 5

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')
const FIXTURES_DIR = path.join(ROOT, 'e2e/fixtures')

// Each fixture is fetched again from its own manifest sourceUrl, so the fresh
// copy asks for exactly what was captured (the schedule's hydrate list too).
const TARGETS = [
  { label: 'anchor-game feed (823035)', file: 'api/feed-823035.json' },
  { label: 'anchor-day schedule (2026-07-07)', file: 'api/schedule-20260707.json' },
]

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

let manifest
try {
  manifest = JSON.parse(readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'))
} catch (error) {
  console.error(`\n✗ Feed-shape drift check couldn't read manifest.json: ${error.message}\n`)
  process.exit(1)
}

// process.exitCode (not process.exit()) from here on: Node on Windows hits a
// libuv assertion tearing down a fetch's still-closing handle if the process
// exits immediately after an await fetch() — exitCode lets the loop drain
// naturally instead of forcing a teardown mid-close.
for (const { label, file } of TARGETS) {
  const url = manifest[file]?.sourceUrl
  let fixture
  try {
    if (!url) throw new Error(`manifest.json has no sourceUrl for ${file}`)
    fixture = JSON.parse(readFileSync(path.join(FIXTURES_DIR, file), 'utf8'))
  } catch (error) {
    console.error(`\n✗ Feed-shape drift check couldn't read the ${label} fixture: ${error.message}\n`)
    process.exitCode = 1
    continue
  }

  const expectedPaths = new Set()
  collectPaths(fixture, '', 0, expectedPaths)

  let fresh
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    fresh = await res.json()
  } catch (error) {
    console.error(
      `\n✗ Feed-shape drift check couldn't reach statsapi for the ${label} (${error.message}).\n` +
        '  This needs real network — run it from the nightly cron, or manually somewhere\n' +
        '  that can reach statsapi.mlb.com. It is deliberately not part of `npm run lint`.\n',
    )
    process.exitCode = 1
    continue
  }

  const missing = [...expectedPaths].filter((p) => resolvePath(fresh, p) === undefined).sort()

  if (missing.length) {
    console.error(
      `\n✗ Feed-shape drift: ${missing.length} path(s) the captured ${label} fixture depends\n` +
        `  on no longer resolve in a fresh fetch of ${url}.\n` +
        '  MLB changed the API shape, not the game — verify against a real response (CLAUDE.md),\n' +
        '  then recapture the fixture (docs/testing.md) and update e2e/fixtures/manifest.json.\n\n',
    )
    for (const p of missing) console.error(`  ${p}`)
    console.error('')
    process.exitCode = 1
  } else {
    console.log(
      `✓ Feed-shape check holds — ${expectedPaths.size} path(s) from the captured ${label} ` +
        'fixture still resolve in a fresh fetch.',
    )
  }
}
