// The parent spike's specification, factored out so the power calculation and
// the analysis fit the SAME model. It is mirrored from
// .scratch/service-clock/controls.mjs and is not a second design: a Poisson
// count of first-time roster additions per (season, day) cell, season fixed
// effects, three-day day-of-season bins that absorb the April churn ramp, and
// one coefficient on "this day is past the service line".
//
// THE ANCHOR IS THE PARENT'S, NOT A NEW ONE. Day 0 of a season is the LEAGUE
// opener — the first date carrying ten or more games — never the season's first
// game. Six seasons open overseas and then pause six to ten days; anchored on
// the first game the parent spike returned 1.702 at p=0.0012, which was
// entirely the travel gap. `preLineDays` comes straight from the parent panel,
// which reads it from loadCalendar() in .scratch/service-clock/lib.mjs.
//
// The line lands on day `preLineDays - 1`, so `d > preLineDays - 1` is exactly
// the panel's `addRelDay >= 1`: a man added that day cannot reach 172 days.
import { poissonFitSparse } from '../service-clock/glm.mjs'
import { zToP } from '../service-clock/lib.mjs'

export const MAX_DAY = 45
export const BIN = 3

// Build the sparse design. `events` is any subset of the base cohort.
//   shift        slides every season's line by a fixed number of days (placebo)
//   dayBins      the April churn ramp; without it the estimate is the naive one
//   clubFe       moves the cell grain to (club, season, day)
//   markGroup    a function returning true for the "treated" subset; when given,
//                the cell grain gains a group axis and the design carries a
//                group main effect and a group x line INTERACTION. The
//                interaction is the rank-matched test done properly: the day
//                bins are then estimated off the whole cohort rather than off
//                the thin ranked subset.
export function buildDesign(events, calendar, clubs, opts = {}) {
  const { shift = 0, dayBins = true, clubFe = false, markGroup = null, seasonsOverride = null } = opts
  const seasons = seasonsOverride ?? [...new Set(events.map((r) => r.debutSeason))].sort((a, b) => a - b)
  if (seasons.length < 2) return null
  const lineDay = new Map(seasons.map((s) => [s, calendar.get(s).preLineDays - 1 + shift]))

  const seasonIdx = new Map(seasons.slice(1).map((s, i) => [s, i]))
  const nSeasonCols = seasons.length - 1
  const nBins = Math.ceil(MAX_DAY / BIN)
  const binIdx = new Map([...Array(nBins).keys()].slice(1).map((b, i) => [b, i]))
  const nBinCols = dayBins ? nBins - 1 : 0
  const clubIdx = new Map(clubs.slice(1).map((c, i) => [c, i]))
  const nClubCols = clubFe ? clubs.length - 1 : 0

  const OFF_SEASON = 1
  const OFF_BIN = OFF_SEASON + nSeasonCols
  const OFF_CLUB = OFF_BIN + nBinCols
  const OFF_LINE = OFF_CLUB + nClubCols
  const OFF_GROUP = OFF_LINE + 1
  const OFF_INTER = OFF_GROUP + 1
  const p = markGroup ? OFF_INTER + 1 : OFF_LINE + 1

  const counts = new Map()
  const key = (r) =>
    `${clubFe ? r.clubId : 'x'}:${markGroup ? (markGroup(r) ? 1 : 0) : 'x'}:${r.debutSeason}:${r.addSeasonDay}`
  for (const r of events) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1)

  const rows = []
  const y = []
  const offset = []
  const clubList = clubFe ? clubs : [null]
  const groupList = markGroup ? [0, 1] : [null]
  for (const club of clubList) {
    for (const g of groupList) {
      for (const s of seasons) {
        const cal = calendar.get(s)
        const maxD = Math.min(MAX_DAY, cal.lengthDays - 1)
        for (let d = 1; d <= maxD; d++) {
          const feat = [[0, 1]]
          if (seasonIdx.has(s)) feat.push([OFF_SEASON + seasonIdx.get(s), 1])
          if (dayBins) {
            const b = Math.floor((d - 1) / BIN)
            if (binIdx.has(b)) feat.push([OFF_BIN + binIdx.get(b), 1])
          }
          if (clubFe && clubIdx.has(club)) feat.push([OFF_CLUB + clubIdx.get(club), 1])
          const past = d > lineDay.get(s)
          if (past) feat.push([OFF_LINE, 1])
          if (markGroup) {
            if (g === 1) feat.push([OFF_GROUP, 1])
            if (g === 1 && past) feat.push([OFF_INTER, 1])
          }
          rows.push(feat)
          y.push(counts.get(`${clubFe ? club : 'x'}:${markGroup ? g : 'x'}:${s}:${d}`) ?? 0)
          offset.push(0)
        }
      }
    }
  }
  return { rows, y, offset, p, OFF_LINE, OFF_INTER: markGroup ? OFF_INTER : null, seasons }
}

function report(fit, col, n, cells) {
  if (!fit) return null
  const b = fit.beta[col]
  const se = fit.se[col]
  const z = se ? b / se : null
  return {
    n,
    cells,
    rateRatio: Math.exp(b),
    ci: se ? [Math.exp(b - 1.96 * se), Math.exp(b + 1.96 * se)] : null,
    se,
    z,
    p: z == null ? 1 : zToP(z),
  }
}

export function fitLine(events, calendar, clubs, opts = {}) {
  const d = buildDesign(events, calendar, clubs, opts)
  if (!d) return null
  const fit = poissonFitSparse(d.rows, d.y, d.offset, d.p)
  if (!fit) return null
  const out = report(fit, d.OFF_LINE, events.length, d.rows.length)
  if (d.OFF_INTER != null) out.interaction = report(fit, d.OFF_INTER, events.length, d.rows.length)
  return out
}
