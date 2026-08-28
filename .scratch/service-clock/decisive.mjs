// THE DECISIVE TEST.
//
// T2 found that roster additions run 1.6 times as fast per day in the fortnight
// after the service line as in the days before it. That number on its own
// cannot tell a clock from a rhythm: the days before the line are the first
// fortnight of a season, when a club has just set its roster and moves nobody,
// and roster churn climbs through April in any case.
//
// The window itself supplies the way to separate them. The line is a fixed
// distance from the season's LAST day, so its distance from the season's start
// moves with the season's length.
//
// That distance must be measured from the day the LEAGUE opened, not from the
// season's first game. Six seasons here open overseas and then wait six to ten
// days for the other twenty-eight clubs. Measured from the first game, the line
// lands on day 10 of 2011 and day 23 of 2025 — and that spread is the overseas
// gap, not a service calendar, so a test built on it compares overseas seasons
// with normal ones and calls the difference a clock. Measured from the league
// opener, the line lands between day 8 and day 15:
//
//     2012  8    2011  9    2022  9    2010 10    2014 10    2015 10
//     2016 10    2017 10    2013 11    2009 12    2019 14    2021 14
//     2025 14    2018 15    2023 15    2024 15
//
// The late-line group is now three overseas seasons (2019, 2024, 2025) and
// three ordinary ones (2018, 2021, 2023), so the two are no longer the same
// split wearing different names.
//
// So a fixed band of the calendar — days 12 to 14 of the season — sits AFTER
// the line in a short season and ON OR BEFORE it in a long one. Identical days
// of April, opposite service consequence. If clubs promote to the clock, that
// band is busier in short seasons. If they promote to a rhythm, it is not.
//
// The model below is that comparison written properly: a Poisson count of
// promotions per (season, day) cell, with season fixed effects absorbing how
// much churn a season has at all, day-of-season bins absorbing the shape of the
// rhythm shared by every season, and ONE coefficient on "this day is past the
// line". That coefficient is identified only by the variation in where the line
// falls. It cannot pick up the rhythm, because the rhythm is already in the
// model.
import { writeFile } from 'node:fs/promises'
import { j, local, loadCalendar, dayDiff, zToP, fmt, pct, rateRatioTest } from './lib.mjs'
import { poissonFit } from './glm.mjs'

const all = await j(local('panel'))
const calendar = await loadCalendar()
const out = {}
const say = (s) => process.stdout.write(s + '\n')
const head = (s) => say(`\n${'='.repeat(74)}\n${s}\n${'='.repeat(74)}`)

const MAX_DAY = 45 // days of the season the model covers
const BIN = 3

// The roster-add clock is the instrument. Service starts on the day a man joins
// the active roster, not on the day he first plays, and the two differ: a man
// can sit on the bench for a week before his debut. The wire carries the add
// from 2009 on (102-177 rows a season in 2005-2008 against 6,055 in 2009), so
// the model window is 2009-2025, less 2020.
const events = all.filter(
  (r) =>
    !r.excludedSeason &&
    r.debutSeason >= 2009 &&
    r.addSeasonDay != null &&
    r.addSeasonDay >= 1 &&
    r.addSeasonDay <= MAX_DAY &&
    r.clubId != null,
)
const seasons = [...new Set(events.map((r) => r.debutSeason))].sort()
say(`promotions modelled: ${events.length} first-time roster additions, ${seasons.length} seasons (${seasons[0]}-${seasons[seasons.length - 1]}, 2020 excluded)`)

// Where the line falls in each season, counted in days from Opening Day.
const lineDay = new Map()
for (const s of seasons) lineDay.set(s, calendar.get(s).preLineDays - 1)
say('line lands on day: ' + seasons.map((s) => `${s}:${lineDay.get(s)}`).join('  '))

