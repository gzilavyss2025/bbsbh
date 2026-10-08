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
  'xwoba-table/': 'hand-run a few times a season (gen-xwoba-table.mjs, ADR-0097); a table holds for a month',
  'contracts-history/': 'hand-run from committed CSVs (ADR-0066)',
  'team-seasons.json': 'hand-run from Retrosheet and the Chadwick register (ADR-0100); history, and the file carries no clock',
  'family-ties/': 'hand-run from Retrosheet and the Chadwick register (ADR-0100); history, and the files carry no clock',
  'on-this-day/': 'hand-run from Retrosheet and the Chadwick register (ADR-0100); history, and the files carry no clock',
  'birthplaces/': 'hand-run from Retrosheet, the Chadwick register and GeoNames (ADR-0100, ADR-0106); history, and the files carry no clock',
  'savant-history/': 'hand-run once a year (gen-savant-history.mjs, #1717); finished seasons, and the shards carry no clock',
  'franchise-history/': 'hand-run; a season adds one span at most, and the files carry no clock',
  'prospect-rank-history.json': 'hand-run; the 2005-2024 rankings are frozen and the file carries no clock (#1111)',
  'run-expectancy-eras/': 'hand-run, one decade at a time (gen-run-expectancy.mjs --era-aggregate); history',
  'league-averages.json': 'hand-run; a finished season never changes and the file carries no clock',
  'ovr/': 'hand-run (gen-ovr.mjs, #1720) after the prior-season stores are rebuilt each autumn; the shards carry no clock, so a rerun on the same files writes the same bytes',
  'milb-seasons/': 'hand-run once a year (gen-milb-seasons.mjs, #1719); a finished minor-league season never changes',
  // Frozen ON PURPOSE, which is the one shape this guard cannot tell from a
  // dead generator. A level's pool is a list of games from a season that is
  // over, so it is checked once and then only re-joined against the prospect
  // and promotion boards — and it is rewritten only when one of those boards
  // actually moves (scripts/gen-milb-pool.mjs). An unchanged file is the
  // healthy state here, not a missed night.
  'milb-pool/': 'frozen per season by design; re-joined, not regenerated, each night',
  // The offseason page's two notebook notes (issue #1078). Both describe a
  // FINISHED season, so both are frozen from the day it ends until the next one
  // starts — the same shape as milb-pool/ above, and neither is rewritten on a
  // timestamp alone.
  //
  // long-at-bats/ also does not need this guard, which is the stronger reason:
  // it states its own coverage. Every run re-reads the season's played-game
  // count off the live schedule, and the note renders nothing at all unless
  // every one of those games has been ingested (`coverage.complete`). A sweep
  // that quietly stopped in July takes the note off the page rather than
  // publishing a census that is short a thousand games.
  'long-at-bats/': 'frozen once a season ends; the file states its own coverage and fails closed',
  // notable/ is the same shape as long-at-bats/ above: a nightly run refreshes only the
  // season in play, every older season is frozen, and each file's `coverage` block (the
  // seasons swept and the date the data runs through) is its own clock. A feat is rare, so
  // an unchanged file is the healthy state, and a stamp would rewrite it nightly for nothing.
  'notable/': 'the season in play is refreshed nightly, older seasons are frozen; each file states its own coverage and carries no clock',
  'youngest-regulars/': 'frozen per season by design; rewritten only when a league’s figures move',
  // A season store (ADR-0086). Its files were four stamped top-level files
  // until #1200 moved them into one folder per season. A completed season is
  // frozen, and a file is rewritten only when its content changes, so an
  // unchanged stamp is the healthy state here, as with milb-pool/ above.
  'abs/': 'season store (ADR-0086): a completed season is frozen; files move only with their content',
}

// Where a dataset keeps its stamp, when it is not a top-level `generatedAt`.
// New generators write `generatedAt`, never `asOf` (that word means the spoiler
// CUTOFF elsewhere: src/components/seal/AsOfBanner.jsx, and the `cutoff-gated`
// class in src/api/spoiler-manifest.json) and never a date-only value, which JS
// reads as midnight UTC and so makes a late hand dispatch look a day old.
// workload.json, workload-summary.json and doubleheaders.json used to be listed
// here for exactly that reason; they now write `generatedAt`.
export const STAMP_KEY = {
  'salaries.json': 'meta.generatedAt',
}

const DEFAULT_KEYS = ['generatedAt']

// How many datasets are allowed to carry no stamp at all. An unstamped dataset
// cannot be checked, so this is a ratchet, not an alarm: it holds the line at
// today's count so a NEW dataset has to either carry a stamp or be a deliberate
// decision recorded here. Same budget idea as check-dir-size.mjs (ADR-0038).
// Three of these are unstamped ON PURPOSE and must stay that way — team-records/,
// milb-alumni/, and schedule-shape/ write 30-150 committed shards each, and a
// per-shard timestamp would rewrite every one of them nightly for no reader's
// benefit (gen-schedule-shape.mjs records the same trap at its own write site).
// Lowered 23 -> 22 when former-teammates/ started to write an index.json
// (#1145), so the slot it freed cannot be reused in silence.
// Raised 22 -> 23 for hitter-grid/ (ADR-0096), a sharded season store like
// pitch-command/ beside it: 101 shards a season, rewritten only when a game
// lands. Its files arrive with the first 2026 re-walk.
export const UNSTAMPED_BUDGET = 23

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
