// The pure half of gen-ovr.mjs (OVR step 6, #1720; docs/ovr-rating.md): season
// inputs for every MLB player in, one rating per player who passes the minimum-data
// rule out. A generator file is a top-level script, so the part worth testing lives
// here. `loadInputs` reads files and `buildRatings` is pure: no network, no clock.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { blendCareer } from '../../../src/api/ovr/career.js'
import { unpackRow } from '../../../src/api/milbSeasons.js'
import { ESTABLISHED_SEASONS, careerOvr } from '../../../src/api/ovr/minor.js'
import { potRating } from '../../../src/api/ovr/pot.js'
import { CONSTANTS, rateHitter, ratePitcher } from '../../../src/api/ovr/rating.js'

// Plate appearances a hitter needs IN A SEASON to be ranked for Fielding. Gary left
// the choice to this step. `fld` is a counting stat: a part-timer's near-zero value
// means few chances, not an average glove, and the file has no innings. Research on
// issue #1720: PA tracks innings (r = 0.91); of 0, 100, 200 and 300 PA, 200 PA gave
// the best 2025-to-2026 repeatability (Pearson 0.43, Spearman 0.38, 361 of 751
// hitters kept) and 300 only tied it on Pearson. There is no ground truth for glove
// quality, so that measures repeatability only. The rank is per season and the seasons
// are then blended, so the pooled floor of about 600 PA from that research is not used.
export const FLD_MIN_PA = 200

const USED_METRICS = new Set(
  [CONSTANTS.hitter, CONSTANTS.pitcher].flatMap((g) => Object.values(g.buckets).flat()),
)

// Percentile 0-100 of each value among the values in the map. A tie takes the middle
// of its run: fld is rounded to 0.1 and many hitters sit on 0.0, so counting only the
// strictly lower values would put every one of them at the bottom of the tie.
export function percentileAmong(values) {
  const xs = Object.values(values)
  return Object.fromEntries(
    Object.entries(values).map(([id, x]) => {
      const below = xs.filter((v) => v < x).length
      const tied = xs.filter((v) => v === x).length
      return [id, (100 * (below + tied / 2)) / xs.length]
    }),
  )
}

// bat / pit: { [id]: { [season]: { [metric]: percentile | null } } }
// fld, pa:   { [id]: { [season]: number } }       birthYear: { [id]: year }
// minors:    { [id]: [{ season, sport, group, n, pct }] }  minor-league rows, current season included
// top:       { [id]: { rank, age } }                  the Top 100 list (POT)
// -> { bat: { [id]: { ovr, bars, seasons, pot? } | { ovr, seasons, level, pot? } }, pit, strings, clamped }
// A minor leaguer (no MLB rating, a row this season) has `level` and no bars. `pot` is
// only for a rated player on the list.
export function buildRatings({ bat, pit, fld, pa, birthYear, season, minors = {}, top = {} }) {
  const tally = { strings: 0, clamped: 0 }
  // A number, or null. A numeric string is converted and counted: rate() skips
  // anything that is not a finite number without a word, so a "72" would vanish.
  // Number(null) and Number('') are 0, so they are tested out first.
  const toNum = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
      tally.strings++
      return Number(v)
    }
    return null
  }
  // A season with no usable cell is dropped, so it takes no recency weight slot.
  const cleanSeasons = (raw) => {
    const out = {}
    for (const [year, cells] of Object.entries(raw)) {
      const kept = Object.fromEntries(
        Object.entries(cells).map(([m, v]) => [m, toNum(v)]).filter(([, v]) => v != null),
      )
      if (Object.keys(kept).length) out[year] = kept
    }
    return out
  }

  // Fielding: per season, rank fld among the hitters over the floor.
  const fldSeasons = {} // id -> { [season]: { fld: percentile } }
  for (const year of new Set(Object.values(fld).flatMap(Object.keys))) {
    const pool = {}
    for (const [id, byYear] of Object.entries(fld)) {
      const runs = toNum(byYear[year])
      const plate = toNum(pa[id]?.[year])
      if (runs != null && plate != null && plate >= FLD_MIN_PA) pool[id] = runs
    }
    for (const [id, p] of Object.entries(percentileAmong(pool))) (fldSeasons[id] ??= {})[year] = { fld: p }
  }

  const rateGroup = (group, rate, withFielding, rowGroup) => {
    const minorRows = (id) => (minors[id] ?? []).filter((r) => r.group === rowGroup && r.pct != null)
    const out = {}
    for (const [id, raw] of Object.entries(group)) {
      const seasons = cleanSeasons(raw)
      const fseasons = withFielding ? (fldSeasons[id] ?? {}) : {}
      // Fielding is blended on its own seasons: a year with no Savant row must not
      // take a recency slot from the Savant metrics, nor the other way round.
      const pcts = { ...blendCareer(seasons, birthYear[id]), ...blendCareer(fseasons) }
      tally.clamped += Object.entries(pcts).filter(([m, p]) => USED_METRICS.has(m) && (p <= 0 || p >= 100)).length
      const rated = rate(pcts)
      if (!rated) continue // the minimum-data rule
      const years = new Set([...Object.keys(seasons), ...Object.keys(fseasons)])
      const mlbYears = [...years].map(Number).sort((a, b) => b - a)
      const rows = mlbYears.length >= ESTABLISHED_SEASONS ? [] : minorRows(id)
      const all = [...new Set([...mlbYears, ...rows.map((r) => r.season)])].sort((a, b) => b - a)
      out[id] = { ovr: careerOvr({ ovr: rated.ovr, years: mlbYears }, rows), bars: rated.bars, seasons: all }
    }
    // A minor leaguer: no MLB rating, but a minor-league row this season.
    for (const id of Object.keys(minors)) {
      const rows = minorRows(id)
      const now = rows.find((r) => r.season === season)
      if (out[id] || !now) continue
      out[id] = { ovr: careerOvr(null, rows), seasons: [...new Set(rows.map((r) => r.season))].sort((a, b) => b - a), level: now.sport }
    }
    for (const [id, t] of Object.entries(top)) if (out[id]) out[id].pot = potRating(out[id].ovr, t.rank, t.age)
    return out
  }
  return { bat: rateGroup(bat, rateHitter, true, 'hitting'), pit: rateGroup(pit, ratePitcher, false, 'pitching'), ...tally }
}

