#!/usr/bin/env node
// Import every MLB park's measured dimensions and current fence outline into
// src/lib/ballpark/layout/fields.json (#1859). HAND-RUN, once a season or after
// a club announces a wall change: `npm run gen:field-layouts` (optionally
// `-- --year 2027`). Its output is reviewed in the PR diff like any data change.
//
// Two sources, both public MLB hosts the app already reads elsewhere:
//   - Baseball Savant's Dimensions table
//     (baseballsavant.mlb.com/leaderboard/statcast-park-factors?type=dimensions&year=Y)
//     — measured distances and wall heights at five bearings, the deepest point,
//     and the fair-territory area, one row per venue id. The page embeds its rows
//     as `var data = [...]`; that is an undocumented page detail, so a missing or
//     reshaped array stops the import rather than writing a partial file.
//   - Gameday's field SVG per venue id (see lib/ballpark/field-svg.mjs) — the
//     fence outline.
//
// An outline is stored only when it passes auditOutline against the same
// season's Savant row. A failing one usually shows an older wall (Comerica's
// SVG still has the pre-2023 center field), and drawing it would be the exact
// bug this registry exists to stop. The audit numbers are stored either way, so
// the coverage report (docs/ballpark-layouts.md) can show why.
//
// The output stores numbers derived from MLB's drawings and tables, never the
// drawings themselves.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { fenceFromSvg, auditOutline, SCALE_FT_PER_UNIT, TOLERANCE } from '../lib/ballpark/field-svg.mjs'
import { fetchSeasonInPlay } from '../lib/time/season-in-play.mjs'

const OUT = fileURLToPath(new URL('../../src/lib/ballpark/layout/fields.json', import.meta.url))
const SAVANT = (y) => `https://baseballsavant.mlb.com/leaderboard/statcast-park-factors?type=dimensions&year=${y}`
const GAMEDAY = (id) => `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.2.0/images/fields/${id}.svg`

const { values } = parseArgs({ options: { year: { type: 'string' } } })
// The season in play, not the calendar year: in January Savant has no rows for
// the new year yet (scripts/CLAUDE.md, #1465).
const year = values.year ? Number(values.year) : await fetchSeasonInPlay()

async function text(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

function savantRows(html) {
  const line = html.split('\n').find((l) => l.trim().startsWith('var data = ['))
  if (!line) throw new Error('Savant page has no `var data = [` line; the page changed. Nothing written.')
  const rows = JSON.parse(line.trim().replace(/^var data = /, '').replace(/;$/, ''))
  const need = ['venue_id', 'distance_cf', 'distance_lf_line', 'height_cf', 'fence_area', 'distance_deepest']
  const bad = rows.filter((r) => need.some((k) => r[k] == null))
  if (!rows.length || bad.length) throw new Error(`Savant rows missing fields (${bad.length}/${rows.length}). Nothing written.`)
  return rows
}

const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10)

const rows = savantRows(await text(SAVANT(year)))
const venues = {}
const fitted = []
for (const r of rows) {
  const measured = {
    dist: { lf: r1(r.distance_lf_line), lc: r1(r.distance_lf_gap), cf: r1(r.distance_cf), rc: r1(r.distance_rf_gap), rf: r1(r.distance_rf_line) },
    height: { lf: r1(r.height_lf_line), lc: r1(r.height_lf_gap), cf: r1(r.height_cf), rc: r1(r.height_rf_gap), rf: r1(r.height_rf_line) },
    deepest: r1(r.distance_deepest),
    areaSqFt: Math.round(r.fence_area),
  }
  let fence = null
  let audit = null
  let note = null
  try {
    const out = fenceFromSvg(await text(GAMEDAY(r.venue_id)), { poles: measured.dist })
    if (!out) note = 'Gameday SVG has no Outfield/foul-line layers'
    else {
      if (out.fittedScale) fitted.push(out.fittedScale)
      audit = auditOutline(out.points, out.areaSqFt, measured)
      if (audit.pass) fence = out.points
    }
  } catch (err) {
    note = `Gameday SVG not fetched: ${err.message}`
  }
  venues[r.venue_id] = {
    club: r.name_display_club ?? null,
    configChanged: Boolean(r.is_diff_configuration),
    measured,
    fence,
    audit: audit && { ...audit.errors, pass: audit.pass },
    ...(note ? { note } : {}),
  }
  const tag = fence ? 'audited' : audit ? 'FAILED audit' : note
  console.log(String(r.venue_id).padEnd(5), String(r.name_display_club ?? '').padEnd(10), tag, audit ? JSON.stringify(audit.errors) : '')
}

fitted.sort((a, b) => a - b)
console.log(`median per-park pole scale ${fitted[fitted.length >> 1]?.toFixed(3)} ft/unit (stored outlines use ${SCALE_FT_PER_UNIT})`)

const out = {
  season: year,
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: { measured: SAVANT(year), fence: GAMEDAY('{venueId}') },
  scaleFtPerUnit: SCALE_FT_PER_UNIT,
  tolerance: TOLERANCE,
  venues,
}
writeFileSync(OUT, JSON.stringify(out, null, 0).replace(/("\d+":\{)/g, '\n$1') + '\n')
console.log(`wrote ${OUT}`)
