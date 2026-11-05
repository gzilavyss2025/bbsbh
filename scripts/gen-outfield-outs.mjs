// Regenerates public/data/outfield-outs/{season}.json — every regular-season
// team-game in which the batting club made NO out to an outfielder (issue #2976,
// the data half: "Kept it in the infield"). Hits to the outfield are allowed;
// the census counts them as `ofHits` on each qualifier.
//
// WHAT IT STORES. For each qualifier: gamePk, date, the batting club's id, the
// opponent's id and the OF-hit count. Per season: the near-miss count (exactly
// one OF out), the team-game total, and the excluded counts. It stores NO score,
// NO winner and NO inning, the same stance as gen-long-at-bats.mjs.
//
// THE RULES live in scripts/lib/outfield/outfield-outs.mjs (the classifier) and are
// tested in test/outfield-outs.test.js. The two guards:
//   - empty feed: a game marked Final whose playByPlay holds no plate
//     appearance (632457, 746577, 823490) is excluded whole.
//   - coverage: a team-game whose balls in play name a fielder on fewer than
//     COVERAGE_MIN of them is excluded from the census (not counted as 0/0).
//
// ONE TRIMMED CALL PER GAME. `playByPlay?fields=…` with the fields the
// classifier reads; the pitch events never come down the wire.
//
// INCREMENTAL, KEYED BY SEASON. A Final game is immutable, so a run reads only
// gamePks not already in scripts/data/outfield-outs-scan.json, and each season
// file is exported from the scan. The default season is season-in-play, not the
// calendar year (#1465), so a January run does not open an empty new season.
//
// Run by hand:
//   node scripts/gen-outfield-outs.mjs                 # games not yet seen
//   node scripts/gen-outfield-outs.mjs --season=2024   # a specific season
//   node scripts/gen-outfield-outs.mjs --rescan        # re-ingest every game
//   node scripts/gen-outfield-outs.mjs --from=2021 --to=2026   # backfill range
// Nightly: .github/workflows/update-nightly-data.yml
import { join } from 'node:path'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { mapConcurrent } from './lib/concurrency.mjs'
import { getJson } from './lib/statsapi.mjs'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'
import { parseArgs, strOpt } from './lib/args.mjs'
import {
  COVERAGE_MIN,
  coverageOk,
  gameIsScorable,
  outfieldOutsFor,
} from './lib/outfield/outfield-outs.mjs'

const here = import.meta.dirname
const outDir = join(here, '..', 'public', 'data', 'outfield-outs')
const scanPath = join(here, 'data', 'outfield-outs-scan.json')

// 16–24 is the agreed range for the one-time backfill (about 14.6k calls).
const CONCURRENCY = 20
const CHECKPOINT_EVERY = 500

// Only the fields the classifier reads. Matches test/fixtures/outfield-outs/.
const PLAY_FIELDS =
  'allPlays,result,type,eventType,about,halfInning,matchup,batter,id,runners,details,runner,credits,position,code,playEvents,hitData,location'

const args = process.argv.slice(2)
const opts = parseArgs(args)
const rescan = args.includes('--rescan')
const onlySeason = Number(strOpt(opts, 'season')) || null
const fromSeason = Number(strOpt(opts, 'from')) || null
const toSeason = Number(strOpt(opts, 'to')) || null

const today = new Date().toISOString().slice(0, 10)

// Every FINAL regular-season game of a season, one per gamePk. Final games with
// no innings are KEPT: the feed guard (gameIsScorable) counts them as excluded
// games, so the census shows them instead of silently dropping them. Those are
// the 0-PA games (632457, 746577, 823490) the schedule still marks Final.
async function regularGames(season) {
  const data = await getJson(
    `/api/v1/schedule?sportId=1&season=${season}&gameType=R&hydrate=team` +
      `&fields=dates,games,gamePk,gameType,officialDate,status,abstractGameState,` +
      `teams,away,home,team,id`,
  )
  const seen = new Map()
  for (const day of data.dates ?? []) {
    for (const g of day.games ?? []) {
      if (g?.status?.abstractGameState !== 'Final') continue
      if (!seen.has(g.gamePk)) seen.set(g.gamePk, g)
    }
  }
  return [...seen.values()]
}

