// Shared helpers for the service-clock spike: the calendar, the line, the CSV
// reader and the small statistics the analysis leans on.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const here = dirname(fileURLToPath(import.meta.url))
export const repo = join(here, '..', '..')

export const j = async (p) => JSON.parse(await readFile(p, 'utf8'))
export const local = (name) => join(here, `${name}.json`)

const DAY = 24 * 3600 * 1000

// --- the calendar ------------------------------------------------------------

// A service year is 172 days on the active roster. A man added on date D and
// held to the last day of the championship season accrues (end - D + 1) days,
// so the last date on which a full year is still reachable is end - 171 days.
// The line therefore moves with each season's own calendar and is never a
// constant. It depends only on the season's LAST day, so an overseas opener —
// 2019 in Japan, 2024 in Seoul, 2025 in Tokyo — widens the pre-line window
// without moving the line.
export const SERVICE_YEAR_DAYS = 172

export function dateToMs(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function msToDate(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function dayDiff(aIso, bIso) {
  return Math.round((dateToMs(aIso) - dateToMs(bIso)) / DAY)
}

export function cutoffDate(regularSeasonEndDate) {
  return msToDate(dateToMs(regularSeasonEndDate) - (SERVICE_YEAR_DAYS - 1) * DAY)
}

// 2020 is not comparable and is excluded from every headline figure. The
// championship season ran 67 days (2020-07-23 .. 2020-09-27), so no man could
// reach 172 days and the parties agreed a pro-rated grant instead. The rule
// that replaced the 172-day count is not in any feed this repo reads, so the
// line cannot be derived for that season rather than guessed at.
export const EXCLUDED_SEASONS = new Set([2020])

// THE DAY THE SEASON STARTS IS NOT ALWAYS THE DAY OF ITS FIRST GAME.
// Six seasons in this window open overseas — 2008 and 2012 in Japan, 2014 in
// Australia, 2019 in Japan, 2024 in Seoul, 2025 in Tokyo. Two clubs play one or
// two games, then the league waits six to ten days before the other twenty-eight
// start. `regularSeasonStartDate` names the overseas game, so counting days of
// the season from it makes exactly those six seasons look long, and puts the
// first fortnight of ordinary baseball where a normal season's third week sits.
//
// This matters more than it sounds. Anchored on the first game, the service
// line lands on day 10 of 2011 and day 23 of 2025, and that 13-day spread is
// almost entirely the overseas gap — so a test that uses the spread as its
// identifying variation is really comparing overseas seasons with normal ones.
// Anchored on the LEAGUE opener, the first date carrying ten or more games, the
// spread is day 8 to day 15, and the late-line seasons are three overseas
// (2019, 2024, 2025) and three not (2018, 2021, 2023).
export async function loadCalendar() {
  const seasons = await j(local('seasons'))
  const sched = await j(local('schedule-days'))
  const byYear = new Map()
  for (const s of seasons) {
    const cutoff = cutoffDate(s.regularSeasonEndDate)
    const days = sched[s.season] ?? []
    const leagueOpener = (days.find((d) => d.games >= 10) ?? days[0])?.date ?? s.regularSeasonStartDate
    byYear.set(s.season, {
      ...s,
      cutoff,
      firstGameDate: s.regularSeasonStartDate,
      leagueOpener,
      overseasOpenerGapDays: dayDiff(leagueOpener, s.regularSeasonStartDate),
      lengthDays: dayDiff(s.regularSeasonEndDate, leagueOpener) + 1,
      // Days of the season on or before the line: the whole window in which a
      // club can still promote a man and give him the year.
      preLineDays: dayDiff(cutoff, leagueOpener) + 1,
      excluded: EXCLUDED_SEASONS.has(s.season),
    })
  }
  return byYear
}

// --- the CSV -----------------------------------------------------------------

export function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else q = false
      } else cur += c
    } else if (c === '"') q = true
    else if (c === ',') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

export async function readCsv(relPath) {
  const text = await readFile(join(repo, relPath), 'utf8')
  const lines = text.split(/\r?\n/)
  const header = parseCsvLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const cells = parseCsvLine(lines[i])
    const row = {}
    header.forEach((h, k) => {
      row[h] = cells[k] ?? ''
    })
    // The CSV index IS the row's identity. Never renumber it, never drop a row.
    row.__index = rows.length
    rows.push(row)
  }
  return rows
}

// `mls` is written Y.DDD — years, then days, right-padded. "8.16" is eight
// years and 160 days, not sixteen: Cody Bellinger debuted 2017-04-25 and banked
// 160 days that season, and his 2026 row reads 8.16. Some cells carry Excel
// float noise ("8.061000000000002"), so the fraction is rounded to three places
// before the day count is read. Only the YEARS part decides the one question
// this spike asks of the column, and that part is never ambiguous.
export function parseMls(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const years = Math.floor(n)
  const days = Math.round((n - years) * 1000)
  return { years, days, raw: s, value: years + days / 1000 }
}

// --- statistics --------------------------------------------------------------

export function mean(a) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
}

// Two-sided binomial test against p0, exact.
export function binomTest(k, n, p0 = 0.5) {
  if (n === 0) return { p: 1, k, n, rate: null }
  const logC = (nn, kk) => lgamma(nn + 1) - lgamma(kk + 1) - lgamma(nn - kk + 1)
  const pmf = (i) => Math.exp(logC(n, i) + i * Math.log(p0) + (n - i) * Math.log(1 - p0))
  const obs = pmf(k)
  let p = 0
  for (let i = 0; i <= n; i++) {
    const v = pmf(i)
    if (v <= obs * (1 + 1e-9)) p += v
  }
  return { p: Math.min(1, p), k, n, rate: k / n }
}

export function lgamma(x) {
  // Lanczos.
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

// Normal tail, two-sided.
export function zToP(z) {
  const a = Math.abs(z)
  // Abramowitz & Stegun 7.1.26 on erfc.
  const t = 1 / (1 + 0.3275911 * (a / Math.SQRT2))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-((a / Math.SQRT2) ** 2))
  return Math.max(0, Math.min(1, 1 - y))
}

// Two-proportion z test.
export function propTest(k1, n1, k2, n2) {
  if (!n1 || !n2) return { z: null, p: 1, p1: null, p2: null }
  const p1 = k1 / n1
  const p2 = k2 / n2
  const p = (k1 + k2) / (n1 + n2)
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
  if (!se) return { z: null, p: 1, p1, p2 }
  const z = (p1 - p2) / se
  return { z, p: zToP(z), p1, p2, diff: p1 - p2 }
}

// Rate-ratio test on two Poisson counts observed over different exposures
// (here: debuts per day in two windows of different widths).
export function rateRatioTest(k1, exp1, k2, exp2) {
  if (!k1 && !k2) return { ratio: null, p: 1, rate1: 0, rate2: 0 }
  const rate1 = k1 / exp1
  const rate2 = k2 / exp2
  // Conditional binomial: k1 | k1+k2 ~ Bin(k1+k2, exp1/(exp1+exp2)).
  const t = binomTest(k1, k1 + k2, exp1 / (exp1 + exp2))
  return { ratio: rate2 ? rate1 / rate2 : null, p: t.p, rate1, rate2, k1, k2, exp1, exp2 }
}

export function fmt(x, d = 3) {
  return x == null || !Number.isFinite(x) ? '—' : x.toFixed(d)
}

export function pct(x, d = 1) {
  return x == null || !Number.isFinite(x) ? '—' : (100 * x).toFixed(d) + '%'
}
