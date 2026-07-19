// Regenerates public/data/lineup-values.json — per-player runs-per-game value and
// positional eligibility for every MLB club's active-roster hitters, the nightly
// input to the Lineup Strength grade (metric engine L2; see
// .scratch/metric-engines/lineup-strength.md and src/api/lineupStrength.js).
//
// Full rebuild, MLB only (sportId 1). For each of the 30 clubs it reads the
// ACTIVE roster, keeps the non-pitchers (a two-way player's position type isn't
// 'Pitcher', so he rides along as a hitter automatically), and per player pulls:
//   - WAR from the LOCAL public/data/war.json (never refetch FanGraphs — that's
//     gen-war.mjs's job; this reads its committed output, hitting WAR = .bat)
//   - season PA via /people/{id}/stats?stats=season&group=hitting
//   - season + career fielding innings by position (one combined call) → the
//     eligibility matrix (the "Andrew Vaughn at 3B" guard: a handful of innings
//     at a spot is not an option there).
//
// The value model (all constants below, echoed into the file's `constants` block
// for the receipt's transparency): WAR/PA*600 = WAR per 600 PA, regressed
// Marcel-style toward replacement at low PA, converted to runs/game at 9.5
// runs/WAR over 162 games. Verified against a live 2026 Brewers roster before the
// nightly cron was wired. Run by hand: node scripts/gen-lineup-values.mjs

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'lineup-values.json')
const warPath = join(here, '..', 'public', 'data', 'war.json')
const season = new Date().getFullYear()

// --- value-model tunables (documented in the module header) -----------------
const RUNS_PER_WAR = 9.5 // standard runs-per-win conversion
const GAMES = 162 // full season length, for per-game and positional proration
const PA_SCALE = 600 // WAR-per-600-PA rate denominator
const REGRESSION_PA = 250 // Marcel-style shrink: value *= PA / (PA + this)

// --- eligibility tunables ----------------------------------------------------
const FIELD_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
const ELIG_SEASON_INN = 20 // eligible if season innings >= this ...
const ELIG_CAREER_INN = 50 // ... OR career innings >= this
const WEIGHT_SEASON_FULL = 200 // season innings that saturate the season term
const WEIGHT_CAREER_FULL = 900 // career innings that saturate the career term
const WEIGHT_SEASON_W = 0.6 // season-familiarity blend weight
const WEIGHT_CAREER_W = 0.4 // career-familiarity blend weight
const WEIGHT_FLOOR = 0.3 // floor for any eligible position

const CONCURRENCY = 6

const constants = {
  runsPerWar: RUNS_PER_WAR,
  games: GAMES,
  paScale: PA_SCALE,
  regressionPa: REGRESSION_PA,
  eligSeasonInn: ELIG_SEASON_INN,
  eligCareerInn: ELIG_CAREER_INN,
  weightSeasonFull: WEIGHT_SEASON_FULL,
  weightCareerFull: WEIGHT_CAREER_FULL,
  weightSeasonW: WEIGHT_SEASON_W,
  weightCareerW: WEIGHT_CAREER_W,
  weightFloor: WEIGHT_FLOOR,
}

const API = 'https://statsapi.mlb.com/api/v1'

async function getJson(url, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Origin: 'https://bbsbh.vercel.app' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === tries) throw err
      await new Promise((r) => setTimeout(r, 300 * attempt))
    }
  }
}

// Run an async mapper over items with a fixed concurrency ceiling (politeness).
async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

const round2 = (n) => Math.round(n * 100) / 100
const round3 = (n) => Math.round(n * 1000) / 1000

// Innings come as strings in baseball's thirds notation ("286.0", "1050.2").
// parseFloat is close enough for the coarse eligibility thresholds here.
const inns = (s) => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

// WAR per 600 PA regressed toward replacement (0) at low PA, then runs/game.
function computeRpg(war, pa) {
  if (!Number.isFinite(war) || !Number.isFinite(pa) || pa <= 0) return 0
  const warPer600 = (war / pa) * PA_SCALE
  const regressed = warPer600 * (pa / (pa + REGRESSION_PA))
  return (regressed * RUNS_PER_WAR) / GAMES
}

// Familiarity weight [0,1] blending season and career innings share, floored
// when the position clears the eligibility gate.
function weightFor(seasonInn, careerInn) {
  const raw =
    WEIGHT_SEASON_W * Math.min(seasonInn / WEIGHT_SEASON_FULL, 1) +
    WEIGHT_CAREER_W * Math.min(careerInn / WEIGHT_CAREER_FULL, 1)
  return Math.max(WEIGHT_FLOOR, Math.min(1, raw))
}

