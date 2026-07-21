// Generates public/data/day-recap/YYYY-MM-DD.json for a completed slate.
//
// The artifact moves one piece of expensive cross-game work out of the browser:
// Top Performers (WPA + context-neutral player points), read by
// TopPerformersBox via src/api/dayRecap.js.
//
// It once carried three more sections — Day Highlights, the recap's
// Winners/Losers split, and the day's Statcast superlatives — all consumed by
// the Day Recap digest box. That box was retired in favor of per-card pills on
// each game's own result card (dayHighlights.js's classifyGameCards, classified
// live in the browser from feeds the flip cards already fetch), which left the
// three sections generated but read by nobody. They're gone; don't re-add a
// section here without a consumer landing in the same change.
//
// It is keyed by sport level because the UI can switch between MLB and the
// four full-season MiLB levels on the same date. Run with --date=YYYY-MM-DD;
// without it, generate yesterday's completed slate. A failed individual game
// is skipped so one bad Stats API response does not erase the rest of a day.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { fileURLToPath } from 'node:url'
import { computeTopPerformers } from '../src/api/topPerformers.js'

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
    // A postponed/cancelled game can still carry a 'Final' abstract state but
    // has no box score — an empty 0-0 line would read as a real result to
    // every selector downstream. GameSelect excludes them the same way
    // (selectGameStatus.isPostponed); mirror it here.
    .filter((game) => !/postponed|cancel/i.test(game.status?.detailedState ?? ''))
    .map((game) => normalizeGame(game, sportId, dateStr))
    .filter((game) => game?.abstractState === 'Final')
}

async function readJsonOrEmpty(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function buildSport(dateStr, sportId) {
  const games = await scheduleFor(dateStr, sportId)
  if (!games.length) return null

  // The prospect snapshot is only used to attach existing rank badges; it is
  // not part of the expensive game scan and can be absent safely.
  const prospects = await readJsonOrEmpty(
    join(here, '..', 'public', 'data', 'top-prospects.json'),
    { players: [], orgProspects: [] },
  )
  // computeTopPerformers does its own per-game fetching (the light boxscore +
  // win probability, via topPerformers.js's buildWpaMaps). This script used to
  // ALSO pull every game's full feed/live for the three retired sections; that
  // second, far heavier pass is gone with them.
  const topPerformers = await computeTopPerformers({ games, prospects, dateStr })

  // Every game's fetch failing leaves both leaderboards empty. Report that as
  // null so the merge below keeps this level's previously-good data instead of
  // overwriting it with a blank — the same protection the old "no game feed
  // loaded" guard gave.
  if (!topPerformers.batters.length && !topPerformers.pitchers.length) return null
  return { topPerformers }
}

const dateStr = parseDate(process.argv.slice(2))
const outPath = join(outDir, `${dateStr}.json`)
const results = await Promise.all(
  SPORT_IDS.map(async (sportId) => [sportId, await buildSport(dateStr, sportId)]),
)
const built = Object.fromEntries(results.filter(([, value]) => value))
// Merge over any prior recap for this date: a level whose game feeds all failed
// this run (buildSport → null) keeps its previously-good data rather than being
// dropped, so re-running a date during a Stats API hiccup can't thin or blank a
// recap that was already complete. Freshly-built levels always win.
const prior = await readJsonOr(outPath, { bySportId: {} })
const bySportId = { ...(prior.bySportId ?? {}), ...built }
await writeJsonAtomic(outPath, { version: 1, date: dateStr, generatedAt: new Date().toISOString(), bySportId }, 2)
console.log(
  `Wrote day recap for ${dateStr}: ${Object.keys(bySportId).length} levels ` +
    `(${Object.keys(built).length} rebuilt this run)`,
)
