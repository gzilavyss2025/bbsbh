// Regenerates public/data/savant-percentiles.json — season Statcast percentile
// ranks per player, keyed by MLB Stats API personId. Pulled from Baseball
// Savant's own percentile-rankings leaderboard, which is undocumented but
// CORS-open (verified 2026-07-11: returns access-control-allow-origin: *) and
// already reports every metric as a 0–100 percentile rank — Savant has done
// the percentile computation AND the qualification-pool filtering itself
// (a player without enough sample for a metric simply has a blank cell for
// it), so this script does no percentile math of its own, unlike the
// qualification-floor work a raw Statcast leaderboard would require.
//
// This runs nightly via .github/workflows/update-nightly-data.yml, NOT at
// request time: the live app only ever fetches this small same-origin static
// file (src/api/savantPercentiles.js), never Baseball Savant directly. See
// docs/data-enrichment.md §3/§5 and .scratch/savant-percentiles/plan.md for
// the full research trail and reasoning.
// Run by hand: node scripts/gen-savant-percentiles.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import { parseCsv } from './lib/savant.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'savant-percentiles.json')
const season = new Date().getFullYear()

// Savant's own player-page percentile widget columns, trimmed to the 5–7
// most scorebook-relevant per role. Mapped to short output keys (war.json's
// convention) to keep the committed file small across ~1,100 rows.
const METRICS = {
  bat: {
    xwoba: 'xwoba',
    exit_velocity: 'ev',
    hard_hit_percent: 'hardHit',
    brl_percent: 'brl',
    chase_percent: 'chase',
    sprint_speed: 'sprintSpeed',
    // Bat-tracking percentiles the percentile-rankings board already reports
    // — free, since fetchPercentiles('batter') is fetched nightly regardless
    // (issue #937). No pitcher analog, so METRICS.pit stays untouched.
    bat_speed: 'batSpeed',
    squared_up_rate: 'squaredUp',
    swing_length: 'swingLength',
  },
  pit: {
    xera: 'xera',
    k_percent: 'k',
    bb_percent: 'bb',
    whiff_percent: 'whiff',
    chase_percent: 'chase',
    fb_velocity: 'fbVelo',
    hard_hit_percent: 'hardHit',
  },
}

// The RAW rate behind each percentile above, for the percentile strip's own
// column (src/components/charts/PercentileStrip.jsx) — ".422" and "21.7%"
// beside the plotted rank, so a row reports a season and not just a ranking.
//
// This is a SECOND leaderboard because the percentile-rankings CSV fetched
// below carries percentiles only: every column in it is already a 0–100 rank,
// with the raw value nowhere in the response. Savant's `custom` board takes an
// arbitrary column selection and is CORS-open on the same host, so it costs one
// more request on a job that already runs nightly.
//
// The selection ids are NOT the percentile board's column names, which is the
// trap here — `chase_percent`, `exit_velocity` and `brl_percent` are all
// accepted by `custom` and all come back silently EMPTY. Every id below was
// verified live to return values (2026-08-03); if one starts blanking, the name
// changed and the sanity check at the bottom of this file is what catches it.
const RAW_METRICS = {
  bat: {
    xwoba: 'xwoba',
    exit_velocity_avg: 'ev',
    hard_hit_percent: 'hardHit',
    barrel_batted_rate: 'brl',
    oz_swing_percent: 'chase',
    sprint_speed: 'sprintSpeed',
  },
  pit: {
    xera: 'xera',
    k_percent: 'k',
    bb_percent: 'bb',
    whiff_percent: 'whiff',
    oz_swing_percent: 'chase',
    fastball_avg_speed: 'fbVelo',
    hard_hit_percent: 'hardHit',
  },
}