// --- the fixed-calendar-band comparison, stated plainly ----------------------
head('D1. One band of the calendar, opposite service consequence')
const BAND = [12, 14]
const shortSeasons = seasons.filter((s) => lineDay.get(s) < BAND[0])
const longSeasons = seasons.filter((s) => lineDay.get(s) >= BAND[1])
say(`Band: days ${BAND[0]}-${BAND[1]} of the season, the same three days of April in every year.`)
say(`  AFTER the line (free) in ${shortSeasons.length} seasons: ${shortSeasons.join(', ')}`)
say(`  BEFORE the line (costly) in ${longSeasons.length} seasons: ${longSeasons.join(', ')}`)
say('')
function bandShare(seasonList) {
  // Share of a season's first-45-day promotions that land inside the band.
  // Normalising by the season's own total removes the fact that some seasons
  // simply see more movement than others.
  let inBand = 0
  let total = 0
  const per = []
  for (const s of seasonList) {
    const rowsS = events.filter((r) => r.debutSeason === s)
    const k = rowsS.filter((r) => r.addSeasonDay >= BAND[0] && r.addSeasonDay <= BAND[1]).length
    inBand += k
    total += rowsS.length
    per.push({ season: s, inBand: k, total: rowsS.length, share: rowsS.length ? k / rowsS.length : null })
  }
  return { inBand, total, share: total ? inBand / total : null, per }
}
const sh = bandShare(shortSeasons)
const lg = bandShare(longSeasons)
say(`  band is FREE   : ${sh.inBand} of ${sh.total} promotions = ${pct(sh.share)}`)
say(`  band is COSTLY : ${lg.inBand} of ${lg.total} promotions = ${pct(lg.share)}`)
// Season-level test: the unit that varies is the season, so the test is on
// season shares, not on events. Welch's t on 12 seasons is honest about n.
function welch(a, b) {
  const m = (x) => x.reduce((p, q) => p + q, 0) / x.length
  const v = (x) => (x.length > 1 ? x.reduce((p, q) => p + (q - m(x)) ** 2, 0) / (x.length - 1) : 0)
  const ma = m(a)
  const mb = m(b)
  const se = Math.sqrt(v(a) / a.length + v(b) / b.length)
  const t = se ? (ma - mb) / se : null
  return { meanA: ma, meanB: mb, t, p: t == null ? 1 : zToP(t), nA: a.length, nB: b.length }
}
const w = welch(
  sh.per.map((x) => x.share),
  lg.per.map((x) => x.share),
)
say(`  season-level: mean share ${pct(w.meanA)} (free, n=${w.nA} seasons) vs ${pct(w.meanB)} (costly, n=${w.nB} seasons)  t=${fmt(w.t, 2)} p=${fmt(w.p, 4)}`)
say('')
say('  per season:')
for (const x of [...sh.per.map((p) => ({ ...p, kind: 'free' })), ...lg.per.map((p) => ({ ...p, kind: 'costly' }))].sort((a, b) => a.season - b.season))
  say(`    ${x.season} line day ${String(lineDay.get(x.season)).padStart(2)}  band ${x.kind.padEnd(6)} ${String(x.inBand).padStart(3)}/${String(x.total).padStart(3)} = ${pct(x.share)}`)
out.d1 = { band: BAND, shortSeasons, longSeasons, free: sh, costly: lg, seasonLevelTest: w }

// --- the model ---------------------------------------------------------------
head('D2. Poisson model: season fixed effects + day-of-season shape + the line')
// Cells: (season, day). Exposure is one day each.
const cells = []
for (const s of seasons) {
  const cal = calendar.get(s)
  for (let d = 1; d <= Math.min(MAX_DAY, cal.lengthDays - 1); d++) {
    cells.push({ season: s, day: d, past: d > lineDay.get(s) ? 1 : 0, y: 0 })
  }
}
const cellIndex = new Map(cells.map((c, i) => [`${c.season}:${c.day}`, i]))
for (const r of events) {
  const i = cellIndex.get(`${r.debutSeason}:${r.addSeasonDay}`)
  if (i != null) cells[i].y++
}

const seasonLevels = seasons.slice(1) // first season is the reference
const nBins = Math.ceil(MAX_DAY / BIN)
const binLevels = [...Array(nBins).keys()].slice(1) // first bin is the reference

function design(cell, { withLine = true, withDayBins = true } = {}) {
  const x = [1]
  for (const s of seasonLevels) x.push(cell.season === s ? 1 : 0)
  if (withDayBins) for (const b of binLevels) x.push(Math.floor((cell.day - 1) / BIN) === b ? 1 : 0)
  if (withLine) x.push(cell.past)
  return x
}

function run(label, opts) {
  const X = cells.map((c) => design(c, opts))
  const y = cells.map((c) => c.y)
  const offset = cells.map(() => 0) // one day of exposure per cell
  const fit = poissonFit(X, y, offset)
  if (!fit) {
    say(`  ${label}: did not converge`)
    return null
  }
  const k = X[0].length
  const res = { label, deviance: fit.deviance, params: k }
  if (opts.withLine !== false) {
    const idx = k - 1
    const b = fit.beta[idx]
    const se = fit.se[idx]
    const z = se ? b / se : null
    res.line = {
      coef: b,
      rateRatio: Math.exp(b),
      se,
      z,
      p: z == null ? 1 : zToP(z),
      ci: se ? [Math.exp(b - 1.96 * se), Math.exp(b + 1.96 * se)] : null,
    }
    say(
      `  ${label.padEnd(52)} rate ratio ${fmt(Math.exp(b), 3)}  95% CI ${fmt(res.line.ci[0], 3)}-${fmt(res.line.ci[1], 3)}  z=${fmt(z, 2)}  p=${fmt(res.line.p, 4)}`,
    )
  } else {
    say(`  ${label.padEnd(52)} deviance ${fmt(fit.deviance, 1)} on ${cells.length - k} df`)
  }
  return res
}

