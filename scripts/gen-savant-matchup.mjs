// Regenerates public/data/savant-matchup.json — the season Statcast rates the
// MATCHUP callouts read, for every qualified batter and pitcher, plus the
// league mean/SD each rate is scored against.
//
// WHY THIS FILE EXISTS SEPARATELY from savant-percentiles.json: that file
// carries Savant's own PERCENTILE ranks for a fixed handful of metrics, and the
// matchup families need three things it cannot give — raw rates on both sides
// of one axis, batted-ball direction (pull) and ground-ball rate, which are not
// on the percentile board at all, and the league SPREAD, so a note can ask
// whether a number is genuinely extreme rather than merely above average.
//
// THE FINDING THIS RESTS ON. Savant's `custom` leaderboard returns the SAME
// columns for type=batter and type=pitcher. A batter's `pull_percent` is how
// often HE pulls; a pitcher's is how often hitters pull AGAINST him. The two
// boards agree on the league mean because they are the same events counted from
// two sides (verified 2026-08-20: pull 39.4 vs 39.3, chase 31.4 vs 30.5, whiff
// 25.8 vs 25.4). That agreement is what makes comparing a hitter to a pitcher on
// one axis legitimate rather than a category error — if a future run shows the
// two sides drifting apart, the comparison is what broke, not the formatting.
//
// NOT AVAILABLE, do not add: handedness splits. `pitcher_throws`,
// `batter_stands` and `hand` are all accepted by this endpoint and all silently
// IGNORED — L and R return identical rows. The app's vs-L/vs-R splits come from
// statsapi sitCodes (the `platoon` family), not from here.
//
// MLB only — Savant has no minor-league board, so a MiLB game simply builds no
// matchup notes, the same way the foul-spoiler family already behaves.
//
// Runs nightly via .github/workflows/update-nightly-data.yml, NOT at request
// time: the live app only ever reads this small same-origin static file
// (src/api/matchup/savant.js). See docs/data-enrichment.md §3/§5.
// Run by hand: node scripts/gen-savant-matchup.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import { fetchCustomBoard, meanSd, num, round1 } from './lib/savant.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'savant-matchup.json')
const season = new Date().getFullYear()

// Savant selection id -> the short key the app reads. Both roles use the SAME
// map, which is the whole point (see the header).
//
// Five axes, split by what they mean rather than by where they came from:
//   SKILL — one direction is better. A collision on these is strength vs
//           strength, or a strength against a hole.
//   STYLE — neither direction is better; they are tendencies, and the note
//           only fires when the two point OPPOSITE ways.
const METRICS = {
  // skill
  oz_swing_percent: 'chase',
  whiff_percent: 'whiff',
  hard_hit_percent: 'hardHit',
  // style
  pull_percent: 'pull',
  groundballs_percent: 'gb',
}
// Carried for the sample floor and the "(N PA)" clause, never scored.
const SAMPLE = { pa: 'pa' }

// A player under this many plate appearances is dropped outright. Savant's own
// `min` already filters, but it filters on batted-ball events for one role and
// PA for the other, so the floor is re-applied here on one consistent column.
const MIN_PA = 50

const SELECTIONS = [...Object.keys(METRICS), ...Object.keys(SAMPLE)]

function boardToMap(rows) {
  const map = {}
  for (const r of rows) {
    const id = r.player_id
    if (!id) continue
    const pa = num(r.pa)
    if (pa == null || pa < MIN_PA) continue
    const entry = { pa }
    let hasAny = false
    for (const [srcCol, key] of Object.entries(METRICS)) {
      const n = num(r[srcCol])
      entry[key] = n == null ? null : round1(n)
      if (entry[key] != null) hasAny = true
    }
    if (hasAny) map[id] = entry
  }
  return map
}

const [batRows, pitRows] = [
  await fetchCustomBoard('batter', { season, selections: SELECTIONS }),
  await fetchCustomBoard('pitcher', { season, selections: SELECTIONS }),
]

const bat = boardToMap(batRows)
const pit = boardToMap(pitRows)

// The league mean and spread every note is scored against, computed from the
// SAME response the player rows came from — so a note can never be scored
// against a baseline from a different day's population.
const league = { bat: {}, pit: {} }
for (const [srcCol, key] of Object.entries(METRICS)) {
  league.bat[key] = meanSd(batRows, srcCol)
  league.pit[key] = meanSd(pitRows, srcCol)
}

// A renamed selection id does not error — it returns a column of blanks. Report
// per-metric coverage so a silent blanking shows up in the job log the day it
// happens, rather than as notes quietly ceasing to fire.
let thin = 0
for (const [group, rows, map] of [['bat', batRows, league.bat], ['pit', pitRows, league.pit]]) {
  for (const [srcCol, key] of Object.entries(METRICS)) {
    const filled = rows.filter((r) => num(r[srcCol]) != null).length
    if (map[key] == null || filled < rows.length / 2) {
      console.error(
        `WARNING: ${group}.${key} (${srcCol}) is ${filled}/${rows.length} filled — selection id may have changed`,
      )
      thin++
    }
  }
}

// The two sides must agree on each league mean, because they count the same
// events. A drift past this is the comparison itself breaking — louder than a
// formatting bug and worth failing the run over.
const DRIFT_MAX = 4.0
let drifted = 0
for (const key of Object.values(METRICS)) {
  const b = league.bat[key]
  const p = league.pit[key]
  if (!b || !p) continue
  const gap = Math.abs(b.m - p.m)
  if (gap > DRIFT_MAX) {
    console.error(
      `WARNING: league ${key} disagrees across boards — batters ${b.m}, pitchers ${p.m} (gap ${round1(gap)})`,
    )
    drifted++
  }
}

if (!Object.keys(bat).length || !Object.keys(pit).length) {
  console.error('no qualified players on one or both boards — leaving the previous file alone')
  process.exit(1)
}

await writeJsonAtomic(out, { season, generatedAt: new Date().toISOString(), minPa: MIN_PA, league, bat, pit })
console.log(
  `wrote ${out} (${Object.keys(bat).length} batters, ${Object.keys(pit).length} pitchers, ` +
  `${thin} thin metrics, ${drifted} drifted)`,
)
