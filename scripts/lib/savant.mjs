// Shared Baseball Savant helpers for the nightly generators.
//
// Savant is CORS-open and undocumented (docs/data-enrichment.md §3). Two
// generators now read its CSV leaderboards — gen-savant-percentiles.mjs (season
// percentile ranks, for the player page's percentile strip) and
// gen-savant-matchup.mjs (the raw rates behind the matchup callouts) — so the
// CSV parser and the one leaderboard both of them hit live here instead of
// being copied into each.
//
// EVERY CALLER MUST FAIL SOFT. These endpoints rename columns without notice,
// and a rename does not error: the column simply comes back empty (see
// gen-savant-percentiles.mjs's RAW_METRICS note). Check coverage, warn loudly
// in the job log, and let the previous night's committed file stand.

// A minimal CSV row parser — handles quoted fields with embedded commas
// (e.g. "Whitlock, Garrett") and doubled-quote escaping. No npm dependency,
// matching the rest of scripts/'s self-contained convention.
export function parseCsv(text) {
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

// Rows -> array of objects keyed by header name, with the BOM and stray header
// whitespace stripped. Savant's first column is literally named
// "last_name, first_name" — quoted, with the comma inside — which is why the
// parser above has to handle quoting at all.
export function csvObjects(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''))
  if (rows.length < 2) return []
  const [header, ...data] = rows
  const names = header.map((n) => n.trim())
  return data.map((r) => {
    const o = {}
    names.forEach((n, i) => { o[n] = r[i] })
    return o
  })
}

// '' / null / non-numeric -> null, so a blanked column reads as absent rather
// than as 0. Every rate in this app degrades to "no note" on null.
export function num(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Savant's `custom` leaderboard, which takes an arbitrary column selection and
// serves BOTH roles off one URL shape. `type` is 'batter' | 'pitcher'.
//
// THE TRAP: the selection ids are not the percentile board's column names, and
// an id Savant has renamed does not error — it returns a column of blanks.
// `oz_swing_percent` is the chase rate here; `iz_swing_percent` and `obp` are
// both accepted and both come back EMPTY (verified 2026-08-20). Verify any new
// id against a live response before adding it.
export async function fetchCustomBoard(type, { season, selections, min = 25, attempts = 4 }) {
  const url =
    `https://baseballsavant.mlb.com/leaderboard/custom` +
    `?year=${season}&type=${type}&filter=&min=${min}` +
    `&selections=${selections.join(',')}` +
    `&chart=false&x=k_percent&y=k_percent&r=no&chartType=beeswarm` +
    `&sort=k_percent&sortDir=desc&csv=true`
  return withRetry(`Savant custom ${type}`, attempts, async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = csvObjects(await res.text())
    if (!rows.length) throw new Error('empty response')
    return rows
  })
}

// Savant's `pitch-arsenal-stats` leaderboard — a direct per-pitch-type join,
// one row per (player_id, pitch_type), identical columns for both roles. Feeds
// gen-savant-matchup.mjs's Family C (a hitter against one specific pitch).
// `min` is Savant's own PA/pitches floor on the response; the generator
// re-applies its own, stricter, per-role floors on top of what comes back.
export async function fetchArsenalBoard(type, { season, min = 10, attempts = 4 }) {
  const url =
    `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats` +
    `?type=${type}&pitchType=&year=${season}&team=&min=${min}&csv=true`
  return withRetry(`Savant arsenal ${type}`, attempts, async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = csvObjects(await res.text())
    if (!rows.length) throw new Error('empty response')
    return rows
  })
}

// Savant refuses a cold connection often enough that a single-shot nightly job
// fails on it — observed repeatedly on 2026-08-20 as a 10s connect timeout that
// succeeded on the immediate retry. Linear backoff, and the LAST failure is
// rethrown so the job still dies loudly rather than committing a thin file.
export async function withRetry(label, attempts, fn) {
  let last
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i < attempts - 1) {
        console.error(`${label}: ${err.message} — retry ${i + 1}/${attempts - 1}`)
        await new Promise((r) => setTimeout(r, 2500 * (i + 1)))
      }
    }
  }
  throw new Error(`${label}: ${last?.message ?? 'failed'} after ${attempts} attempts`)
}

// Mean and population SD of one numeric column, over the rows that have it.
// Returns null when the column is too thin to z-score against — the caller
// then simply builds no note on that axis, rather than dividing by a
// meaningless spread.
export function meanSd(rows, key, minRows = 50) {
  const v = rows.map((r) => num(r[key])).filter((x) => x != null)
  if (v.length < minRows) return null
  const m = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)
  return sd > 0 ? { m: round1(m), sd: round1(sd), n: v.length } : null
}

// meanSd, GROUPED by another column — the arsenal board's per-pitch-type
// league baseline, one meanSd() per group. A lower default minRows than
// meanSd's own 50: split-finger has only ~79 qualified pitchers leaguewide, and
// a per-type baseline has to exist for the thin pitch types or their notes can
// never build — the exact "all fastball" trap gen-savant-matchup.mjs's own
// tuning constants exist to avoid.
export function meanSdGrouped(rows, groupKey, valueKey, minRows = 15) {
  const byGroup = new Map()
  for (const r of rows) {
    const g = r[groupKey]
    if (!g) continue
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g).push(r)
  }
  const out = {}
  for (const [g, groupRows] of byGroup) {
    const stat = meanSd(groupRows, valueKey, minRows)
    if (stat) out[g] = stat
  }
  return out
}

// One decimal is the storage precision. DISPLAY rounds to whole percentages
// (src/api/matchup/notes.js) — a tenth of a point on a chase rate is a
// database talking, not a game note — but the z-score wants the tenth.
export const round1 = (n) => Math.round(n * 10) / 10

// Median of an array of numbers — the value at the middle of the sorted list,
// averaging the two middle values when the count is even. Used instead of a
// mean for the pctstrip's league-baseline figure (gen-savant-percentiles.mjs):
// a percentile rank puts the median observation at 50 BY CONSTRUCTION, so the
// median is the one summary that agrees with the strip's already-drawn
// 50th-percentile reference line. A mean over a bulk leaderboard would not —
// and getting a mean right per metric would need reinventing a different
// weighting denominator for each one (PA for xwOBA, batted-ball events for
// EV, swings for bat speed, ...), which the median sidesteps entirely.
export function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  // round1 on BOTH branches — an odd-length list's middle value comes straight
  // off a raw Savant column (e.g. 72.13707063) and needs the same one-decimal
  // storage precision the even-length average already gets, or the file would
  // carry two different precisions depending on a population's parity alone.
  return round1(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
}

// The per-metric median of `rawMap`'s values, over the INTERSECTION of
// `pctMap` and `rawMap` — only ids that have a non-null value in BOTH maps
// for that key. That intersection is, by definition, the population whose
// 50th percentile the strip's reference line already draws: computing the
// median over a wider or narrower population would draw a line and print a
// number that disagree. A metric whose intersection is thinner than `floor`
// is left out of the result entirely rather than printing a baseline off a
// handful of players.
export function medianRates(pctMap, rawMap, keys, floor) {
  const out = {}
  for (const key of keys) {
    const values = Object.keys(pctMap)
      .filter((id) => pctMap[id][key] != null && rawMap[id]?.[key] != null)
      .map((id) => rawMap[id][key])
    if (values.length >= floor) out[key] = median(values)
  }
  return out
}
