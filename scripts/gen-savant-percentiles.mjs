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
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// The RAW rate behind each percentile above, for the radar's spoke labels
// (src/components/playercard/StatRadar.jsx) — ".422" and "21.7%" beside the
// shape, so the polygon reports a season and not just a ranking.
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

// A minimal CSV row parser — handles quoted fields with embedded commas
// (e.g. "Whitlock, Garrett") and doubled-quote escaping. No npm dependency,
// matching the rest of scripts/'s self-contained gen-*.mjs convention.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
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

const [bat, pit, rawBat, rawPit] = await Promise.all([
  fetchPercentiles('batter'),
  fetchPercentiles('pitcher'),
  fetchRawRates('batter'),
  fetchRawRates('pitcher'),
])

// A selection id Savant has renamed doesn't error — it comes back as a column
// of blanks (see RAW_METRICS). Report per-metric coverage so a silent blanking
// shows up in the job log the day it happens, rather than as spoke labels
// quietly vanishing from the app.
for (const [group, raw, wanted] of [['bat', rawBat, RAW_METRICS.bat], ['pit', rawPit, RAW_METRICS.pit]]) {
  const ids = Object.keys(raw)
  const thin = [...new Set(Object.values(wanted))]
    .filter((key) => ids.filter((id) => raw[id][key] != null).length < ids.length / 2)
  if (thin.length) {
    console.error(`WARNING: ${group} raw rates mostly blank for ${thin.join(', ')} — selection id may have changed`)
  }
}

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ season, generatedAt: new Date().toISOString(), bat, pit, rawBat, rawPit }),
)
console.log(
  `wrote ${out} (${Object.keys(bat).length} batters, ${Object.keys(pit).length} pitchers; ` +
  `raw rates for ${Object.keys(rawBat).length}/${Object.keys(rawPit).length})`,
)