say('The rate ratio is promotions per day past the line against promotions per')
say('day before it, after the stated controls. 1.00 means the line does nothing.')
say('')
const m1 = run('no controls (raw jump at the line)', { withDayBins: false })
const m2 = run('+ season fixed effects only', { withDayBins: false })
const m3 = run('+ season FE + day-of-season shape  <-- THE TEST', { withDayBins: true })
out.d2 = { rawJump: m1, seasonFe: m2, full: m3, cells: cells.length, events: events.length }

// --- what the day-of-season shape alone looks like ---------------------------
head('D3. The rhythm the model is controlling for')
say('Promotions per day by day of season, pooled over all seasons. This is the')
say('shape the third model absorbs — and the reason the raw jump is not enough.')
say('')
const perDay = []
for (let d = 1; d <= MAX_DAY; d++) {
  const cs = cells.filter((c) => c.day === d)
  const k = cs.reduce((a, b) => a + b.y, 0)
  perDay.push({ day: d, k, days: cs.length, rate: cs.length ? k / cs.length : null })
}
for (let d = 1; d <= MAX_DAY; d++) {
  const p = perDay[d - 1]
  const nPast = cells.filter((c) => c.day === d && c.past).length
  const nPre = cells.filter((c) => c.day === d && !c.past).length
  say(
    `  day ${String(d).padStart(2)}  ${String(p.k).padStart(3)} promotions / ${String(p.days).padStart(2)} season-days = ${fmt(p.rate, 2)}/d   (past the line in ${nPast} of ${nPast + nPre} seasons)  ${'#'.repeat(Math.round(p.rate * 8))}`,
  )
}
out.d3 = { perDay }

// --- the same test, split by whether the line is early or late ---------------
head('D4. Does the jump move with the line?')
say('If the line drives promotions, the step sits on day ~11 in short seasons')
say('and on day ~21 in long ones. If a rhythm drives them, both step together.')
say('')
function profile(seasonList, label) {
  const rowsS = events.filter((r) => seasonList.includes(r.debutSeason))
  const perDayS = []
  for (let d = 1; d <= 32; d++) {
    const k = rowsS.filter((r) => r.addSeasonDay === d).length
    perDayS.push(k / seasonList.length)
  }
  say(`  ${label} (lines on day ${[...new Set(seasonList.map((s) => lineDay.get(s)))].sort((a, b) => a - b).join('/')})`)
  say(
    '    ' +
      perDayS
        .map((v, i) => (seasonList.every((s) => lineDay.get(s) < i + 1) ? '|' : '') + fmt(v, 1))
        .join(' '),
  )
  return perDayS
}
say('  per-day promotions per season, day 1 to 32. A "|" marks the first day')
say('  that is past the line in EVERY season of the group.')
say('')
const profShort = profile(shortSeasons, 'short seasons, line early')
const profLong = profile(longSeasons, 'long seasons,  line late ')
out.d4 = { shortSeasons, longSeasons, profileShort: profShort, profileLong: profLong }

// Mean promotions per season in the discriminating band, and either side.
for (const [label, seasonList] of [
  ['line early (band free)', shortSeasons],
  ['line late (band costly)', longSeasons],
]) {
  const rowsS = events.filter((r) => seasonList.includes(r.debutSeason))
  const before = rowsS.filter((r) => r.addSeasonDay >= 1 && r.addSeasonDay <= 12).length / seasonList.length
  const band = rowsS.filter((r) => r.addSeasonDay >= 13 && r.addSeasonDay <= 18).length / seasonList.length
  const after = rowsS.filter((r) => r.addSeasonDay >= 19 && r.addSeasonDay <= 30).length / seasonList.length
  say('')
  say(
    `  ${label.padEnd(26)} days 1-11: ${fmt(before / 11, 2)}/d   days 12-14: ${fmt(band / 3, 2)}/d   days 15-30: ${fmt(after / 16, 2)}/d`,
  )
}

await writeFile(local('decisive'), JSON.stringify(out, null, 1))
say('\nwrote decisive.json')
