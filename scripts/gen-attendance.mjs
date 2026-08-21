// Regenerates public/data/attendance.json — per-team, per-season HOME-game
// attendance: games counted, season total, average, high, low, and how many
// of those dates filled the park. Powers the Ballpark card's attendance rows
// (src/screens/team/modules/ballpark/BallparkCard.jsx) via the reader
// src/api/attendance.js.
//
// SOURCE: the SCHEDULE endpoint, hydrated with gameInfo —
//
//   /api/v1/schedule?sportId=1&gameType=R&startDate=..&endDate=..
//     &hydrate=gameInfo,venue
//       -> games[].gameInfo.attendance
//
// which is the same feed gen-gate.mjs sweeps for /attendance and /pace-of-play.
// This script used to fetch ONE BOXSCORE PER GAME to read the `Att` row out of
// info[] — ~1,900 requests a season, which is why it carried SQLite, an
// ingested-games table and an incremental trailing window. gen-gate.mjs's
// header called that out as unnecessary, and the two sources agree to the
// figure (the Angels' 2026 season came back 65 games / 2,102,552 / high
// 44,931 / low 21,375 either way), so the boxscore sweep and all of its state
// are gone. A whole season is now ~12 requests and a stateless rebuild.
//
// It still owns its OWN file rather than reading gate.json: the Ballpark card
// wants ~1.8 KB shaped for one club, not the 30 KB of splits the two report
// pages want, and the Overview loads it on every MLB team page.
//
// The row reducer is gen-gate.mjs's own `toRow` — the Final-only filter, the
// postponed-replay dedup (a replayed game is listed under BOTH dates, so only
// the officialDate bucket counts) and the "0 means absent, not a crowd of
// none" rule are one implementation, tested once, in test/gate.test.js.
//
// COUNTED ONLY FOR THE HOME CLUB — attendance is a fact about that club's own
// park, not the visiting side, so an away game folds nothing in. MLB only
// (sportId 1): a league rank needs the whole 30-team pool, and MiLB gates
// degrade too unevenly (the MiLB-degrades-gracefully convention in
// docs/api/static-data.md already covers a missing attendance figure there).
//
// SELLOUTS ARE COUNTED HERE, and they are the one figure this file derives
// rather than reports, because counting them needs the PER-GAME gates that
// never leave this script. A game counts as a sellout when its crowd reached
// SELLOUT_FILL of the listed capacity of the park it was played in
// (src/lib/ballpark/ballparkData.js). 95% rather than 100% because "capacity"
// is a listed figure, not a turnstile cap: it includes obstructed and
// held-back inventory a club does not sell, which is why announced sellouts
// routinely land a little under it — and why a full house with standing room
// can land over it. The threshold ships IN the file (`selloutFill`) so the
// card can label the number with the definition it was counted under instead
// of hard-coding a second copy of it. A game at a park with no listed
// capacity (a neutral site abroad, the A's interim home before it was added)
// counts toward games/total/average and toward NO sellout — it has no
// denominator to be measured against.
//
// Run by hand:
//   node scripts/gen-attendance.mjs                 # this season
//   node scripts/gen-attendance.mjs --season=2025   # a past season
//   node scripts/gen-attendance.mjs --seasons=2024,2025,2026
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getJson } from './lib/statsapi.mjs'
import { writeJsonAtomic } from './lib/io.js'
import { parseArgs } from './lib/args.mjs'
import { toRow } from './gen-gate.mjs'
import { ballparkFor } from '../src/lib/ballpark/ballparkData.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'attendance.json')

// Share of a park's listed capacity a crowd has to reach to count as a
// sellout — see this file's header for why it is not 1.
export const SELLOUT_FILL = 0.95

// A regular season never starts before February or runs past November, so
// twelve month-windows cover any season with room to spare. Same sweep shape
// as gen-gate.mjs; requesting a month with no games back is free.
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const pad = (n) => String(n).padStart(2, '0')
const lastDayOf = (season, month) => new Date(Date.UTC(season, month, 0)).getUTCDate()

// ---- pure reducers (exported for test/attendance.test.js — no network, no fs) ----

// The listed capacity of the park a game was played in, or null when that park
// is not in the static table. Keyed off the venue the game actually used, not
// the home club's usual address, so a neutral-site game is never measured
// against a park it was not played in.
export function capacityOf(venue) {
  return ballparkFor(venue)?.capacity ?? null
}

// One club's home dates -> the season row attendance.json ships for it, or
// null when no date reported a gate. `sellouts` and `seats` cover only the
// dates whose park has a listed capacity; `seats` is that same subset's
// summed capacity, which is what the reader divides the matching crowd total
// by for a fill rate (an average against one park's capacity would quietly
// misprice a club that played a series abroad).
export function seasonRow(rows) {
  const counted = rows.filter((r) => r.attendance != null)
  if (!counted.length) return null
  let total = 0
  let high = null
  let low = null
  let sellouts = 0
  let seats = 0
  let seated = 0
  let capGames = 0
  for (const r of counted) {
    total += r.attendance
    if (high == null || r.attendance > high) high = r.attendance
    if (low == null || r.attendance < low) low = r.attendance
    const capacity = capacityOf(r.venue)
    if (!capacity) continue
    capGames += 1
    seats += capacity
    seated += r.attendance
    if (r.attendance >= capacity * SELLOUT_FILL) sellouts += 1
  }
  return {
    games: counted.length,
    total,
    avg: Math.round(total / counted.length),
    high,
    low,
    // Null rather than 0 when not one date had a park on file: no capacity is
    // "we cannot say", which is a different answer from "nobody filled it".
    sellouts: capGames ? sellouts : null,
    capGames: capGames || null,
    seats: seats || null,
    seated: seated || null,
  }
}

// Every club's row for one season, keyed by team id — attendance.json's
// `byTeamId`. Home dates only, per this file's header.
export function byTeamId(rows) {
  const home = new Map()
  for (const r of rows) {
    if (!home.has(r.homeId)) home.set(r.homeId, [])
    home.get(r.homeId).push(r)
  }
  const out = {}
  for (const [teamId, hostRows] of home) {
    const row = seasonRow(hostRows)
    if (row) out[teamId] = row
  }
  return out
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
        if (row?.attendance != null) {
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

  const file = { generatedAt: new Date().toISOString(), selloutFill: SELLOUT_FILL, seasons: {} }
  let games = 0
  for (const season of seasons) {
    console.log(`${season}:`)
    const rows = await fetchSeason(season)
    if (!rows.length) {
      console.log('  no Final games reporting a gate — skipping')
      continue
    }
    file.seasons[season] = { byTeamId: byTeamId(rows) }
    games += rows.length
    console.log(`  ${rows.length} home dates folded in`)
  }
  await writeJsonAtomic(out, file)
  console.log(`wrote ${out} — ${games} games`)
}

// Only sweep when run as a script — keeps the reducers importable for tests
// without triggering a live fetch and a file write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
