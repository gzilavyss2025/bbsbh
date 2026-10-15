import { divisionRecordFor } from '../../data/shared.js'

// The top of the one-scroll team page (#1107, row 5), as pure shapes: the record spot, the form
// line, the two stretches, Last 10, the days calendar and the win-percentage grid. Everything
// reads what the page already fetched, the standings and the club schedule. Spoiler stance: the
// schedule's `won` is null for a game that is not final or is past the page's cutoff
// (fetchTeamSchedule), and every shape here counts a game only once it has a `won`. So a result
// dated after `?d=` cannot reach the line, the stretches, Last 10 or the calendar.

export const STRETCH = 15
const MLB_CLUBS = 30
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthOf = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1]

const decided = (schedule) => schedule.filter((g) => g.won != null)
const regular = (schedule) => decided(schedule).filter((g) => g.gameType === 'R')

// ---- the form line

// Games over .500 after each decided regular-season game, from a zero before the first.
export function formSeries(schedule) {
  const rows = regular(schedule)
  if (!rows.length) return null
  let v = 0
  const points = [{ date: rows[0].apiDate, v: 0 }, ...rows.map((g) => ({ date: g.apiDate, v: (v += g.won ? 1 : -1) }))]
  return { points, n: rows.length, now: v }
}

// The chart's geometry in a 336-wide box: the line, the fill's outline, the zero line, the
// gridlines and the month labels. y grows downward, the zero line sits where the range puts it.
const BOX = { left: 20, right: 326, top: 16, bottom: 132 }
const STEPS = [5, 10, 25, 50, 100]
const signed = (v) => `${v < 0 ? '−' : '+'}${Math.abs(v)}`

export function formGeometry({ points }) {
  const { left, right, top, bottom } = BOX
  const vs = points.map((p) => p.v)
  // The range always has a little room each side of the zero line, so the line is never on the edge.
  const span = Math.max(Math.max(...vs), -Math.min(...vs), 0)
  const pad = Math.max(1, Math.round(span * 0.1))
  const lo = Math.min(-pad, ...vs)
  const hi = Math.max(pad, ...vs)
  const y = (v) => top + ((hi - v) / (hi - lo)) * (bottom - top)
  const x = (i) => left + (i / (points.length - 1)) * (right - left)
  const zeroY = y(0)
  const pt = (i) => `${x(i).toFixed(1)} ${y(points[i].v).toFixed(1)}`
  const line = `M${points.map((_, i) => pt(i)).join(' L')}`
  const step = STEPS.find((s) => (hi - lo) / s <= 4) ?? 100
  const ticks = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) if (v !== 0) ticks.push({ y: y(v), label: signed(v) })
  // A label sits at the first game of its month; a month that starts too near the last label takes its place.
  const months = []
  points.forEach((p, i) => {
    const m = p.date.slice(0, 7)
    if (m === months.at(-1)?.m) return
    const label = { m, x: x(i), label: monthOf(p.date) }
    if (months.length && label.x - months.at(-1).x < 28) months.pop()
    months.push(label)
  })
  return {
    ...BOX,
    zeroY,
    line,
    area: `${line} L${right.toFixed(1)} ${zeroY.toFixed(1)} Z`,
    ticks,
    months,
    end: { x: right, y: y(points.at(-1).v) },
  }
}

// ---- the stretches and Last 10

// The best and worst `w`-game window of the regular season by wins, as { w, l }. Null with fewer
// than `w` decided games.
export function stretches(schedule, w = STRETCH) {
  const rows = regular(schedule)
  if (rows.length < w) return null
  let wins = rows.slice(0, w).filter((g) => g.won).length
  let best = wins
  let worst = wins
  for (let i = w; i < rows.length; i++) {
    wins += (rows[i].won ? 1 : 0) - (rows[i - w].won ? 1 : 0)
    best = Math.max(best, wins)
    worst = Math.min(worst, wins)
  }
  return { best: { w: best, l: w - best }, worst: { w: worst, l: w - worst } }
}

// The last ten decided games, October too (the calendar under the tile shows October), and the
// streak that ends them. Fewer than ten games early in a season: the tile says how many.
export function lastTen(schedule) {
  const rows = decided(schedule).slice(-10)
  if (!rows.length) return null
  const w = rows.filter((g) => g.won).length
  const last = rows.at(-1).won
  let run = 0
  const all = decided(schedule)
  for (let i = all.length - 1; i >= 0 && all[i].won === last; i--) run++
  return { w, l: rows.length - w, n: rows.length, streak: `${last ? 'W' : 'L'}${run}` }
}

