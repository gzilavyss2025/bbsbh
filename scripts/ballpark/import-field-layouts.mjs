#!/usr/bin/env node
// Import every MLB park's measured dimensions and current fence outline into
// src/lib/ballpark/layout/fields.js (#1859). HAND-RUN, once a season or after
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
// MINOR-LEAGUE PARKS (#1859, slice 3) get a second, weaker pass. No Savant row
// exists for them, so the targets are the posted signs from the Stats API
// venue endpoint, and most of their Gameday SVGs are the older unnamed-layer
// art (legacyFenceFromSvg). An outline is stored only when LF, CF and RF each
// agree with the posted sign within 10 ft, and the registry labels it an
// estimate. A park with no passing outline keeps its five posted distances, so
// the app can still draw the straight five-point wall. The venue list is the
// MiLB clubs' home parks in public/data/teams.json (gen-teams.mjs).
//
// The output stores numbers derived from MLB's drawings and tables, never the
// drawings themselves.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'
import {
  fenceFromSvg, auditOutline, legacyFenceFromSvg, auditPosted, checkLayers,
  SCALE_FT_PER_UNIT, LEGACY_SCALE_FT_PER_UNIT, TOLERANCE, POSTED_TOLERANCE_FT,
} from '../lib/ballpark/field-svg.mjs'
import { getJson, statsapiUrl } from '../lib/statsapi.mjs'
import { ballparkFor } from '../../src/lib/ballpark/ballparkData.js'
import { CONFIGURATIONS } from '../../src/lib/ballpark/layout/configurations.js'
import { fetchSeasonInPlay } from '../lib/time/season-in-play.mjs'

const OUT = fileURLToPath(new URL('../../src/lib/ballpark/layout/fields.js', import.meta.url))
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
  let layers = {}
  try {
    const out = fenceFromSvg(await text(GAMEDAY(r.venue_id)), { poles: measured.dist })
    if (!out) note = 'Gameday SVG has no Outfield/foul-line layers'
    else {
      if (out.fittedScale) fitted.push(out.fittedScale)
      audit = auditOutline(out.points, out.areaSqFt, measured)
      if (audit.pass) {
        fence = out.points
        // The softer layers ride only on an audited fence, and only when
        // plausible (slice 5): the playing surface and the track's inner edge.
        const ok = checkLayers(out.points, measured.areaSqFt, out)
        layers = { ...(ok.surface ? { surface: out.surface } : {}), ...(ok.track ? { trackInner: out.trackInner } : {}) }
        if (!ok.surface || !ok.track) console.log(`  ${r.venue_id}: stylized ${[!ok.surface && 'foul ground', !ok.track && 'track'].filter(Boolean).join(' and ')} (failed the plausibility check)`)
      }
    }
  } catch (err) {
    note = `Gameday SVG not fetched: ${err.message}`
  }
  venues[r.venue_id] = {
    club: r.name_display_club ?? null,
    configChanged: Boolean(r.is_diff_configuration),
    measured,
    fence,
    ...layers,
    audit: audit && { ...audit.errors, pass: audit.pass },
    ...(note ? { note } : {}),
  }
  const tag = fence ? 'audited' : audit ? 'FAILED audit' : note
  console.log(String(r.venue_id).padEnd(5), String(r.name_display_club ?? '').padEnd(10), tag, audit ? JSON.stringify(audit.errors) : '')
}

fitted.sort((a, b) => a - b)
console.log(`median per-park pole scale ${fitted[fitted.length >> 1]?.toFixed(3)} ft/unit (stored outlines use ${SCALE_FT_PER_UNIT})`)

// ── Park names, this season and next ────────────────────────────────────────
// Sponsors rename parks, mostly over the winter, and the Stats API lists the
// new name under next season's clubs as soon as it is known. Every drawing
// resolves by venue id, so a rename never loses the wall. But a caller with
// only a name (and the facts table's aliases) needs the new name, so this
// logs every MLB park name that does not resolve, and every MLB venue with no
// layout record (a new park). Add the alias in ballparkData.js, or the record
// in layout/configurations.js, before Opening Day.
const namesBySeason = {}
for (const season of [year, year + 1]) {
  const data = await getJson(`/api/v1/teams?sportIds=1,11,12,13,14&season=${season}&hydrate=venue`)
  namesBySeason[season] = data?.teams ?? []
  for (const t of namesBySeason[season].filter((x) => x.sport?.id === 1 && x.venue)) {
    if (!ballparkFor(t.venue.name)) console.warn(`RENAME? ${season} ${t.abbreviation} venue ${t.venue.id} "${t.venue.name}" has no alias in ballparkData.js`)
    if (!CONFIGURATIONS.some((c) => c.venueId === t.venue.id)) console.warn(`NEW PARK? ${season} ${t.abbreviation} venue ${t.venue.id} "${t.venue.name}" has no layout record`)
  }
}
// Every name a minor-league venue carries in either season, so the
// resolver's name fallback knows a rename the day it ships.
const milbNames = new Map()
for (const season of [year, year + 1]) {
  for (const t of namesBySeason[season].filter((x) => x.sport?.id !== 1 && x.venue?.name)) {
    const list = milbNames.get(t.venue.id) ?? []
    if (!list.includes(t.venue.name)) list.push(t.venue.name)
    milbNames.set(t.venue.id, list)
  }
}

