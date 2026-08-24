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

import { staticJson } from './staticJson.js'

export const fetchWorkload = staticJson('/data/workload.json')

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

// ---------------------------------------------------------------------------
// THE MOUND CARD's derivations.
//
// A hitter plays every day, so his last three lines answer "how is he going".
// A pitcher works every fifth or sixth day, so his last three lines never say
// the thing a scorer wants the moment a reliever starts throwing: did he pitch
// yesterday. These three readers are what the card adds on top of the buckets
// above, and every one of them DESCRIBES — none names a next start, and none
// calls a pitcher available. That verdict already exists (availabilityFor), is
// already shown on the Bullpen Board, and the card reuses it rather than
// inventing a second opinion.
// ---------------------------------------------------------------------------

// The day strip's three load bands, taken from the app's OWN tired thresholds
// (see availabilityFor) rather than invented: 25 is the pitch count that makes
// "he threw yesterday" a flag, 35 the count that does it over three days. So a
// cell's colour and the Bullpen Board's verdict can never tell different
// stories about the same outing.
export const LOAD_BANDS = { light: 0, moderate: 25, heavy: 35 }

function loadBand(pitches) {
  if (pitches == null) return 'none'
  if (pitches >= LOAD_BANDS.heavy) return 'heavy'
  if (pitches >= LOAD_BANDS.moderate) return 'moderate'
  return 'light'
}

// One cell per calendar day over the trailing `days`, oldest first, ending on
// asOfDate itself. TODAY IS NEVER SPENT: the file holds only completed
// appearances, and he may still pitch tonight — so the last cell carries no
// load and is flagged, rather than reading as a day off. Null for a pitcher
// with no record, which is the whole MiLB story: workload.json is built from
// the thirty active MLB rosters, so a Triple-A arm has none, and an MLB pitcher
// optioned down LOSES his mid-season. Callers render that as "not posted yet",
// never an empty strip (the degrade convention).
export function dayStripFor(data, personId, asOfDate, days = 14) {
  const ctx = priorApps(data, personId, asOfDate)
  if (!ctx) return null
  const { apps, asOfIdx } = ctx
  const byIdx = new Map(apps.map((a) => [a.idx, a]))
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const idx = asOfIdx - i
    const today = idx === asOfIdx
    const app = today ? null : byIdx.get(idx)
    const pitches = app ? (app.p ?? 0) : null
    out.push({
      date: new Date(idx * 86400000).toISOString().slice(0, 10),
      pitches,
      band: loadBand(pitches),
      today,
    })
  }
  return out
}

// Below this many outs per start a "starter" is an opener, not a rotation arm.
// pitcherRole is games-started share (gs/g >= 0.5), so a dedicated opener —
// twenty games, fifteen of them started, an inning each — classifies SP. Handing
// him a rotation turn would be a WRONG card, not a thin one: he goes every third
// day. Three innings is the line; a piggyback or a bulk arm clears it easily.
const MIN_OUTS_PER_START = 9

// The longest gap that still reads as a turn. A six-man rotation is 6 days and
// a skipped turn is ~12; beyond that he is not between starts, he is out.
const MAX_TURN_DAYS = 14

// A starter's turn: when he last STARTED (not last appeared — a starter who
// mopped up an extra-inning game did not take a turn), how many days have
// elapsed, and the range his own recent turns have kept.
//
// The range is a RANGE on purpose. A single "every 6th day" number is a
// prediction wearing a description's clothes, and this pitcher's own gaps run
// 6, 6, 7, 7, 6. Gaps far off his median — an All-Star break, an IL stint — are
// dropped from the range rather than widening it into meaninglessness, but stay
// in `gaps` for any caller that wants the whole record.
// Null for a non-starter and for an opener.
export function turnStripFor(data, personId, asOfDate) {
  const ctx = priorApps(data, personId, asOfDate)
  if (!ctx) return null
  const { p, apps, asOfIdx } = ctx
  if ((p.role ?? 'RP') !== 'SP') return null
  const season = p.season ?? null
  if (season?.gs > 0 && season.outs / season.gs < MIN_OUTS_PER_START) return null

  const starts = apps.filter((a) => a.gs === 1)
  if (starts.length === 0) return null
  const gaps = starts.slice(0, -1).map((a, i) => a.idx - starts[i + 1].idx)

  const recent = gaps.slice(0, 5)
  let typicalMin = null
  let typicalMax = null
  if (recent.length) {
    const sorted = [...recent].sort((a, b) => a - b)
    const median = sorted[sorted.length >> 1]
    const kept = recent.filter((g) => g <= median * 1.5)
    typicalMin = Math.min(...kept)
    typicalMax = Math.max(...kept)
  }
  const daysSince = asOfIdx - starts[0].idx
  return {
    lastStart: starts[0].d,
    lastStartPitches: starts[0].p ?? null,
    daysSince,
    gaps,
    typicalMin,
    typicalMax,
    // Past this, he is not in a rotation turn — injured, optioned, or shut
    // down. Callers drop the strip: one cell per elapsed day would draw fifty
    // of them, and "his last turns came every 7 days" would be describing a
    // rotation he is no longer in. The elapsed count is the whole story.
    outOfTurn: daysSince > MAX_TURN_DAYS,
  }
}

// The per-outing rates the card's footer prints. `outsPerOuting` is the one that
// separates a one-inning closer from a multi-inning long man — a distinction the
// SP/RP role word cannot make, and the reason the card shows this instead of a
// league-reliever baseline (that pool blends both, so a closer reads deeply
// negative every day of the season on his job description alone).
export function moundRateFor(data, personId) {
  const p = data?.pitchers?.[String(personId)]
  const s = p?.season
  if (!s || !(s.g > 0)) return null
  const outsPerOuting = Math.round((s.outs / s.g) * 10) / 10
  return {
    outsPerOuting,
    multiInning: outsPerOuting > 3,
    ipPerStart: s.gs > 0 ? outsToIp(Math.round(s.outs / s.gs)) : null,
    pitchesPerStart: s.gs > 0 ? Math.round(s.pitches / s.gs) : null,
  }
}

function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}
