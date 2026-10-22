// The league-wide "Standing out" report (#2453): every MLB player's callouts, from
// `public/data/outliers/{season}.json` (scripts/gen-outliers.mjs, nightly). Answers "who
// was flagged as of a cutoff", for the /outliers page and its date slider.
//
// On an open surface (ADR-0034). A file entry is dated by its game, and holds
// the callouts AFTER that game. A cutoff `D` takes a player's latest entry dated BEFORE
// `D`, the same rule as rule.js: no game on or after the cutoff counts. The caller keeps
// the cutoff at or before today, so a game in progress is never in a list.
//
// An entry is [date, flags] or [date, 0], the closing marker that ends a run (the
// generator's lib/outliers/walk.mjs). A flag is packed as [key, tone, value, percentile,
// sample, weight letter]; packFlag and the reader's unpack are the two halves of it.
import { staticJsonBy } from '../staticJson.js'

const WEIGHT = { e: 'early', f: 'firm', r: 'real' }
const WEIGHT_CODE = { early: 'e', firm: 'f', real: 'r' }
const ROLE = { h: 'hitting', p: 'pitching' }

// One rule flag -> its packed form. Only what a collapsed row prints.
export const packFlag = (f) => [
  f.key,
  f.tone === 'hot' ? 1 : 0,
  // A home-run pace prints as 1/N, so it keeps six digits and reads as the open row's does.
  Number(f.key === 'hr' ? f.value.toPrecision(6) : f.value.toFixed(4)),
  Math.round(f.percentile * 10) / 10,
  f.sample,
  WEIGHT_CODE[f.weight],
]

// The season's file, or null (no file yet in the offseason, or a failed read).
export const loadOutliersFile = staticJsonBy((year) => `/data/outliers/${year}.json`, { fallback: null })

// The ISO date after `d`.
export const nextDay = (d) => new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)

// The slider's span, as cutoff dates: the first game date (nothing counted yet) to the day
// after the last game date. `today` caps it, so tonight's games never count.
export function cutoffSpan(file, today) {
  const last = nextDay(file.last)
  return { min: file.first, max: last < today ? last : today }
}

const extremity = (percentile) => Math.min(percentile, 100 - percentile)

// { id, name, role, key, tone: 'hot'|'cold', value, percentile, sample, weight } for every
// player flagged as of `cutoff`, most unusual first.
export function flagsAsOf(file, cutoff) {
  const out = []
  for (const p of file?.players ?? []) {
    let latest = null
    for (const e of p.f) {
      if (e[0] >= cutoff) break
      latest = e
    }
    if (!latest || latest[1] === 0) continue
    for (const [key, tone, value, percentile, sample, weight] of latest[1]) {
      out.push({
        id: p.i, name: p.n, role: ROLE[p.r], key, tone: tone ? 'hot' : 'cold',
        value, percentile, sample, weight: WEIGHT[weight],
      })
    }
  }
  return out.sort((a, b) => extremity(a.percentile) - extremity(b.percentile) || a.id - b.id)
}

// The flags grouped by role, then by callout type (role, key, tone), the group with the most
// unusual flag first. Flags keep flagsAsOf's order inside a group.
// -> { hitting: [{ id, role, key, tone, flags }], pitching: [...] }
export function groupFlags(flags) {
  const groups = new Map()
  for (const f of flags) {
    const id = `${f.role}:${f.key}:${f.tone}`
    if (!groups.has(id)) groups.set(id, { id, role: f.role, key: f.key, tone: f.tone, flags: [] })
    groups.get(id).flags.push(f)
  }
  const by = { hitting: [], pitching: [] }
  for (const g of groups.values()) by[g.role].push(g)
  return by
}