async function fetchPercentiles(type) {
  const url =
    `https://baseballsavant.mlb.com/leaderboard/percentile-rankings` +
    `?type=${type}&year=${season}&csv=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Savant percentile-rankings ${type}: HTTP ${res.status}`)
  const text = await res.text()
  const rows = parseCsv(text.replace(/^﻿/, ''))
  if (!rows.length) throw new Error(`Savant percentile-rankings ${type}: empty response`)

  const [header, ...data] = rows
  const colIndex = {}
  header.forEach((name, i) => { colIndex[name] = i })

  const wanted = METRICS[type === 'batter' ? 'bat' : 'pit']
  for (const col of ['player_id', ...Object.keys(wanted)]) {
    if (!(col in colIndex)) {
      throw new Error(
        `Savant percentile-rankings CSV: expected column '${col}' not found — layout may have changed`,
      )
    }
  }

  const map = {}
  for (const r of data) {
    const id = r[colIndex.player_id]
    if (!id) continue
    const entry = {}
    let hasAny = false
    for (const [srcCol, outKey] of Object.entries(wanted)) {
      const raw = r[colIndex[srcCol]]
      const n = raw === '' || raw == null ? null : Number(raw)
      entry[outKey] = Number.isFinite(n) ? n : null
      if (entry[outKey] != null) hasAny = true
    }
    if (hasAny) map[id] = entry
  }
  return map
}

// The raw-rate companion to fetchPercentiles, off the `custom` board. Values
// arrive as plain numbers except xwOBA, which Savant quotes as ".337" — Number()
// handles both, so nothing here special-cases it.
//
// Never fatal: a failure or a renamed selection leaves the raw map empty and the
// radar falls back to plotting shape with no spoke labels, rather than taking
// the whole nightly file down with it.
async function fetchRawRates(type) {
  const wanted = RAW_METRICS[type === 'batter' ? 'bat' : 'pit']
  const selections = Object.keys(wanted).join(',')
  const url =
    `https://baseballsavant.mlb.com/leaderboard/custom` +
    `?year=${season}&type=${type}&filter=&min=1&selections=${selections}` +
    `&chart=false&x=k_percent&y=k_percent&r=no&chartType=beeswarm` +
    `&sort=k_percent&sortDir=desc&csv=true`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = parseCsv((await res.text()).replace(/^﻿/, ''))
    if (rows.length < 2) throw new Error('empty response')

    const [header, ...data] = rows
    const colIndex = {}
    header.forEach((name, i) => { colIndex[name] = i })
    if (!('player_id' in colIndex)) throw new Error("no 'player_id' column")

    const map = {}
    for (const r of data) {
      const id = r[colIndex.player_id]
      if (!id) continue
      const entry = {}
      let hasAny = false
      for (const [srcCol, outKey] of Object.entries(wanted)) {
        const raw = colIndex[srcCol] == null ? '' : r[colIndex[srcCol]]
        const n = raw === '' || raw == null ? null : Number(raw)
        entry[outKey] = Number.isFinite(n) ? n : null
        if (entry[outKey] != null) hasAny = true
      }
      if (hasAny) map[id] = entry
    }
    return map
  } catch (err) {
    console.error(`Savant custom raw rates (${type}): ${err.message} — radar spokes lose their labels`)
    return {}
  }
}

// The raw-rate companion for the three bat-tracking metrics added to
// METRICS.bat above (bat speed, squared-up rate, swing length). The percentile
// board covers their PERCENTILE ranks for free, but not the raw rate the strip
// shows beside every percentile — and this is NOT the `custom` board: adding
// `avg_bat_speed`/`swing_length`/`squared_up_per_swing` as `custom` selections
// was tried first and came back blank for every row, the exact trap
// RAW_METRICS above already warns about. Savant's own dedicated bat-tracking
// leaderboard works instead — but it keys rows on the column **"id"**, NOT
// "player_id" like every other Savant fetch in this file. The value is the
// same MLBAM/statsapi personId this app joins on everywhere; only the column
// name differs. Verified live 2026-08-27 (issue #937). Batter-only: bat
// tracking has no pitcher board.
//
// Never fatal, same as fetchRawRates: a failure or a renamed column leaves
// this map empty and these three rows lose only their raw value — never their
// percentile (already covered by the METRICS.bat fetch above), and never the
// nightly file as a whole.
//
// Scale trap: unlike every `_percent` column on the `custom` board above
// (already percentage points, e.g. 25.3), `squared_up_per_swing` here is a
// 0–1 fraction (verified live: 0.2349) — multiplied by 100 below so it stores
// in the same percentage-point scale RAW_METRICS uses and the strip's `pct1`
// formatter expects.
async function fetchBatTracking() {
  const wanted = {
    avg_bat_speed: 'batSpeed',
    squared_up_per_swing: 'squaredUp',
    swing_length: 'swingLength',
  }
  const SCALE_100 = new Set(['squaredUp'])
  const url =
    `https://baseballsavant.mlb.com/leaderboard/bat-tracking` +
    `?attackZone=&batSide=&contactType=&count=&dateStart=&dateEnd=&gameType=` +
    `&isHardHit=&minSwings=q&minGroupSwings=1&pitchHand=&pitchType=` +
    `&seasonStart=${season}&seasonEnd=${season}&team=&type=batter&csv=true`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = parseCsv((await res.text()).replace(/^﻿/, ''))
    if (rows.length < 2) throw new Error('empty response')

    const [header, ...data] = rows
    const colIndex = {}
    header.forEach((name, i) => { colIndex[name] = i })
    if (!('id' in colIndex)) throw new Error("no 'id' column")

    const map = {}
    for (const r of data) {
      const id = r[colIndex.id]
      if (!id) continue
      const entry = {}
      let hasAny = false
      for (const [srcCol, outKey] of Object.entries(wanted)) {
        const raw = colIndex[srcCol] == null ? '' : r[colIndex[srcCol]]
        let n = raw === '' || raw == null ? null : Number(raw)
        if (Number.isFinite(n) && SCALE_100.has(outKey)) n *= 100
        entry[outKey] = Number.isFinite(n) ? n : null
        if (entry[outKey] != null) hasAny = true
      }
      if (hasAny) map[id] = entry
    }
    return map
  } catch (err) {
    console.error(`Savant bat-tracking: ${err.message} — bat speed/squared-up %/swing length lose their raw value`)
    return {}
  }
}

