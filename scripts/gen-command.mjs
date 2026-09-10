// Regenerates public/data/target-command.json — TARGET COMMAND, a pitcher's
// median distance between where the catcher set up and where the pitch actually
// crossed, per pitch type, for one season.
//
// The source is OpenCommand's published command_scores.csv rollup; everything
// about the dataset, its licence and its files is documented once in
// scripts/lib/opencommand.mjs. This script is only the shaping: join the rollup
// to this app's player id space, rank each pitcher against his own season, and
// write the small static file src/api/targetCommand.js reads.
//
// Runs nightly via .github/workflows/update-nightly-data.yml, never at request
// time — same build-time-fetch pattern as every other public/data set
// (src/api/CLAUDE.md). The dataset itself only moves when its author cuts a
// release, so most nights this writes an identical file.
//
// Run by hand: node scripts/gen-command.mjs [--season=2026]
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import {
  MIN_COMMAND_PITCHES,
  OPENCOMMAND_URL,
  digest,
  latestSeason,
  loadCommandScores,
  median,
  percentileLowerIsBetter,
  pitcherIdsByName,
} from './lib/opencommand.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'target-command.json')

const seasonArg = process.argv.find((a) => a.startsWith('--season='))
const preferred = seasonArg ? Number(seasonArg.slice('--season='.length)) : new Date().getFullYear()

// ONE SEASON, the current one — the same scope gen-savant-percentiles.mjs keeps,
// and for the same reason: the Analytics tab reads a player's CURRENT season, so
// a file carrying three would ship two of them to every reader for nothing. A
// pitcher whose season is not this one renders no card, which is the correct
// degrade rather than a gap.
const season = await latestSeason(preferred)
if (!season) {
  // OpenCommand starts at 2024 and a new season lands mid-year. Neither is an
  // error: write the empty shape so the reader's fetch still succeeds and every
  // card simply stands down.
  await writeJsonAtomic(out, {
    season: null,
    generatedAt: new Date().toISOString(),
    source: 'OpenCommand',
    sourceUrl: OPENCOMMAND_URL,
    license: 'CC BY-NC-SA 4.0',
    minPitches: MIN_COMMAND_PITCHES,
    pit: {},
    median: {},
    ranked: {},
  })
  console.log(`wrote ${out} (no OpenCommand season at or below ${preferred} — empty file)`)
  process.exit(0)
}

const [rows, { byName, dropped }] = await Promise.all([
  loadCommandScores(season),
  pitcherIdsByName(season),
])

if (dropped.length) {
  // Not a warning to fix — a name shared by two pitchers is a fact about the
  // season, and the row really is unattributable. Logged so the count is
  // visible if it ever jumps.
  console.log(
    `${season}: dropped ${dropped.length} ambiguous name(s) — ${dropped.map((d) => d.name).join(', ')}`,
  )
}

// personId -> { [pitchType]: { n, inferred } }, before ranking. A name with no
// id (dropped above, or a pitcher who appears in the rollup but not in the
// play-by-play) is skipped silently: the degrade convention, not an error.
const byPitcher = new Map()
let unresolved = 0
for (const row of rows) {
  const id = byName.get(row.pitcher)
  if (!id) {
    unresolved++
    continue
  }
  if (row.n < MIN_COMMAND_PITCHES) continue
  let entry = byPitcher.get(id)
  if (!entry) byPitcher.set(id, (entry = {}))
  entry[row.pitchType] = { n: row.n, inferred: row.inferredIn }
}

// THE POPULATION EACH ROW IS RANKED AGAINST is its own pitch type, not the
// league at large. A curveball misses by about an inch and a half more than a
// sinker does league-wide (2026: 11.1in against 9.5in), so ranking every pitch
// against one pooled distribution would tell a curveball specialist he has poor
// command of a pitch he throws better than anyone. Same reasoning as Savant
// ranking a slider's spin among sliders.
const populations = new Map()
for (const entry of byPitcher.values()) {
  for (const [pitchType, { inferred }] of Object.entries(entry)) {
    let pop = populations.get(pitchType)
    if (!pop) populations.set(pitchType, (pop = []))
    pop.push(inferred)
  }
}

// A pitch type thrown by only a handful of men in the league — a knuckleball, an
// eephus — has no population to rank against, so it carries a figure and no
// rank. Twenty is the point below which a percentile is really just "where in
// these few", and the strip renders a row without one perfectly well.
const MIN_RANKED_POPULATION = 20

const pit = {}
for (const [id, entry] of byPitcher) {
  const packed = {}
  for (const [pitchType, { n, inferred }] of Object.entries(entry)) {
    const pop = populations.get(pitchType)
    const pct = pop && pop.length >= MIN_RANKED_POPULATION
      ? percentileLowerIsBetter(inferred, pop)
      : null
    // [pitches, median miss in inches, percentile] — a fixed triple rather than
    // three named keys, which is what keeps this file to a couple of hundred KB
    // across ~800 pitchers and their pitch types. src/api/targetCommand.js is
    // the only reader and unpacks it in one place.
    packed[pitchType] = [n, Number(inferred.toFixed(2)), pct]
  }
  pit[id] = packed
}

// The league figure the strip's 50th-percentile reference line stands for, per
// pitch type — the MEDIAN of the same population each row is ranked against, so
// the printed baseline and the drawn line agree by construction (the argument
// gen-savant-percentiles.mjs's medianRates makes at more length).
const medianByType = {}
const ranked = {}
for (const [pitchType, pop] of populations) {
  ranked[pitchType] = pop.length
  if (pop.length < MIN_RANKED_POPULATION) continue
  medianByType[pitchType] = Number(median(pop).toFixed(2))
}

const payload = {
  season,
  source: 'OpenCommand',
  sourceUrl: OPENCOMMAND_URL,
  license: 'CC BY-NC-SA 4.0',
  minPitches: MIN_COMMAND_PITCHES,
  pit,
  median: medianByType,
  ranked,
}

await writeJsonAtomic(out, { ...payload, generatedAt: new Date().toISOString() })

console.log(
  `wrote ${out} (${season}: ${Object.keys(pit).length} pitchers, ` +
    `${Object.keys(medianByType).length} ranked pitch types, ` +
    `${unresolved} rollup row(s) with no id, league ALL median ${medianByType.ALL ?? '—'}in, ` +
    `digest ${digest(payload)})`,
)