// Reads the committed files and shapes them for buildRatings. The current season is
// savant-percentiles.json and war.json; the prior ones are savant-history/ and
// war-history/. war.json has no plate appearances, so the current season's PA is the
// sum of `paEnd` in the nightly hitter-grid shard (one pitch that ends a plate
// appearance each). No network call.
export function loadInputs(dataDir) {
  const read = (path) => JSON.parse(readFileSync(join(dataDir, path), 'utf8'))
  const shards = (dir) => readdirSync(join(dataDir, dir)).filter((f) => /^\d\d\.json$/.test(f)).map((f) => read(`${dir}/${f}`))
  const sav = read('savant-percentiles.json')
  const war = read('war.json')
  if (sav.season !== war.season) throw new Error(`savant-percentiles is ${sav.season}, war.json is ${war.season}`)
  const season = sav.season
  const bat = {}
  const pit = {}
  const fld = {}
  const pa = {}
  for (const s of shards('savant-history')) {
    Object.assign(bat, s.bat)
    Object.assign(pit, s.pit)
  }
  for (const s of shards('war-history')) {
    Object.assign(fld, s.fld)
    Object.assign(pa, s.pa)
  }
  const addCurrent = (into, map) => {
    for (const [id, v] of Object.entries(map)) (into[id] ??= {})[season] = v
  }
  addCurrent(bat, sav.bat)
  addCurrent(pit, sav.pit)
  addCurrent(fld, war.fld)
  for (const s of shards(`hitter-grid/${season}`)) {
    const paEnd = (o) => (o.paEnd ? o.paEnd.reduce((t, v) => t + v, 0) : Object.values(o).reduce((t, v) => t + paEnd(v), 0))
    for (const [id, e] of Object.entries(s.bat ?? {})) (pa[id] ??= {})[season] = paEnd(e.mlb ?? {})
  }
  // Birth years: the on-this-day files list every player with a Retrosheet birth date.
  const birthYear = {}
  for (const f of readdirSync(join(dataDir, 'on-this-day'))) for (const e of read(`on-this-day/${f}`).born ?? []) birthYear[e.personId] = e.year
  // Minor-league rows: the finished seasons from milb-seasons/ (packed), and this season
  // from prospect-trend.json (a primary-level percentile; sampleSize is PA or outs).
  const minors = {}
  for (const s of shards('milb-seasons')) {
    for (const [id, rows] of Object.entries(s.players)) minors[id] = rows.map(unpackRow)
  }
  for (const p of read('prospect-trend.json').players) {
    if (p.percentile == null) continue
    ;(minors[p.playerId] ??= []).push({ season, sport: p.sportId, group: p.group, n: p.sampleSize, pct: p.percentile })
  }
  const top = {}
  for (const p of read('top-prospects.json').players) top[p.playerId] = { rank: p.rank, age: p.age }
  return { bat, pit, fld, pa, birthYear, season, minors, top }
}
