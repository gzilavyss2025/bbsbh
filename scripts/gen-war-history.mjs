// Regenerates public/data/war-history.json — season WAR per player for PAST
// (completed) seasons, keyed by MLB Stats API personId, exactly like the nightly
// public/data/war.json but spanning many years instead of just the live one.
//
// Split from gen-war.mjs on purpose: a completed season's WAR is IMMUTABLE
// (FanGraphs won't restate 2024's numbers), so this is a HAND-RUN regenerate
// (like gen-milb-history.mjs), NOT a cron — re-run it once a year to fold in the
// season that just ended. The live app reads BOTH files (src/api/war.js): the
// current, still-moving season from war.json (nightly cron), every completed
// season from this file. The player page's career-register WAR column and the
// season tile's WAR draw from the union.
//
// Same source + join as gen-war.mjs: FanGraphs' CORS-open leaderboard API, whose
// rows carry `xMLBAMID` (== statsapi personId), so no name-matching. WAR is
// MLB-only here — FanGraphs publishes no reliable minor-league WAR — so MiLB
// rows/tiles fall back to a dash, consistent with the rest of the app.
//
// START_SEASON is the earliest year pulled. Bumping it further back is just a
// bigger file (each season is ~2,200 players across bat+pit); 2015 covers the
// bulk of any current player's MLB career, and pre-START seasons on a veteran's
// register simply show a dash in the WAR column (graceful, same as MiLB).
// Run by hand: node scripts/gen-war-history.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'war-history.json')

const START_SEASON = 2015
// Only COMPLETED seasons belong here; the live season is war.json's job. Before
// a season ends its WAR is still moving, so stop at the year before the current.
const LAST_SEASON = new Date().getFullYear() - 1

async function fetchLeaderboard(stats, season) {
  const url =
    `https://www.fangraphs.com/api/leaders/major-league/data` +
    `?age=&pos=all&stats=${stats}&lg=all&season=${season}&season1=${season}` +
    `&startdate=&enddate=&qual=0&type=8&pageitems=3000&pagenum=1`
  const res = await fetch(url, { headers: { Origin: 'https://bbsbh.vercel.app' } })
  if (!res.ok) throw new Error(`FanGraphs ${stats} ${season} leaderboard: HTTP ${res.status}`)
  const json = await res.json()
  const map = {}
  for (const row of json.data ?? []) {
    const id = row.xMLBAMID
    const war = Number(row.WAR)
    if (id && Number.isFinite(war)) map[id] = Math.round(war * 10) / 10
  }
  return map
}

const bat = {}
const pit = {}
const seasons = []
for (let season = START_SEASON; season <= LAST_SEASON; season++) {
  const [b, p] = await Promise.all([
    fetchLeaderboard('bat', season),
    fetchLeaderboard('pit', season),
  ])
  bat[season] = b
  pit[season] = p
  seasons.push(season)
  console.log(`${season}: ${Object.keys(b).length} batters, ${Object.keys(p).length} pitchers`)
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ seasons, generatedAt: new Date().toISOString(), bat, pit }))
console.log(`wrote ${out} (${seasons.length} seasons ${START_SEASON}–${LAST_SEASON})`)
