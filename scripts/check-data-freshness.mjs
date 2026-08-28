#!/usr/bin/env node
// Fails when a committed public/data dataset is older than the cron that is
// supposed to write it. The nightly batch already reports a generator that
// THREW; nothing reported a generator that quietly produced nothing, wrote to a
// path no one staged, or never ran because GitHub dropped the schedule. Those
// are the failures this repo keeps having, and every one of them looks like a
// green run (see update-nightly-data.yml's header, and the 2026-08-28 miss).
//
// WHY THIS IS NOT IN `npm run lint`. Lint gates every PR, at arbitrary hours,
// from any branch. A max-age assertion there would red-X unrelated work every
// time a cron slipped, and the pressure would be to widen the budget until it
// meant nothing — exactly the test-defanging docs/testing.md warns about. It
// runs at the END of the nightly job instead, where a failure means what it
// says. `scripts/check-fixture-freshness.mjs` is the opposite case and belongs
// in lint: it measures how long since a HUMAN looked at a fixture, which no
// cron can change.
//
// DEFAULT-ON, OPT-OUT. Every dataset carrying a recognized stamp is checked
// unless it is named in EXCEPT below. That direction is deliberate: an
// inclusion list is the shape of bug this repo keeps hitting — the nightly's
// hand-maintained `git add` list drifted twice in silence — so a new nightly
// dataset is covered the moment it lands, with no edit here to forget.
//
// Run by .github/workflows/update-nightly-data.yml, after the commit step.
// Run by hand: node scripts/check-data-freshness.mjs

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'public/data')

// HOURS, not days, and that distinction is the whole guard. This check runs at
// the END of the nightly job, so a dataset written tonight is minutes old and
// one whose generator produced nothing is ~24 hours old — the two are only
// separable on an hours scale. A "2 day" budget would have taken THREE missed
// nights to fire and would have sailed straight through the 2026-08-28 incident
// it exists for. 20 hours sits well above any within-job spread (every generator
// runs after the wait step, inside ~10 minutes of each other) and well below the
// 24-hour gap that means a night was missed.
export const MAX_AGE_HOURS = 20

// Datasets that legitimately do NOT ride the nightly cron — hand-run backfills
// and once-a-season snapshots (docs/scripts/generators.md's "Hand-run
// generators" section). The value is the reason, printed when listing them, so
// an entry can never be a silent shrug.
export const EXCEPT = {
  'all-star-rosters.json': 'hand-run once per All-Star break',
  'awards-history.json': 'hand-run; a season’s awards move once, in November',
  'first-scorebook.json': 'hand-run retrospective of one scored game',
  'postseason-history.json': 'hand-run; only October adds to it',
  'postseason-leaders.json': 'hand-run; only October adds to it',
  'run-expectancy.json': 'hand-run; the 24-state table is recomputed per season',
  'level-tenure-benchmark.json': 'hand-run research dataset (docs/level-tenure-benchmark.md)',
  'milb-history.json': 'hand-run backfill of completed MiLB seasons',
  'game-notes-corroboration.json': 'hand-run audit sample, not a nightly product',
  'trade-deadline/': 'hand-run; the deadline passes once a year',
  'contracts-history/': 'hand-run from committed CSVs (ADR-0066)',
}

// Where a dataset keeps its stamp, when it is not a top-level `generatedAt`.
// `asOf` and `generated` are READ here but must never be INTRODUCED by a new
// generator: `asOf` already means the spoiler CUTOFF elsewhere in this codebase
// (src/components/seal/AsOfBanner.jsx, and the `cutoff-gated` class in
// src/api/spoiler-manifest.json), and one word cannot carry both meanings.
// New generators write `generatedAt`.
// Two of these are DATE-ONLY ("2026-08-28"), which JS parses as midnight UTC.
// That makes their measured age the run's time of day, so a nightly run at
// 07:00-11:30 leaves them 7-12h old — comfortably inside the budget — while a
// hand dispatch after ~20:00 UTC would trip them for no real reason. The
// alternative, reading a date-only stamp as the END of its day, would cost a
// full 24h of sensitivity and hide a missed night on exactly these files. The
// false positive is rare, loud, and obvious; the false negative would be
// silent, which is the thing this whole script exists to stop. Left as-is
// deliberately. A new generator should write a full `generatedAt` timestamp.
export const STAMP_KEY = {
  'fouls.json': 'asOf',
  'workload.json': 'asOf',
  'doubleheaders.json': 'generated',
  'salaries.json': 'meta.generatedAt',
}

const DEFAULT_KEYS = ['generatedAt']

