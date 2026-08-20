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

// One decimal is the storage precision. DISPLAY rounds to whole percentages
// (src/api/matchup/notes.js) — a tenth of a point on a chase rate is a
// database talking, not a game note — but the z-score wants the tenth.
export const round1 = (n) => Math.round(n * 10) / 10
