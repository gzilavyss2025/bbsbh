// Regenerates public/data/gate.json — the two facts every completed game
// carries that nobody has ever put on a page here: HOW MANY PEOPLE CAME, and
// HOW LONG IT TOOK. One sweep, two report pages:
//
//   /attendance  ("The Gate")  — src/screens/reports/AttendancePage.jsx
//   /pace        ("The Clock") — src/screens/reports/PacePage.jsx
//
// SOURCE, and why this generator is cheap where gen-attendance.mjs is not.
// gen-attendance.mjs fetches ONE BOXSCORE PER GAME to read the `Att` row out
// of info[] — 1,869 requests for a season, which is why it needs SQLite, an
// ingested-games table and an incremental trailing window. It did not have to.
// The SCHEDULE endpoint hydrates the same figures directly:
//
//   /api/v1/schedule?sportId=1&startDate=..&endDate=..&gameType=R&hydrate=gameInfo
//     -> games[].gameInfo = { attendance, firstPitch, gameDurationMinutes,
//                             delayDurationMinutes }
//
// (verified live against 2026-07-01, gamePk 824818: attendance 19045,
// gameDurationMinutes 159, delayDurationMinutes 0). So a whole season is ~12
// requests, one per month, and this script can rebuild from scratch every
// night with no database and no incremental state at all. That is the whole
// reason it is a separate generator rather than an extension of the existing
// one: gen-attendance.mjs owns the Ballpark card's contract
// (public/data/attendance.json) and is not worth destabilising, and a
// stateless full rebuild is strictly simpler than the machinery it would have
// had to inherit.
//
// WHAT IT SHIPS: FACTS, NOT THE INDEX. Every ranking, fill rate, percentile
// and league-average comparison the two pages draw is computed in
// src/api/reports/gate.js, which is pure and unit-tested (test/gate.test.js).
// This file's only job is to reduce ~2,400 games into per-club aggregates
// small enough to ship as one static file, which is the build-time-fetch
// pattern in src/api/CLAUDE.md.
//
// TWO DIFFERENT DENOMINATORS, on purpose:
//   - ATTENDANCE is counted for the HOME club only. A gate is a fact about
//     that club's own park; a road game folds nothing in. Same rule
//     gen-attendance.mjs already states.
//   - PACE is counted for BOTH clubs in every game. How long a game takes is
//     a joint production of the two rosters on the field, and a club that
//     works fast at home does not stop working fast on the road. Counting
//     only home games would halve the sample and measure the park.
//
// SPOILER-FREE. A crowd count, a clock reading and a delay length say nothing
// about who won or by how much — the same footing as the weather string and
// the umpire crew, which the app has always shown live. Nothing here is a
// score, a run total or an inning result, so no SealBox and no reveal gate
// (see src/api/spoiler-manifest.json, where the reader is registered
// spoiler-free).
//
// Run by hand:
//   node scripts/gen-gate.mjs                 # this season, whole year to date
//   node scripts/gen-gate.mjs --season=2025   # a past season
//   node scripts/gen-gate.mjs --seasons=2024,2025,2026
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getJson } from './lib/statsapi.mjs'
import { writeJsonAtomic } from './lib/io.js'
import { parseArgs } from './lib/args.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'gate.json')

// A regular season never starts before February or runs past November, so
// twelve month-windows cover any season with room to spare. Requesting a
// month with no games back is free — the endpoint returns an empty dates[].
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

// How many opponents' draw figures a club keeps. Three is what the page shows
// ("who fills this park"); shipping all 29 would quadruple the file for rows
// nobody renders.
const TOP_OPPONENTS = 3

const pad = (n) => String(n).padStart(2, '0')
const lastDayOf = (season, month) => new Date(Date.UTC(season, month, 0)).getUTCDate()

// ---- pure reducers (exported for test/gate.test.js — no network, no fs) ----

// Day of week for a YYYY-MM-DD calendar date, 0=Sunday. Uses Date.UTC so the
// machine's own timezone can never shift the day — the trap that would file
// every Sunday day game as Saturday for anyone west of Greenwich.
export function dayOfWeek(iso) {
  if (!iso || iso.length < 10) return null
  return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay()
}

