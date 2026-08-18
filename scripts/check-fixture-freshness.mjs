#!/usr/bin/env node
// Guards e2e/fixtures/manifest.json's own promise: every captured e2e API/image
// fixture names its own capture date, and this fails once one goes stale — the
// same "a convention with no script behind it drifts" argument check-dir-size.mjs
// makes for directory size (ADR-0038), applied here to captured fixtures instead.
//
// This does NOT check whether a fixture's DATA is still SHAPED right — that
// needs a live fetch, which CI can't make (see the PR template's Verification
// note), so it's check-feed-shape-drift.mjs's job instead, run from the nightly
// cron rather than `npm run lint`. This script only checks how long it's been
// since anyone looked, which needs no network and so can gate every push.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')
const FIXTURES_DIR = path.join(ROOT, 'e2e/fixtures')
const MANIFEST_PATH = path.join(FIXTURES_DIR, 'manifest.json')
const MAX_AGE_DAYS = 180

let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
} catch (error) {
  console.error(
    `\n✗ Fixture-freshness guard couldn't read ${MANIFEST_PATH}: ${error.message}\n`,
  )
  process.exit(1)
}

const entries = Object.entries(manifest)
// Same vacuous-pass hazard the line-ending guard calls out: an empty manifest
// must fail, not print ✓ over nothing.
if (entries.length === 0) {
  console.error('\n✗ Fixture-freshness guard found an empty manifest.json — nothing to check.\n')
  process.exit(1)
}

const now = Date.now()
const missingFiles = []
const stale = []

for (const [file, meta] of entries) {
  if (!existsSync(path.join(FIXTURES_DIR, file))) {
    missingFiles.push(file)
    continue
  }
  if (meta.noExpiry) continue
  const capturedAt = new Date(meta.capturedAt)
  if (Number.isNaN(capturedAt.getTime())) {
    stale.push({ file, reason: `capturedAt "${meta.capturedAt}" isn't a valid date` })
    continue
  }
  const ageDays = Math.floor((now - capturedAt.getTime()) / 86_400_000)
  if (ageDays > MAX_AGE_DAYS) {
    stale.push({ file, reason: `captured ${ageDays} days ago (over the ${MAX_AGE_DAYS}-day budget)` })
  }
}

if (missingFiles.length || stale.length) {
  console.error('\n✗ Fixture-freshness guard failed.\n')
  for (const file of missingFiles) {
    console.error(`  ${file} — listed in manifest.json but the file doesn't exist`)
  }
  for (const { file, reason } of stale) {
    console.error(`  ${file} — ${reason}`)
  }
  console.error(
    '\n  Recapture stale fixtures against the live API (capture recipe in docs/testing.md),\n' +
      '  update their capturedAt in e2e/fixtures/manifest.json, and re-run. A fixture only\n' +
      '  earns noExpiry:true if its content genuinely never goes stale (e.g. a generic logo).\n',
  )
  process.exit(1)
}

console.log(
  `✓ Fixture-freshness guard holds — ${entries.length} captured e2e fixture(s), none over ${MAX_AGE_DAYS} days old.`,
)
