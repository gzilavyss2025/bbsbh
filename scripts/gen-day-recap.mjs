// Generates public/data/day-recap/YYYY-MM-DD.json for a completed slate.
//
// The artifact moves the expensive cross-game work out of the browser:
//   - Top Performers (WPA + context-neutral player points)
//   - Winners/Losers in the past-day recap
//   - Day Highlights
//   - Longest HR, hardest hit, and fastest strikeout
//
// It is keyed by sport level because the UI can switch between MLB and the
// four full-season MiLB levels on the same date. Run with --date=YYYY-MM-DD;
// without it, generate yesterday's completed slate. A failed individual game
// is skipped so one bad Stats API response does not erase the rest of a day.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeTopPerformers, computeTopPerformersByResult } from '../src/api/topPerformers.js'
import { rankDayHighlights } from '../src/api/dayHighlights.js'
import { computeDaySuperlatives } from '../src/api/daySuperlatives.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'day-recap')
const BASE = 'https://statsapi.mlb.com'
const SPORT_IDS = [1, 11, 12, 13, 14]

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

function parseDate(argv) {
  const arg = argv.find((value) => value.startsWith('--date='))?.slice(7)
  if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) return arg
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function normalizeGame(game, sportId, dateStr) {
  const away = game.teams?.away?.team
  const home = game.teams?.home?.team
  if (!game.gamePk || !away?.abbreviation || !home?.abbreviation) return null
  return {
    gamePk: game.gamePk,
    sportId,
    gameNumber: game.gameNumber ?? 1,
    abstractState: game.status?.abstractGameState,
    away: { id: away.id, abbreviation: away.abbreviation },
    home: { id: home.id, abbreviation: home.abbreviation },
    dateStr,
  }
}

async function scheduleFor(dateStr, sportId) {
  const data = await getJson(`/api/v1/schedule?sportId=${sportId}&date=${dateStr}&hydrate=team`)
  return (data.dates ?? [])
    .flatMap((date) => date.games ?? [])
    .map((game) => normalizeGame(game, sportId, dateStr))
    .filter((game) => game?.abstractState === 'Final')
}

async function feedFor(gamePk) {
  const [feed, winProb] = await Promise.all([
    getJson(`/api/v1.1/game/${gamePk}/feed/live`),
    getJson(`/api/v1/game/${gamePk}/winProbability?fields=homeTeamWinProbabilityAdded,atBatIndex,about,inning,isTopInning,matchup,batter,pitcher,id,result,awayScore,homeScore,description,runners,details,isScoringEvent,runner`),
  ])
  return { feed, winProb: Array.isArray(winProb) ? winProb : null }
}

async function readJsonOrEmpty(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

function calloutsForDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return join(here, '..', 'public', 'data', 'callouts', `${month}${day}${year}.json`)
}

async function buildSport(dateStr, sportId) {
  const games = await scheduleFor(dateStr, sportId)
  if (!games.length) return null

  const settled = await Promise.allSettled(
    games.map(async (game) => {
      const { feed, winProb } = await feedFor(game.gamePk)
      return { gamePk: game.gamePk, game, feed, winProb, dateStr }
    }),
  )
  const entries = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
  if (!entries.length) return null

  // The prospect snapshot is only used to attach existing rank badges; it is
  // not part of the expensive game scan and can be absent safely.
  const prospects = await readJsonOrEmpty(
    join(here, '..', 'public', 'data', 'top-prospects.json'),
    { players: [], orgProspects: [] },
  )
  const calloutsData = await readJsonOrEmpty(calloutsForDate(dateStr), { games: {} })
  const performerInput = { games, prospects, dateStr }

  const [topPerformers, performersByResult] = await Promise.all([
    computeTopPerformers(performerInput),
    computeTopPerformersByResult(performerInput),
  ])
  return {
    topPerformers,
    performersByResult,
    highlights: rankDayHighlights(entries, calloutsData),
    superlatives: computeDaySuperlatives(entries),
  }
}

const dateStr = parseDate(process.argv.slice(2))
const results = await Promise.all(
  SPORT_IDS.map(async (sportId) => [sportId, await buildSport(dateStr, sportId)]),
)
const bySportId = Object.fromEntries(results.filter(([, value]) => value))
await mkdir(outDir, { recursive: true })
await writeFile(
  join(outDir, `${dateStr}.json`),
  JSON.stringify({ version: 1, date: dateStr, generatedAt: new Date().toISOString(), bySportId }, null, 2) + '\n',
)
console.log(`Wrote day recap for ${dateStr}: ${Object.keys(bySportId).length} levels`)