const [bat, pit, rawBat, rawPit, batTracking] = await Promise.all([
  fetchPercentiles('batter'),
  fetchPercentiles('pitcher'),
  fetchRawRates('batter'),
  fetchRawRates('pitcher'),
  fetchBatTracking(),
])

// Merge the bat-tracking raw rates into rawBat under the same id namespace
// RAW_METRICS.bat already uses, so savantRawFor()/percentileRows() need no
// shape change to pick these three up.
for (const [id, entry] of Object.entries(batTracking)) {
  rawBat[id] = { ...(rawBat[id] ?? {}), ...entry }
}

// A selection id Savant has renamed doesn't error — it comes back as a column
// of blanks (see RAW_METRICS). Report per-metric coverage so a silent blanking
// shows up in the job log the day it happens, rather than as spoke labels
// quietly vanishing from the app.
//
// The bat-tracking keys are checked against batTracking's OWN population, not
// rawBat's merged one: the bat-tracking board's `minSwings=q` filter keeps a
// much smaller, high-volume-swing pool (~200 rows) than the `custom` board's
// (~640), so checking those three keys against rawBat's full id count would
// trip "mostly blank" every night even with nothing broken — that's a real,
// expected population gap, not a renamed column.
const BAT_TRACKING_KEYS = ['batSpeed', 'squaredUp', 'swingLength']
const thinBat = [...new Set(Object.values(RAW_METRICS.bat))].filter((key) => {
  const ids = Object.keys(rawBat)
  return ids.filter((id) => rawBat[id][key] != null).length < ids.length / 2
})
const thinBatTracking = BAT_TRACKING_KEYS.filter((key) => {
  const ids = Object.keys(batTracking)
  return ids.filter((id) => batTracking[id][key] != null).length < ids.length / 2
})
const thinPit = [...new Set(Object.values(RAW_METRICS.pit))].filter((key) => {
  const ids = Object.keys(rawPit)
  return ids.filter((id) => rawPit[id][key] != null).length < ids.length / 2
})
if (thinBat.length || thinBatTracking.length) {
  console.error(
    `WARNING: bat raw rates mostly blank for ${[...thinBat, ...thinBatTracking].join(', ')} — selection id may have changed`,
  )
}
if (thinPit.length) {
  console.error(`WARNING: pit raw rates mostly blank for ${thinPit.join(', ')} — selection id may have changed`)
}

await writeJsonAtomic(out, { season, generatedAt: new Date().toISOString(), bat, pit, rawBat, rawPit })
console.log(
  `wrote ${out} (${Object.keys(bat).length} batters, ${Object.keys(pit).length} pitchers; ` +
  `raw rates for ${Object.keys(rawBat).length}/${Object.keys(rawPit).length})`,
)