// ---- the days calendar

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Eight days: six back, the page's day, the day after. A day with no game is an `off` chip, a
// decided game is `w` or `l`, a game still to play (today on) is the `next` chip with its
// opponent. Null with no game left to play, so the offseason draws no calendar.
// ponytail: the window is fixed; a next game more than a day out shows no chip, add a wider window if it matters.
export function daysRail(schedule, today) {
  const next = schedule.find((g) => g.won == null && g.apiDate >= today)
  if (!next) return null
  const dates = Array.from({ length: 8 }, (_, k) => addDays(today, k - 6))
  const days = dates.map((date) => {
    const chips = schedule
      .filter((g) => g.apiDate === date)
      .map((g) =>
        g.won != null
          ? { k: g.won ? 'w' : 'l', t: g.won ? 'W' : 'L' }
          : date >= today && { k: 'next', t: g.opponent?.abbreviation ?? '' },
      )
      .filter(Boolean)
    return { date, d: String(Number(date.slice(8))), chips: chips.length ? chips : [{ k: 'off', t: '' }] }
  })
  const shown = schedule.filter((g) => dates.includes(g.apiDate))
  return { days, todayIdx: 6, month: monthOf(today), post: shown.some((g) => g.gameType !== 'R'), next }
}

// ---- the record spot and the grid

const DIFF = (d) => (Number.isFinite(d) ? (d > 0 ? `+${d}` : `${d}`) : null)
const FLAG_WORD = { z: 'Clinched', y: 'Clinched', x: 'Clinched', w: 'Clinched', e: 'Eliminated' }

// The standings' clinch letter as a marker flag ("z · Clinched"), or null.
export function flagOf(letter) {
  return FLAG_WORD[letter] ? { letter, word: FLAG_WORD[letter] } : null
}

// "1st of 30": an MLB club among all 30 (sportRank), any other club in its division, or in its
// league when it has no division. Null when the feed carries no rank.
export function rankOf(row, team, poolSize) {
  const mlb = (team.sport?.id ?? 1) === 1
  const rank = Number(mlb ? row.sportRank : (row.divisionRank ?? row.leagueRank))
  return Number.isFinite(rank) && rank > 0 ? { rank, of: mlb ? MLB_CLUBS : poolSize } : null
}

// The Run diff tile's caption: both runs or none, so a feed gap never prints "null".
export const runsCaption = (line) => (line?.rs != null && line.ra != null ? `${line.rs} for · ${line.ra} against` : null)

// The club's own line out of a fetchStandings response, or null with no row for it.
export function clubLine(standings, team) {
  const division = divisionRecordFor(standings, team)
  const mine = division?.teamRecords?.find((t) => t.team.id === team.id)
  if (!mine) return null
  return {
    wins: mine.wins,
    losses: mine.losses,
    record: `${mine.wins}-${mine.losses}`,
    pct: mine.leagueRecord?.pct ?? null,
    rs: Number.isFinite(mine.runsScored) ? mine.runsScored : null,
    ra: Number.isFinite(mine.runsAllowed) ? mine.runsAllowed : null,
    diff: DIFF(mine.runDifferential),
    rank: rankOf(mine, team, division.teamRecords.length),
    flag: flagOf(mine.clinchIndicator),
    divisionName: shortDivision(team.division?.name ?? team.league?.name),
  }
}

// "National League Central" -> "NL Central", the way the hero's sub line reads it.
const shortDivision = (name) => name?.replace(/^National League /, 'NL ').replace(/^American League /, 'AL ') ?? null

const COLS = 5
const share = (t) => t.wins / ((t.wins + t.losses) || 1)

// The clubs of a pool, best record first, as grid cells: `i` is the cell's place on the diagonal
// the cells ink in on (row + column of a five-wide grid), `tier` its shade, `me` the viewed club.
// A pool where every club carries the feed's `sportRank` follows it, so the grid's place and the record
// spot's rank agree on a tie; any other pool sorts by win share.
export function gridCells(records, id) {
  const fed = records.every((t) => Number.isFinite(Number(t.sportRank)))
  const sorted = [...records].sort((a, b) => (fed ? a.sportRank - b.sportRank : share(b) - share(a) || b.wins - a.wins))
  return sorted.map((t, n) => ({
    id: t.team.id,
    g: t.leagueRecord?.pct ?? '',
    i: Math.floor(n / COLS) + (n % COLS),
    tier: t.team.id === id ? 'me' : n / sorted.length < 0.2 ? 'hi' : n / sorted.length < 0.6 ? 'mid' : 'lo',
  }))
}