// One schedule game -> the flat row this generator reasons over, or null if
// the game carries nothing worth counting. A game is usable when it is Final,
// is filed under its own officialDate (the postponed-replay dedup every sweep
// in this repo needs: a replayed game is listed under BOTH the original date
// and the date it was actually played), and reports at least one of the two
// figures. Attendance and duration are kept independently — a game may report
// a clock reading with no gate, and both pages would rather have half a row
// than no row.
export function toRow(game, date) {
  if (game?.status?.abstractGameState !== 'Final') return null
  if (date != null && game.officialDate !== date) return null
  const att = Number(game?.gameInfo?.attendance)
  const min = Number(game?.gameInfo?.gameDurationMinutes)
  const delay = Number(game?.gameInfo?.delayDurationMinutes)
  const homeId = game?.teams?.home?.team?.id
  const awayId = game?.teams?.away?.team?.id
  if (homeId == null || awayId == null) return null
  const attendance = Number.isFinite(att) && att > 0 ? att : null
  const minutes = Number.isFinite(min) && min > 0 ? min : null
  if (attendance == null && minutes == null) return null
  return {
    gamePk: game.gamePk,
    date: game.officialDate,
    homeId,
    awayId,
    attendance,
    minutes,
    // A delay of 0 is the overwhelmingly common truth, not a missing value,
    // so it degrades to 0 rather than null — but only when the field is there.
    delayMinutes: Number.isFinite(delay) ? delay : 0,
    // 'day' | 'night' straight off the schedule. Absent on a handful of
    // neutral-site/exhibition-adjacent games; those simply miss the split.
    dayNight: game.dayNight === 'day' || game.dayNight === 'night' ? game.dayNight : null,
    venue: game?.venue?.name ?? null,
    dow: dayOfWeek(game.officialDate),
    month: Number(game.officialDate?.slice(5, 7)) || null,
  }
}

// Mean of a list of numbers, rounded to `places`, or null for an empty list.
function mean(values, places = 0) {
  if (!values.length) return null
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const f = 10 ** places
  return Math.round(avg * f) / f
}

// Middle value of a list, or the mean of the middle pair. The MEDIAN is worth
// shipping alongside the mean because one sold-out opening day drags a small
// club's average up by a thousand seats, and the two numbers disagreeing IS
// the story on several clubs — the page prints both.
function median(values) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

// { g, avg } for a bucket of rows on one numeric field — the shape every split
// below ships. A bucket with no usable value returns null rather than a zero,
// so the page never prints a 0 it would have to explain.
function bucket(rows, field, places = 0) {
  const values = rows.map((r) => r[field]).filter((v) => v != null)
  return values.length ? { g: values.length, avg: mean(values, places) } : null
}

// The extreme row on one field, kept with enough context to name it: the
// figure, the day, and who was in town. "44,931 against the Cubs on June 14"
// is a sentence; "44,931" is a number.
function extreme(rows, field, pick) {
  const usable = rows.filter((r) => r[field] != null)
  if (!usable.length) return null
  const best = usable.reduce((a, b) => (pick(b[field], a[field]) ? b : a))
  return { n: best[field], date: best.date, oppId: best.oppId ?? null }
}