// One game's per-half tallies, or null when the feed cannot be read. A thrown
// request is a skip, never a half-read game in a census: it comes back next run.
async function scanGame(gamePk) {
  let data
  try {
    data = await getJson(`/api/v1/game/${gamePk}/playByPlay?fields=${PLAY_FIELDS}`)
  } catch {
    return null
  }
  const plays = data?.allPlays ?? []
  if (!gameIsScorable(plays)) return { empty: true }
  const half = (h) => {
    const t = outfieldOutsFor(plays, h)
    return { ofOuts: t.ofOuts, ofHits: t.ofHits, pa: t.plateAppearances, balls: t.coverage.balls, fielded: t.coverage.fielded }
  }
  return { empty: false, away: half('top'), home: half('bottom') }
}

// The census of one season from the scan. Team-games come from the schedule's
// games; the scan supplies the tallies. Excluded: whole empty-feed games, and
// single team-games whose coverage fails.
function seasonDoc(season, games, scanGames, generatedAt) {
  let teamGames = 0
  let excludedGames = 0
  let excludedTeamGames = 0
  let nearMiss = 0
  const qualifiers = []
  for (const game of games) {
    const entry = scanGames[game.gamePk]
    if (!entry) continue
    if (entry.empty) {
      excludedGames += 1
      continue
    }
    const sides = [
      { t: entry.away, team: game.teams?.away?.team?.id ?? null, opp: game.teams?.home?.team?.id ?? null },
      { t: entry.home, team: game.teams?.home?.team?.id ?? null, opp: game.teams?.away?.team?.id ?? null },
    ]
    for (const { t, team, opp } of sides) {
      teamGames += 1
      if (!coverageOk({ balls: t.balls, fielded: t.fielded })) {
        excludedTeamGames += 1
        continue
      }
      if (t.ofOuts === 0) {
        qualifiers.push({ gamePk: game.gamePk, date: game.officialDate, teamId: team, oppId: opp, ofHits: t.ofHits })
      } else if (t.ofOuts === 1) {
        nearMiss += 1
      }
    }
  }
  qualifiers.sort((a, b) => (a.date === b.date ? a.gamePk - b.gamePk : a.date < b.date ? -1 : 1))
  return {
    season,
    generatedAt,
    coverageMin: COVERAGE_MIN,
    teamGames,
    excludedGames,
    excludedTeamGames,
    nearMiss,
    qualifiers,
  }
}

async function runSeason(season, scanFile) {
  const key = String(season)
  const scan = scanFile[key] ?? { games: {} }
  scanFile[key] = scan

  const games = await regularGames(season)
  const todo = games.filter((g) => rescan || !scan.games[g.gamePk])
  console.log(`Outfield outs ${season}: ${games.length} final games, ${todo.length} to read`)

  let done = 0
  await mapConcurrent(todo, CONCURRENCY, async (game) => {
    const entry = await scanGame(game.gamePk)
    if (entry) scan.games[game.gamePk] = entry
    done += 1
    if (done % CHECKPOINT_EVERY === 0) {
      await writeJsonAtomic(scanPath, scanFile)
      console.log(`  …${done}/${todo.length}`)
    }
  })
  await writeJsonAtomic(scanPath, scanFile)

  const doc = seasonDoc(season, games, scan.games, new Date().toISOString())
  const path = join(outDir, `${season}.json`)
  const prev = await readJsonOr(path, null)
  const strip = (d) => JSON.stringify({ ...d, generatedAt: null })
  if (!prev || strip(prev) !== strip(doc)) await writeJsonAtomic(path, doc)
  console.log(
    `  ${doc.qualifiers.length} qualifiers, ${doc.nearMiss} near misses, ` +
      `${doc.teamGames} team-games (${doc.excludedGames} games and ${doc.excludedTeamGames} team-games excluded)`,
  )
}

async function main() {
  const seasons = []
  if (onlySeason) seasons.push(onlySeason)
  else if (fromSeason && toSeason) for (let s = fromSeason; s <= toSeason; s++) seasons.push(s)
  else seasons.push(await fetchSeasonInPlay())

  const scanFile = (await readJsonOr(scanPath, null)) ?? {}
  console.log(`Outfield outs: ${seasons.join(', ')} (${today})`)
  for (const season of seasons) await runSeason(season, scanFile)
  console.log('Done.')
}

await main()