// ── Minor-league parks ──────────────────────────────────────────────────────
const TEAMS = fileURLToPath(new URL('../../public/data/teams.json', import.meta.url))
const MILB_SPORTS = ['11', '12', '13', '14']
const milbVenues = new Map()
for (const sportId of MILB_SPORTS) {
  for (const t of JSON.parse(readFileSync(TEAMS, 'utf8')).bySportId[sportId] ?? []) {
    if (t.venueId && !milbVenues.has(t.venueId)) milbVenues.set(t.venueId, Number(sportId))
  }
}
const ids = [...milbVenues.keys()]
const fieldInfo = new Map()
for (let i = 0; i < ids.length; i += 50) {
  const data = await getJson(`/api/v1/venues?venueIds=${ids.slice(i, i + 50).join(',')}&hydrate=fieldInfo`)
  for (const v of data?.venues ?? []) fieldInfo.set(v.id, v)
}
const milb = {}
const legacyFitted = []
for (const [id, sportId] of milbVenues) {
  if (venues[id]) continue // an MLB-measured park (Sutter Health) keeps its Savant row
  const v = fieldInfo.get(id)
  const fi = v?.fieldInfo ?? {}
  const posted = { lf: fi.leftLine ?? null, lc: fi.leftCenter ?? null, cf: fi.center ?? null, rc: fi.rightCenter ?? null, rf: fi.rightLine ?? null }
  let fence = null
  let audit = null
  let style = null
  try {
    const svg = await text(GAMEDAY(id))
    const named = fenceFromSvg(svg)
    const out = named ?? legacyFenceFromSvg(svg)
    style = out ? (named ? 'named' : 'legacy') : null
    if (out) {
      audit = auditPosted(out.points, posted)
      if (audit.pass) fence = out.points
      if (!named && posted.cf) {
        // The scale that would put this drawing's CF on its posted sign, for
        // the log's check on LEGACY_SCALE_FT_PER_UNIT.
        const cfFt = posted.cf - audit.errors.cf
        if (cfFt > 0) legacyFitted.push((LEGACY_SCALE_FT_PER_UNIT * posted.cf) / cfFt)
      }
    }
  } catch {
    // No Gameday SVG for this park (a 403): posted distances only.
  }
  const five = Object.values(posted).every(Number.isFinite)
  // Left line, center and right line are enough: the app draws a smooth wall
  // through them (`threePointWall`, #2612). Anything less is "not on file".
  const three = [posted.lf, posted.cf, posted.rf].every(Number.isFinite)
  if (!fence && !five && !three) continue
  const names = [...new Set([v?.name, ...(milbNames.get(id) ?? [])].filter(Boolean))]
  if (names.length > 1) console.log(`  renamed: ${names.join(' -> ')}`)
  milb[id] = {
    name: v?.name ?? null,
    ...(names.length > 1 ? { names } : {}),
    sportId,
    posted,
    fence,
    ...(fence ? { style } : {}),
    audit: audit && { ...audit.errors, pass: audit.pass },
  }
  console.log(String(id).padEnd(5), String(v?.name ?? '').slice(0, 28).padEnd(28), fence ? `estimated (${style})` : 'posted distances only', audit ? JSON.stringify(audit.errors) : '')
}
legacyFitted.sort((a, b) => a - b)
console.log(`MiLB: ${Object.keys(milb).length} of ${milbVenues.size} venues drawable, ${Object.values(milb).filter((m) => m.fence).length} with an outline; median legacy CF scale ${legacyFitted[legacyFitted.length >> 1]?.toFixed(3)} (stored outlines use ${LEGACY_SCALE_FT_PER_UNIT})`)

const out = {
  season: year,
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: { measured: SAVANT(year), fence: GAMEDAY('{venueId}') },
  scaleFtPerUnit: SCALE_FT_PER_UNIT,
  tolerance: TOLERANCE,
  venues,
  milb: {
    sources: { posted: statsapiUrl('/api/v1/venues?venueIds={venueId}&hydrate=fieldInfo'), fence: GAMEDAY('{venueId}') },
    legacyScaleFtPerUnit: LEGACY_SCALE_FT_PER_UNIT,
    toleranceFt: POSTED_TOLERANCE_FT,
    venues: milb,
  },
}
writeFileSync(OUT, 'export default ' + JSON.stringify(out, null, 0).replace(/("\d+":\{)/g, '\n$1') + '\n')
console.log(`wrote ${OUT}`)
