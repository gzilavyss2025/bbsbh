// Pitcher Workload — read from a static same-origin file (public/data/workload.json)
// rather than fetched live. That file is regenerated nightly by
// scripts/gen-workload.mjs (see .github/workflows/update-nightly-data.yml) — this
// module just reads it and does the per-pitcher, as-of-date math.
//
// Spoiler class: spoiler-FREE. Everything here is backward-looking over COMPLETED
// appearances (pitch counts, appearance dates, season totals) — the same footing
// as war.js. `asOfDate` only ever EXCLUDES the current day's appearance (strictly
// before), so no in-progress game's line can leak; callers need no SealBox.
//
// MiLB pitchers are absent from the file at the source (MLB only), so every
// lookup returns null for an unknown personId and callers hide the surface
// (graceful-degradation convention). Cached in-memory for the session — the file
// changes once a day.
//
// The W1 rolling buckets (workloadFor), the W5 ESPN-threshold availability board
// (availabilityFor), and the W4 own-norm/role percentages (workloadVsBaseline)
// from .scratch/metric-engines/pitch-workload.md live here.
let cached = null

export async function fetchWorkload() {
  if (cached) return cached
  try {
    const res = await fetch('/data/workload.json')
    if (!res.ok) throw new Error(`workload.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = null
  }
  return cached
}

// Whole-day index for a 'YYYY-MM-DD' date (UTC midnight / 86400s), so day
// differences and "strictly before" comparisons are plain integer math.
const dayIndex = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 86400000)

// The pitcher record, with apps guaranteed most-recent-first and restricted to
// appearances STRICTLY BEFORE asOfDate. Returns null for an unknown pitcher.
function priorApps(data, personId, asOfDate) {
  const p = data?.pitchers?.[String(personId)]
  if (!p) return null
  const asOfIdx = dayIndex(asOfDate)
  const apps = (p.apps ?? [])
    .map((a) => ({ ...a, idx: dayIndex(a.d) }))
    .filter((a) => Number.isFinite(a.idx) && a.idx < asOfIdx)
    .sort((a, b) => b.idx - a.idx) // most-recent-first (defensive)
  return { p, apps, asOfIdx }
}

// A rolling bucket over the most-recent `n` appearances: total pitches, the
// count of appearances, and the calendar span in days from the OLDEST appearance
// in the bucket to asOfDate−1 (the "…over N appearances, in D days" framing).
function bucket(apps, n, asOfIdx) {
  const slice = apps.slice(0, n)
  const pitches = slice.reduce((a, x) => a + (x.p ?? 0), 0)
  const oldest = slice.length ? slice[slice.length - 1].idx : null
  const days = oldest == null ? null : asOfIdx - 1 - oldest
  return { pitches, days, apps: slice.length }
}

// The rolling 1/3/10-appearance load picture for a pitcher, relative to asOfDate.
// Returns null for an unknown/MiLB pitcher.
export function workloadFor(data, personId, asOfDate) {
  const ctx = priorApps(data, personId, asOfDate)
  if (!ctx) return null
  const { p, apps, asOfIdx } = ctx

  const last1 = apps.length ? { pitches: apps[0].p ?? 0, date: apps[0].d } : { pitches: 0, date: null }
  const last3 = bucket(apps, 3, asOfIdx)
  const last10 = bucket(apps, 10, asOfIdx)

  // Last-7-day window: appearances on asOf−7 … asOf−1.
  const in7 = apps.filter((a) => a.idx >= asOfIdx - 7 && a.idx < asOfIdx)
  const last7dayPitches = in7.reduce((a, x) => a + (x.p ?? 0), 0)
  const last7dayApps = in7.length

  // Distinct days pitched, and consecutive-day streak ending the day before asOf.
  const daySet = new Set(apps.map((a) => a.idx))
  let consecDays = 0
  for (let cur = asOfIdx - 1; daySet.has(cur); cur--) consecDays++
  const pitchedYesterday = daySet.has(asOfIdx - 1)
  const backToBack = daySet.has(asOfIdx - 1) && daySet.has(asOfIdx - 2)

  return {
    last1,
    last3,
    last10,
    last7dayPitches,
    last7dayApps,
    consecDays,
    pitchedYesterday,
    backToBack,
    role: p.role ?? 'RP',
    season: p.season ?? null,
  }
}

// The rule-based bullpen availability board (W5). ESPN "tired" thresholds:
//   - pitched yesterday with 25+ pitches
//   - 35+ pitches over the last 3 days (calendar window asOf−3 … asOf−1)
//   - pitched both of the prior two days (back-to-back)
// plus a HARD flag: pitched 3+ consecutive days ending yesterday.
// Status: 'down' if 3+ consecutive days OR >= 2 tired-flags; 'limited' if exactly
// one tired-flag; 'fresh' otherwise. Starters are not a bullpen concept — they
// return 'fresh' with a "last start N days ago" note. Null for unknown pitchers.
export function availabilityFor(data, personId, asOfDate) {
  const w = workloadFor(data, personId, asOfDate)
  if (!w) return null

  if (w.role === 'SP') {
    const ctx = priorApps(data, personId, asOfDate)
    const lastStart = ctx.apps.find((a) => a.gs === 1)
    const reasons =
      lastStart == null
        ? []
        : [`last start ${ctx.asOfIdx - lastStart.idx} day${ctx.asOfIdx - lastStart.idx === 1 ? '' : 's'} ago`]
    return { status: 'fresh', reasons }
  }

  // Pitches over the last 3 calendar days (asOf−3 … asOf−1).
  const ctx = priorApps(data, personId, asOfDate)
  const last3dayPitches = ctx.apps
    .filter((a) => a.idx >= ctx.asOfIdx - 3 && a.idx < ctx.asOfIdx)
    .reduce((a, x) => a + (x.p ?? 0), 0)

  const flags = []
  if (w.pitchedYesterday && w.last1.pitches >= 25) {
    flags.push(`${w.last1.pitches} pitches yesterday`)
  }
  if (last3dayPitches >= 35) {
    flags.push(`${last3dayPitches} pitches over 3 days`)
  }
  if (w.backToBack) {
    flags.push('back-to-back days')
  }

  const hard = w.consecDays >= 3
  const reasons = [...flags]
  if (hard) reasons.unshift(`pitched ${w.consecDays} straight days`)

  let status
  if (hard || flags.length >= 2) status = 'down'
  else if (flags.length === 1) status = 'limited'
  else status = 'fresh'

  return { status, reasons }
}

// Tally a list of availability statuses into the summary-pill counts the
// bullpen board shows above the board (Fresh / Limited / Likely down). Pure and
// order-independent; unrecognized statuses are ignored. Kept here beside the
// availability rules so the pill counts can't drift from the board's statuses.
export function bullpenStatusCounts(statuses) {
  const counts = { fresh: 0, limited: 0, down: 0 }
  for (const s of statuses ?? []) {
    if (s in counts) counts[s] += 1
  }
  return counts
}

// Load relative to baselines (W4): the pitcher's last-10-appearance pitch total
// as a percentage above/below (a) his role's league baseline mean and (b) his
// own season norm (season pitches / appearances × 10 = a typical 10-app load).
// Null-safe: any missing input yields a null percentage rather than NaN.
export function workloadVsBaseline(data, personId, asOfDate) {
  const w = workloadFor(data, personId, asOfDate)
  if (!w) return null

  const last10 = w.last10.pitches
  const roleMean = data?.baselines?.[w.role]?.last10?.mean ?? null

  const season = w.season
  const ownNorm =
    season && season.g > 0 && season.pitches > 0 ? (season.pitches / season.g) * 10 : null

  const pct = (base) => (base != null && base > 0 ? Math.round(((last10 - base) / base) * 100) : null)

  return {
    last10,
    roleMean,
    ownNorm: ownNorm == null ? null : Math.round(ownNorm * 10) / 10,
    vsRolePct: pct(roleMean),
    vsOwnPct: pct(ownNorm),
  }
}
