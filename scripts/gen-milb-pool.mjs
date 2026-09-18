// Regenerates public/data/milb-pool/{11,12,13,14}.json — a CHECKED pool of
// minor-league games from the season that just ended, for the picked-game card
// on the offseason home page (issue #1077, step 3 of #1038).
//
// WHY A STORED POOL AT ALL. The card's promise is "here is a game, score it",
// and a promise a page cannot keep is worse than no card. A minor-league
// schedule row is not evidence that a game was played, let alone that it can be
// scored: 1,980 rows came back for High-A 2026 and every single one of them
// said "Final" — the status string is useless at this level (the #1031 trap,
// recorded again in ADR-0074's probe). So the pool is eligibility-checked
// against each game's OWN feed before a reader is ever offered it, which is the
// one piece of this card that cannot happen on a phone at render time.
//
// THE GATE IS THE SCORING FLOW'S OWN NEEDS, and nothing else:
//
//   plays      every play placed in an inning and a half — InningViewer's spine
//   lineups    nine in each batting order — the lineup pages the card opens on
//   pitchers   at least one a side, so the Pitchers table has a row to draw
//
// It does NOT demand nine innings (a seven-inning doubleheader game is a real
// game), pitch tracking (there is none at AA or A+ — 0 of 85 sampled games) or
// a bottom ninth. Probe 1b measured 135 of 135 sampled games complete across
// all four levels, so this check is expected to reject almost nothing. It is
// built anyway, because it costs one call and it fails CLOSED: a game that
// cannot be checked does not enter the pool.
//
// ONE CALL PER GAME, AND IT CARRIES EVERYTHING. `fields=` turns the live feed
// from 686 KB into 17 KB, and that 17 KB holds the plays, both batting orders,
// both pitcher lists and every batter who appeared. So the gate and the reason
// line's fuel come out of the same request.
//
// WHAT IS NOT IN THE OUTPUT, DELIBERATELY: no score, no run total, no winner,
// no inning count and no linescore of any kind. The linescore is hydrated onto
// the schedule call to learn whether a game was PLAYED, and then only the
// length of its innings array is read — never a number inside it. An inning
// count is itself a spoiler (ADR-0008: extra innings never show up front), so
// it is not stored either. The file this writes is a list of invitations.
//
// THE POOL IS FROZEN PER SEASON. A completed season's games do not change, so
// the expensive half runs once — the night the level's winter opens — and every
// nightly run after it re-derives only the reason lines, from the roster cache
// in scripts/data/, with no network at all. Pass --rebuild to force the scan.
//
// Run by hand: node scripts/gen-milb-pool.mjs [--rebuild] [--level=13]
// Nightly: .github/workflows/update-nightly-data.yml
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { mapConcurrent } from './lib/concurrency.mjs'
import { getJson } from './lib/statsapi.mjs'
import { levelOffseasonPhase } from '../src/lib/time/seasonPhase.js'
import { movedUpIds, poolSeasonFor, reasonFacts, selectPool } from './lib/milb-pool.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'public', 'data')
const outDir = join(dataDir, 'milb-pool')
// The roster cache is this generator's working state, not something a browser
// reads, so it sits in scripts/data/ beside milb-alumni-scan.json rather than
// in public/. It is what makes the nightly re-derivation free.
const cachePath = join(here, 'data', 'milb-pool-scan.json')

const LEVEL_SPORT_IDS = [11, 12, 13, 14]
// How many checked games each level ships. A reader scores a handful of games
// across a whole winter, so this is variety rather than inventory — 120 entries
// is ~30 KB on the wire and every club at the level appears several times over.
const POOL_SIZE = 120
// No club may hold more than this share of the pool. A uniform draw already
// spreads (each club plays ~132 games of ~1,900), but a cap makes it a promise
// rather than a probability, and the card's own "another game" is the control a
// reader would otherwise have to press past one club's season.
const PER_CLUB_CAP = 12
// Candidates walked before a level gives up. The gate rejects almost nothing,
// so this only bounds a bad night at statsapi.
const MAX_CHECKS = 200
const CONCURRENCY = 6

const args = process.argv.slice(2)
const rebuild = args.includes('--rebuild')
const onlyLevel = Number(args.find((a) => a.startsWith('--level='))?.split('=')[1]) || null