// The home-gate half: how many came, when they came, and who they came to see.
function gateFor(rows) {
  const counted = rows.filter((r) => r.attendance != null)
  if (!counted.length) return null
  const values = counted.map((r) => r.attendance)
  const byOpp = new Map()
  for (const r of counted) {
    if (!byOpp.has(r.oppId)) byOpp.set(r.oppId, [])
    byOpp.get(r.oppId).push(r.attendance)
  }
  return {
    games: counted.length,
    total: values.reduce((a, b) => a + b, 0),
    avg: mean(values),
    median: median(values),
    high: extreme(counted, 'attendance', (a, b) => a > b),
    low: extreme(counted, 'attendance', (a, b) => a < b),
    byMonth: monthSplit(counted, 'attendance'),
    day: bucket(counted.filter((r) => r.dayNight === 'day'), 'attendance'),
    night: bucket(counted.filter((r) => r.dayNight === 'night'), 'attendance'),
    // Friday(5)/Saturday(6)/Sunday(0) is the industry's own weekend, and it is
    // the split a club's ticketing office actually plans against.
    weekend: bucket(counted.filter((r) => [0, 5, 6].includes(r.dow)), 'attendance'),
    weekday: bucket(counted.filter((r) => [1, 2, 3, 4].includes(r.dow)), 'attendance'),
    topOpponents: [...byOpp.entries()]
      .map(([oppId, vals]) => ({ teamId: Number(oppId), g: vals.length, avg: mean(vals) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, TOP_OPPONENTS),
  }
}

// The clock half: home AND road, for the reason in this file's header.
function paceFor(rows) {
  const counted = rows.filter((r) => r.minutes != null)
  if (!counted.length) return null
  const values = counted.map((r) => r.minutes)
  const delayed = counted.filter((r) => r.delayMinutes > 0)
  return {
    games: counted.length,
    avg: mean(values, 1),
    median: median(values),
    longest: extreme(counted, 'minutes', (a, b) => a > b),
    shortest: extreme(counted, 'minutes', (a, b) => a < b),
    byMonth: monthSplit(counted, 'minutes'),
    day: bucket(counted.filter((r) => r.dayNight === 'day'), 'minutes', 1),
    night: bucket(counted.filter((r) => r.dayNight === 'night'), 'minutes', 1),
    // Total minutes this club has spent waiting for weather, and how many of
    // its games carried any wait at all.
    delays: { games: delayed.length, minutes: delayed.reduce((a, r) => a + r.delayMinutes, 0) },
    // How many of its games ran past three hours, and past three and a half —
    // the two thresholds a broadcast actually talks about.
    over180: values.filter((v) => v > 180).length,
    over210: values.filter((v) => v > 210).length,
  }
}

// { '04': { g, avg }, ... } over whichever calendar months have usable rows.
function monthSplit(rows, field) {
  const byMonth = {}
  for (const r of rows) {
    if (r.month == null || r[field] == null) continue
    ;(byMonth[pad(r.month)] ??= []).push(r[field])
  }
  const split = {}
  for (const [m, values] of Object.entries(byMonth)) {
    split[m] = { g: values.length, avg: mean(values, field === 'minutes' ? 1 : 0) }
  }
  return split
}

// Fold every usable row into per-club aggregates. `rows` is the flat list
// toRow produced; the return value is gate.json's `clubs` map.
export function aggregate(rows) {
  const home = new Map() // teamId -> rows where that club was the host
  const all = new Map() // teamId -> rows that club played in, either side
  for (const r of rows) {
    if (!home.has(r.homeId)) home.set(r.homeId, [])
    home.get(r.homeId).push({ ...r, oppId: r.awayId })
    for (const [id, oppId] of [
      [r.homeId, r.awayId],
      [r.awayId, r.homeId],
    ]) {
      if (!all.has(id)) all.set(id, [])
      all.get(id).push({ ...r, oppId })
    }
  }

  const clubs = {}
  for (const teamId of new Set([...home.keys(), ...all.keys()])) {
    const hostRows = home.get(teamId) ?? []
    const playedRows = all.get(teamId) ?? []
    clubs[teamId] = {
      venue: hostRows.find((r) => r.venue)?.venue ?? null,
      gate: gateFor(hostRows),
      pace: paceFor(playedRows),
    }
  }
  return clubs
}

// The league line every club is measured against. Computed from the ROWS, not
// from the per-club averages — averaging thirty averages weights a club with
// 59 home dates the same as one with 66, which is a different (and wrong)
// number to compare a club against.
export function leagueFor(rows) {
  const att = rows.map((r) => r.attendance).filter((v) => v != null)
  const min = rows.map((r) => r.minutes).filter((v) => v != null)
  return {
    games: rows.length,
    attGames: att.length,
    attAvg: mean(att),
    attMedian: median(att),
    attTotal: att.reduce((a, b) => a + b, 0),
    paceGames: min.length,
    paceAvg: mean(min, 1),
    paceMedian: median(min),
    over180: min.filter((v) => v > 180).length,
  }
}

export function buildSeason(rows) {
  return {
    games: rows.length,
    through: rows.reduce((a, r) => (r.date > a ? r.date : a), ''),
    league: leagueFor(rows),
    clubs: aggregate(rows),
  }
}

// ---- the sweep ----

async function fetchSeason(season) {
  const rows = []
  for (const month of MONTHS) {
    const startDate = `${season}-${pad(month)}-01`
    const endDate = `${season}-${pad(month)}-${pad(lastDayOf(season, month))}`
    const schedule = await getJson(
      `/api/v1/schedule?sportId=1&gameType=R&startDate=${startDate}&endDate=${endDate}` +
        `&hydrate=gameInfo,venue`,
    )
    let kept = 0
    for (const d of schedule.dates ?? []) {
      for (const g of d.games ?? []) {
        const row = toRow(g, d.date)
        if (row) {
          rows.push(row)
          kept += 1
        }
      }
    }
    if (kept) console.log(`  ${startDate}..${endDate}: ${kept} games`)
  }
  return rows
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const seasons = args.seasons
    ? String(args.seasons).split(',').map(Number)
    : [Number(args.season) || new Date().getUTCFullYear()]

  const file = { generatedAt: new Date().toISOString(), seasons: {} }
  for (const season of seasons) {
    console.log(`${season}:`)
    const rows = await fetchSeason(season)
    if (!rows.length) {
      console.log('  no Final games with gate or clock figures — skipping')
      continue
    }
    file.seasons[season] = buildSeason(rows)
    console.log(`  ${rows.length} games folded in`)
  }
  await writeJsonAtomic(out, file)
  console.log(`wrote ${out}`)
}

// Only sweep when run as a script — keeps the reducers importable for tests
// without triggering a live fetch and a file write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
