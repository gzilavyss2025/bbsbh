// Builds the raw panels for the "October texture" spike — the first entry in
// this program that asks about the GAMES rather than about the rosters that
// reached them. Every earlier spike (age, homegrown, star diversity,
// postseason experience) regressed a REGULAR-SEASON team trait against the
// outcome ladder. This one compares the same players and the same staffs
// against THEMSELVES: what they did April-to-September vs. what they did in
// October of the same year.
//
// THREE PANELS, all off statsapi's `gameType` split (R = regular season,
// P = postseason; statsapi folds F/D/L/W into P for season-stat purposes —
// verified against 2024, where the P-side team rows sum to the same games the
// bracket in public/data/postseason-history.json lists).
//
//   1. teamSeason  — /api/v1/teams/stats, both groups, both gameTypes, per
//      season. Gives per-TEAM rows, which is what makes the honest baseline in
//      analyze-october-texture.mjs possible: "what did the October clubs'
//      staffs allow in the regular season," not "what did all thirty clubs
//      allow." Without that split every October decline is trivially
//      explained by "they faced better pitchers" with no way to size it.
//   2. playerSeason — /api/v1/stats (league-wide, no teamId), both groups,
//      both gameTypes. Whole-season lines ON PURPOSE. build-roster-age.mjs
//      warns that this endpoint collapses a traded player into ONE row under
//      his last club carrying his whole-season total; that is a bug when you
//      are attributing a player to a roster, and it is exactly what is wanted
//      here — the baseline for "did he hit better or worse in October" is the
//      season he actually had, not the slice of it after the trade.
//   3. arsenal — /api/v1/people/{id}/stats?stats=pitchArsenal, both gameTypes,
//      for every pitcher-season with enough October pitches to be worth
//      reading. PITCHf/x-era only; the endpoint returns an empty split list
//      before 2008, which is why ARSENAL_FLOOR exists.
//
// A fourth panel needs no pull at all: the randomness question reads
// public/data/postseason-history.json straight off disk — every series, both
// seeds, every game score, already committed.
//
// Run: node .scratch/team-success/build-october-texture.mjs
// Writes: october-texture-cache.json (raw, resumable) + october-texture.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_PATH = join(__dirname, 'october-texture-cache.json')
const OUT_PATH = join(__dirname, 'october-texture.json')

const SEASONS = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i)
// PITCHf/x came online league-wide in 2008; pitchArsenal returns nothing
// usable before it.
const ARSENAL_FLOOR = 2008
// Below this many October pitches an arsenal share is mostly noise — one
// outing's worth of pitch selection, which says more about the hitters he
// happened to face than about the pitcher.
const MIN_POSTSEASON_PITCHES = 50

const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {}
let dirty = 0

async function getJson(url, tries = 5) {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'bbsbh-research/1.0' } })
      if (!res.ok) throw new Error(`http ${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === tries - 1) throw err
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
    }
  }
}

async function cached(key, url) {
  if (cache[key] !== undefined) return cache[key]
  const json = await getJson(url)
  cache[key] = json
  if (++dirty % 50 === 0) writeFileSync(CACHE_PATH, JSON.stringify(cache))
  return json
}

// Bounded concurrency against a public endpoint with no published rate limit.
async function pool(items, limit, worker) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await worker(items[next++])
    }),
  )
}

// ---------------------------------------------------------------- panel 1
async function teamSeasonPanel() {
  const jobs = []
  for (const season of SEASONS)
    for (const group of ['hitting', 'pitching'])
      for (const gameType of ['R', 'P']) jobs.push({ season, group, gameType })

  const rows = []
  await pool(jobs, 6, async ({ season, group, gameType }) => {
    const json = await cached(
      `team|${season}|${group}|${gameType}`,
      `https://statsapi.mlb.com/api/v1/teams/stats?season=${season}&sportIds=1` +
        `&stats=season&group=${group}&gameType=${gameType}`,
    )
    for (const split of json?.stats?.[0]?.splits ?? [])
      rows.push({ season, group, gameType, teamId: split.team?.id, stat: split.stat })
  })
  console.log(`  teamSeason: ${rows.length} rows`)
  return rows
}

// ---------------------------------------------------------------- panel 2
async function playerSeasonPanel() {
  const jobs = []
  for (const season of SEASONS)
    for (const group of ['hitting', 'pitching'])
      for (const gameType of ['R', 'P']) jobs.push({ season, group, gameType })

  const rows = []
  await pool(jobs, 6, async ({ season, group, gameType }) => {
    const json = await cached(
      `player|${season}|${group}|${gameType}`,
      `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}` +
        `&season=${season}&gameType=${gameType}&playerPool=All&sportId=1&limit=4000`,
    )
    const splits = json?.stats?.[0]?.splits ?? []
    const total = json?.stats?.[0]?.totalSplits
    // A silent truncation here would quietly drop the tail of the league —
    // exactly the bench players and long relievers this spike cares about.
    if (total && splits.length < total)
      throw new Error(`${season}/${group}/${gameType}: got ${splits.length} of ${total} — raise the limit`)
    for (const split of splits)
      rows.push({
        season,
        group,
        gameType,
        personId: split.player?.id,
        name: split.player?.fullName,
        teamId: split.team?.id,
        stat: split.stat,
      })
  })
  console.log(`  playerSeason: ${rows.length} rows`)
  return rows
}

// ---------------------------------------------------------------- panel 3
async function arsenalPanel(playerRows) {
  const wanted = playerRows.filter(
    (r) =>
      r.group === 'pitching' &&
      r.gameType === 'P' &&
      r.season >= ARSENAL_FLOOR &&
      (r.stat?.numberOfPitches ?? 0) >= MIN_POSTSEASON_PITCHES,
  )
  console.log(`  arsenal: ${wanted.length} pitcher-seasons clear ${MIN_POSTSEASON_PITCHES} October pitches`)

  const rows = []
  await pool(wanted, 6, async (r) => {
    const entry = { season: r.season, personId: r.personId, name: r.name, teamId: r.teamId }
    for (const gameType of ['R', 'P']) {
      const json = await cached(
        `arsenal|${r.personId}|${r.season}|${gameType}`,
        `https://statsapi.mlb.com/api/v1/people/${r.personId}/stats` +
          `?stats=pitchArsenal&season=${r.season}&gameType=${gameType}`,
      )
      entry[gameType] = (json?.stats?.[0]?.splits ?? []).map((s) => ({
        code: s.stat?.type?.code,
        description: s.stat?.type?.description,
        count: s.stat?.count,
        totalPitches: s.stat?.totalPitches,
        averageSpeed: s.stat?.averageSpeed,
      }))
    }
    if (entry.R.length && entry.P.length) rows.push(entry)
  })
  console.log(`  arsenal: ${rows.length} pitcher-seasons with both sides on file`)
  return rows
}

// ----------------------------------------------------------------- main
console.log('October texture — building panels')
const teamSeason = await teamSeasonPanel()
const playerSeason = await playerSeasonPanel()
const arsenal = await arsenalPanel(playerSeason)
writeFileSync(CACHE_PATH, JSON.stringify(cache))

writeFileSync(
  OUT_PATH,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'statsapi teams/stats + stats + people/{id}/stats?stats=pitchArsenal, gameType R vs P',
    window: { first: SEASONS[0], last: SEASONS.at(-1), arsenalFloor: ARSENAL_FLOOR },
    minPostseasonPitches: MIN_POSTSEASON_PITCHES,
    teamSeason,
    playerSeason,
    arsenal,
  }),
)
console.log(`Wrote ${OUT_PATH}`)