const today = new Date().toISOString().slice(0, 10)

// The level's own leagues, which is the only reading of a minor-league season's
// end that ADR-0079 allows: the sport-wide season row disagreed with the
// leagues by a day in 2025, in the direction that would have called a winter
// over a league still playing.
async function leagueRows(sportId, season) {
  try {
    const data = await getJson(
      `/api/v1/league?sportId=${sportId}&season=${season}` +
        `&fields=leagues,id,name,seasonDateInfo,regularSeasonStartDate,` +
        `seasonEndDate,offseasonStartDate`,
    )
    const rows = (data.leagues ?? []).map((league) => ({
      leagueId: league.id,
      ...(league.seasonDateInfo ?? {}),
    }))
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

// Every regular-season row for a level's season, in ONE call, with the linescore
// hydrated so "was it played" comes off the game rather than off its status
// string. 1.4 MB for a full High-A season, and the only bulk request here.
async function seasonRows(sportId, season) {
  const data = await getJson(
    `/api/v1/schedule?sportId=${sportId}&season=${season}&gameType=R&hydrate=linescore,team` +
      `&fields=dates,date,games,gamePk,gameNumber,officialDate,venue,name,teams,away,home,` +
      `team,id,name,abbreviation,parentOrgId,parentOrgName,linescore,innings,num`,
  )
  const seen = new Map()
  for (const day of data.dates ?? []) {
    for (const game of day.games ?? []) {
      // The schedule repeats a game across `dates` entries; the first one wins.
      if (!seen.has(game.gamePk)) seen.set(game.gamePk, game)
    }
  }
  return [...seen.values()]
}

// The one call per candidate. Returns the roster ids when the game passes the
// scoring flow's gate, and null when it does not or cannot be read — a thrown
// request is a rejection, never a retry that silently admits an unchecked game.
async function checkGame(gamePk) {
  let feed
  try {
    feed = await getJson(
      `/api/v1.1/game/${gamePk}/feed/live?fields=liveData,plays,allPlays,about,` +
        `inning,halfInning,boxscore,teams,away,home,battingOrder,batters,pitchers`,
    )
  } catch {
    return null
  }
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const box = feed?.liveData?.boxscore?.teams ?? {}
  if (plays.length === 0) return null
  // Every play placed. A play with no inning is one InningViewer cannot file.
  if (!plays.every((p) => p?.about?.inning && p?.about?.halfInning)) return null

  const ids = []
  for (const side of ['away', 'home']) {
    const team = box?.[side]
    if ((team?.battingOrder ?? []).length < 9) return null
    if ((team?.pitchers ?? []).length < 1) return null
    for (const id of team.batters ?? []) ids.push(id)
    for (const id of team.pitchers ?? []) ids.push(id)
  }
  return [...new Set(ids)]
}

function clubOf(side) {
  const team = side?.team ?? {}
  return {
    id: team.id,
    name: team.name ?? '',
    abbr: team.abbreviation ?? '',
    org: team.parentOrgId ?? null,
    orgName: team.parentOrgName ?? '',
  }
}

// The fuel the reason line is written from. Every file is already on disk and
// already regenerated by another job in the same nightly run, so this generator
// makes no request for any of it: the prospect board is rescraped weekly, the
// promotions board nightly, and a club's big-league alumni nightly.
async function reasonSources() {
  const prospects = await readJsonOr(join(dataDir, 'top-prospects.json'), {})
  const board = await readJsonOr(join(dataDir, 'minors-leaders.json'), {})
  return {
    prospects,
    movers: movedUpIds(board?.leaders),
    moversSeason: Number(board?.season) || null,
    byClub: new Map(),
  }
}

// A club's big-league alumni, read on demand and remembered — only the clubs
// actually in a pool are ever opened, and a club with no file (a farm club that
// has sent nobody up, or one that moved) reads as an empty set rather than a
// failure.
async function alumniIdsFor(cache, teamId) {
  if (!cache.has(teamId)) {
    const file = await readJsonOr(join(dataDir, 'milb-alumni', `${teamId}.json`), null)
    cache.set(teamId, new Set((file?.players ?? []).map((p) => Number(p.id))))
  }
  return cache.get(teamId)
}

async function buildLevel(sportId, cache, sources) {
  const year = Number(today.slice(0, 4))
  const rows = await leagueRows(sportId, year)
  const season = poolSeasonFor(levelOffseasonPhase(today, rows), year)

  const key = String(sportId)
  const scan = cache[key]?.season === season ? cache[key] : { season, games: {} }
  cache[key] = scan

  const existing = await readJsonOr(join(outDir, `${sportId}.json`), null)
  const fresh =
    !rebuild && existing?.season === season && (existing?.games ?? []).length >= POOL_SIZE

  let games = existing?.games ?? []
  if (fresh) {
    console.log(`  sportId ${sportId}: ${season} pool already checked (${games.length} games)`)
  } else {
    const all = await seasonRows(sportId, season)
    // PLAYED, off the game's own linescore. Not the status string, which says
    // "Final" for all 1,980 rows of a High-A season, postponements included.
    const played = all.filter((g) => (g?.linescore?.innings ?? []).length > 0)
    console.log(`  sportId ${sportId}: ${season} — ${all.length} rows, ${played.length} played`)
    if (played.length === 0) {
      // An empty season is not an answer (the January trap that #1122 fixed in
      // gen-minors-leaders.mjs): keep whatever pool is already on disk.
      console.log(`  sportId ${sportId}: no played games — keeping the file as it is`)
      return existing
    }

    const candidates = selectPool(played, { sportId, season, cap: PER_CLUB_CAP, max: MAX_CHECKS })
    const checked = []
    await mapConcurrent(candidates, CONCURRENCY, async (game) => {
      if (checked.length >= POOL_SIZE) return
      const known = scan.games[game.gamePk]
      const ids = known !== undefined ? known : await checkGame(game.gamePk)
      scan.games[game.gamePk] = ids
      if (ids) checked.push({ game, ids })
    })
    const kept = checked.slice(0, POOL_SIZE)
    console.log(`  sportId ${sportId}: ${candidates.length} candidates, ${kept.length} kept`)
    games = kept.map(({ game }) => ({
      pk: game.gamePk,
      date: game.officialDate,
      ...(game.gameNumber > 1 ? { g: game.gameNumber } : {}),
      venue: game.venue?.name ?? game.teams?.home?.team?.venue?.name ?? '',
      away: clubOf(game.teams?.away),
      home: clubOf(game.teams?.home),
    }))
  }

  // The reason line is re-derived on EVERY run, pool or no pool: the prospect
  // board is rescraped weekly and a frozen count would go on claiming a rank a
  // player no longer holds. It costs no request — the rosters are in the cache.
  const withWhy = []
  for (const entry of games) {
    const ids = scan.games[entry.pk]
    if (!ids) continue
    const alumni = new Set([
      ...(await alumniIdsFor(sources.byClub, entry.away.id)),
      ...(await alumniIdsFor(sources.byClub, entry.home.id)),
    ])
    const why = reasonFacts(ids, {
      prospects: sources.prospects,
      movers: sources.movers,
      alumni,
      staleMovers: sources.moversSeason !== season,
    })
    withWhy.push({ ...entry, why })
  }

  return { sportId, season, generatedAt: new Date().toISOString(), games: withWhy }
}

// Rewrite only when something other than the timestamp moved. A generator that
// dirties four files a night on generatedAt alone buries the runs that changed
// something real (the churn lesson gen-contracts-shards.mjs learned).
async function writeIfChanged(path, next) {
  const prev = await readJsonOr(path, null)
  const strip = (doc) => JSON.stringify({ ...doc, generatedAt: null })
  if (prev && strip(prev) === strip(next)) return false
  await writeJsonAtomic(path, next)
  return true
}

const cache = (await readJsonOr(cachePath, null)) ?? {}
const sources = await reasonSources()
const levels = onlyLevel ? [onlyLevel] : LEVEL_SPORT_IDS

console.log(`Checking minor-league game pools (${today})`)
for (const sportId of levels) {
  const doc = await buildLevel(sportId, cache, sources)
  if (!doc) continue
  const changed = await writeIfChanged(join(outDir, `${sportId}.json`), doc)
  console.log(
    `  sportId ${sportId}: ${doc.games.length} games, season ${doc.season}` +
      `${changed ? '' : ' (unchanged)'}`,
  )
}
await writeJsonAtomic(cachePath, cache)
console.log('Done.')