function buildEligibility(seasonByPos, careerByPos) {
  const base = {}
  for (const pos of FIELD_POS) {
    const sInn = seasonByPos[pos] ?? 0
    const cInn = careerByPos[pos] ?? 0
    if (sInn >= ELIG_SEASON_INN || cInn >= ELIG_CAREER_INN) {
      base[pos] = weightFor(sInn, cInn)
    }
  }
  const elig = { ...base }
  // Cross-position bonuses, all derived from BASE weights (never chained off
  // another bonus). Applied only when they'd raise the target's weight.
  const bump = (target, val) => {
    if (val > 0 && (elig[target] === undefined || val > elig[target])) elig[target] = val
  }
  if (base.CF !== undefined) {
    bump('LF', 0.9 * base.CF)
    bump('RF', 0.9 * base.CF)
  }
  if (base.LF !== undefined) bump('RF', 0.95 * base.LF)
  if (base.RF !== undefined) bump('LF', 0.95 * base.RF)
  if (base.SS !== undefined) {
    bump('2B', 0.9 * base.SS)
    bump('3B', 0.8 * base.SS)
  }
  elig.DH = 1 // every hitter can DH
  const rounded = {}
  for (const [k, v] of Object.entries(elig)) rounded[k] = round2(v)
  return rounded
}

function splitsByPos(statsBlocks, typeName) {
  const block = (statsBlocks ?? []).find((s) => s.type?.displayName === typeName)
  const map = {}
  for (const sp of block?.splits ?? []) {
    const pos = sp.position?.abbreviation
    if (pos) map[pos] = inns(sp.stat?.innings)
  }
  return map
}

async function processPlayer(entry, warBat) {
  const id = entry.person.id
  const name = entry.person.fullName
  const primaryPos = entry.position?.abbreviation
  const teamId = entry.__teamId
  try {
    const [hitting, fielding] = await Promise.all([
      getJson(`${API}/people/${id}/stats?stats=season&group=hitting&season=${season}`),
      getJson(`${API}/people/${id}/stats?stats=season,career&group=fielding&season=${season}`),
    ])
    const pa = hitting?.stats?.[0]?.splits?.[0]?.stat?.plateAppearances ?? 0
    const war = warBat[id]
    const hasWar = war != null
    const rpg = computeRpg(hasWar ? war : NaN, pa)
    const seasonByPos = splitsByPos(fielding?.stats, 'season')
    const careerByPos = splitsByPos(fielding?.stats, 'career')
    const elig = buildEligibility(seasonByPos, careerByPos)
    const player = {
      name,
      teamId,
      primaryPos,
      rpg: round3(rpg),
      pa,
      elig,
    }
    if (!hasWar) player.noWar = true
    return [String(id), player]
  } catch (err) {
    console.warn(`  skip ${name} (${id}): ${err.message}`)
    return null
  }
}

async function main() {
  const warRaw = JSON.parse(await readFile(warPath, 'utf8'))
  const warBat = warRaw.bat ?? {} // hitting WAR, keyed by personId
  console.log(`war.json: season ${warRaw.season}, ${Object.keys(warBat).length} batters`)

  const teamsJson = await getJson(`${API}/teams?sportId=1&season=${season}`)
  const teams = (teamsJson.teams ?? []).filter((t) => t.sport?.id === 1 || t.id)
  console.log(`teams: ${teams.length}`)

  // Gather every hitter across all clubs first, then process with one shared pool.
  const hitters = []
  for (const team of teams) {
    let roster
    try {
      roster = await getJson(`${API}/teams/${team.id}/roster/Active`)
    } catch (err) {
      console.warn(`roster ${team.id} failed: ${err.message}`)
      continue
    }
    for (const entry of roster.roster ?? []) {
      if (entry.position?.type === 'Pitcher') continue // two-way players are not 'Pitcher'
      hitters.push({ ...entry, __teamId: team.id })
    }
  }
  console.log(`hitters: ${hitters.length}`)

  const results = await pool(hitters, CONCURRENCY, (h) => processPlayer(h, warBat))
  const players = {}
  for (const r of results) {
    if (r) players[r[0]] = r[1]
  }

  const payload = {
    season,
    asOf: new Date().toISOString(),
    players,
    constants,
  }
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(payload))
  const bytes = Buffer.byteLength(JSON.stringify(payload))
  console.log(`wrote ${out} (${Object.keys(players).length} players, ${(bytes / 1024).toFixed(1)}KB)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