// How many datasets are allowed to carry no stamp at all. An unstamped dataset
// cannot be checked, so this is a ratchet, not an alarm: it holds the line at
// today's count so a NEW dataset has to either carry a stamp or be a deliberate
// decision recorded here. Same budget idea as check-dir-size.mjs (ADR-0038).
// Two of these are unstamped ON PURPOSE and must stay that way — team-records/
// and milb-alumni/ write 120-150 committed shards each, and a per-shard
// timestamp would rewrite every one of them nightly for no reader's benefit.
export const UNSTAMPED_BUDGET = 22

const dig = (obj, dotted) => dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)

function readStamp(file, name) {
  let json
  try {
    json = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
  if (!json || Array.isArray(json)) return null
  const key = STAMP_KEY[name]
  if (key) return { key, value: dig(json, key) ?? null }
  for (const k of DEFAULT_KEYS) if (json[k]) return { key: k, value: json[k] }
  return null
}

// Every dataset under public/data: a top-level .json file, or a directory,
// which stamps itself through an index.json if it has one.
export function collectDatasets(dataDir = DATA_DIR) {
  const out = []
  for (const entry of readdirSync(dataDir).sort()) {
    const full = path.join(dataDir, entry)
    if (statSync(full).isDirectory()) {
      const index = path.join(full, 'index.json')
      const name = `${entry}/`
      out.push({ name, stamp: existsSync(index) ? readStamp(index, name) : null })
    } else if (entry.endsWith('.json')) {
      out.push({ name: entry, stamp: readStamp(full, entry) })
    }
  }
  return out
}

// Pure, so test/data-freshness.test.js can drive it without a data directory.
export function evaluate(datasets, { now = Date.now(), maxAgeHours = MAX_AGE_HOURS } = {}) {
  const stale = []
  const unreadable = []
  const unstamped = []
  const excepted = []
  let checked = 0
  for (const { name, stamp } of datasets) {
    if (name in EXCEPT) {
      excepted.push({ name, why: EXCEPT[name] })
      continue
    }
    if (!stamp || !stamp.value) {
      unstamped.push(name)
      continue
    }
    const at = new Date(stamp.value)
    if (Number.isNaN(at.getTime())) {
      unreadable.push({ name, value: String(stamp.value), key: stamp.key })
      continue
    }
    checked += 1
    const ageHours = Math.floor((now - at.getTime()) / 3_600_000)
    if (ageHours > maxAgeHours) {
      stale.push({ name, key: stamp.key, value: stamp.value, ageHours })
    }
  }
  return { stale, unreadable, unstamped, excepted, checked }
}

function main() {
  if (!existsSync(DATA_DIR)) {
    console.error(`\n✗ Data-freshness guard couldn't find ${DATA_DIR}.\n`)
    process.exit(1)
  }
  const datasets = collectDatasets()
  // The vacuous-pass hazard check-fixture-freshness.mjs calls out: an empty
  // data directory must fail, not print a tick over nothing.
  if (datasets.length === 0) {
    console.error('\n✗ Data-freshness guard found no datasets under public/data.\n')
    process.exit(1)
  }
  const { stale, unreadable, unstamped, excepted, checked } = evaluate(datasets)
  const overBudget = unstamped.length > UNSTAMPED_BUDGET

  if (stale.length || unreadable.length || overBudget) {
    console.error('\n✗ Data-freshness guard failed.\n')
    for (const { name, key, value, ageHours } of stale) {
      console.error(
        `  ${name} — ${key} is ${value} (${ageHours}h old, over the ${MAX_AGE_HOURS}h budget)`,
      )
    }
    for (const { name, key, value } of unreadable) {
      console.error(`  ${name} — ${key} "${value}" isn't a date this can parse`)
    }
    if (overBudget) {
      console.error(
        `  ${unstamped.length} datasets carry no stamp, over the budget of ${UNSTAMPED_BUDGET}:\n` +
          `    ${unstamped.join(', ')}`,
      )
    }
    console.error(
      '\n  A stale dataset means its generator produced nothing, wrote somewhere\n' +
        '  nothing staged, or never ran. Check the step above, then the run history —\n' +
        '  gh run list --workflow=update-nightly-data.yml — because a dropped schedule\n' +
        '  leaves NO run record at all. A dataset that genuinely is not nightly belongs\n' +
        '  in EXCEPT in this script, with the reason. A new unstamped dataset should\n' +
        '  write generatedAt instead of raising the budget.\n',
    )
    process.exit(1)
  }

  console.log(
    `✓ Data-freshness guard holds — ${checked} dataset(s) stamped within ${MAX_AGE_HOURS}h, ` +
      `${excepted.length} hand-run, ${unstamped.length}/${UNSTAMPED_BUDGET} unstamped.`,
  )
}

// Importable for its tests, runnable as a script — the same guard
// scripts/gen-attendance.mjs and friends use.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
