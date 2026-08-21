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
import { fetchCustomBoard, fetchArsenalBoard, meanSd, meanSdGrouped, num, round1 } from './lib/savant.mjs'

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

// ---------------------------------------------------------------------------
// Family C — the arsenal matchup. A level deeper than the two axes above: the
// same hitter and pitcher, on ONE PITCH TYPE, joined on Savant's
// pitch-arsenal-stats board (player_id, pitch_type) — identical columns for
// both roles, same as the custom board. See docs/callouts.md, "Matchup
// callouts", and src/api/matchup/arsenal.js's header for the note builder.
//
// WHIFF IS THE ONLY SCORED METRIC. A hitter has a median 36 PA against one
// pitch type — batting average there is 12% real skill by an exact binomial
// model; whiff is ~84%, because its denominator is PITCHES SEEN (median 149),
// not PA. `ba` is carried on the batter row for display color only, never
// scored and never compared to a baseline.
const PITCH_USAGE_MIN = 15 // percent of a pitcher's OWN pitches — "a pitch he throws 4% of the time isn't what this at-bat is about"
const PITCH_THROWN_MIN = 150 // pitches thrown, gates a pitcher's own pitch rows
const BATTER_PA_MIN = 40 // plate appearances vs one pitch type, gates a hitter's rows (the payload-size floor, docs/scratch spec)
// Regression weight, in PITCHES SEEN — whiff is already ~94% stable, so it
// barely needs regressing toward the pitch type's own league mean. K=200
// collapsed the prototype to 3 notes across 6 games and lost every good one;
// K=50 gave 9, about 1.5 a game — the right volume for a 2-5 slot surface.
const WHIFF_REGRESS_K = 50

const regress = (raw, n, leagueMean) =>
  leagueMean == null ? raw : (raw * n + leagueMean * WHIFF_REGRESS_K) / (n + WHIFF_REGRESS_K)

const [pitArsenalRows, batArsenalRows] = [
  await fetchArsenalBoard('pitcher', { season }),
  await fetchArsenalBoard('batter', { season }),
]

// Per-pitch-type league whiff baseline, one board per role — computed from
// Savant's own min=10 population, NOT the app's stricter gates below, same
// "each side scored against its own board" rule the skill/style families use.
const arsenalLeague = {
  pit: meanSdGrouped(pitArsenalRows, 'pitch_type', 'whiff_percent'),
  bat: meanSdGrouped(batArsenalRows, 'pitch_type', 'whiff_percent'),
}

// Gate the PITCH, not just the players: a pitcher's own row for a pitch type
// only counts once it's a real part of his repertoire.
function pitcherArsenalMap(rows) {
  const map = {}
  for (const r of rows) {
    const id = r.player_id
    const type = r.pitch_type
    if (!id || !type) continue
    const usage = num(r.pitch_usage)
    const pitches = num(r.pitches)
    const whiff = num(r.whiff_percent)
    if (usage == null || pitches == null || whiff == null) continue
    if (usage < PITCH_USAGE_MIN || pitches < PITCH_THROWN_MIN) continue
    const lg = arsenalLeague.pit[type]?.m
    if (!map[id]) map[id] = {}
    map[id][type] = { usage: round1(usage), whiff: round1(regress(whiff, pitches, lg)) }
  }
  return map
}

// A single global "pitches seen" floor makes this ALL FASTBALL — a splitter
// specialist's batters never clear a floor tuned for four-seamers. The
// regression above (toward the TYPE's own mean, weighted by pitches seen)
// is what keeps a thin-sample curveball or sweeper row honest instead of
// excluding it outright; the flat PA_MIN here is the payload-size floor only.
function batterArsenalMap(rows) {
  const map = {}
  for (const r of rows) {
    const id = r.player_id
    const type = r.pitch_type
    if (!id || !type) continue
    const pa = num(r.pa)
    const pitches = num(r.pitches)
    const whiff = num(r.whiff_percent)
    const ba = num(r.ba)
    if (pa == null || pitches == null || whiff == null || pa < BATTER_PA_MIN) continue
    const lg = arsenalLeague.bat[type]?.m
    if (!map[id]) map[id] = {}
    map[id][type] = {
      whiff: round1(regress(whiff, pitches, lg)),
      ba: ba == null ? null : Math.round(ba * 1000) / 1000,
      pa,
    }
  }
  return map
}

const arsenal = { pit: pitcherArsenalMap(pitArsenalRows), bat: batterArsenalMap(batArsenalRows) }

let arsenalThin = 0
for (const [group, rows] of [['pit', pitArsenalRows], ['bat', batArsenalRows]]) {
  const filled = rows.filter((r) => num(r.whiff_percent) != null).length
  if (filled < rows.length / 2) {
    console.error(`WARNING: arsenal.${group}.whiff is ${filled}/${rows.length} filled — selection id may have changed`)
    arsenalThin++
  }
}

if (!Object.keys(arsenal.pit).length || !Object.keys(arsenal.bat).length) {
  console.error('no qualified arsenal rows on one or both boards — leaving the previous file alone')
  process.exit(1)
}

league.arsenal = arsenalLeague

await writeJsonAtomic(out, {
  season, generatedAt: new Date().toISOString(), minPa: MIN_PA, league, bat, pit, arsenal,
})
console.log(
  `wrote ${out} (${Object.keys(bat).length} batters, ${Object.keys(pit).length} pitchers, ` +
  `${Object.keys(arsenal.bat).length} arsenal batters, ${Object.keys(arsenal.pit).length} arsenal pitchers, ` +
  `${thin} thin metrics, ${drifted} drifted, ${arsenalThin} thin arsenal metrics)`,
)
