// Regenerates public/data/doubleheaders.json — every completed MLB
// regular-season DOUBLEHEADER from 2004 to the current season, one row per
// PAIR, with each side's wins in that pair.
//
// WHY A PAIR AND NOT A GAME. Everything the report page asks is a question
// about the pair, not about either game in it: a club's record in
// doubleheader games, how often it took both, how often it dropped both. Two
// game rows would make the sweep counts a join the page has to redo on every
// slider move; one pair row makes them a sum. The per-game record falls out of
// the same row (a club's wins are its side's number, its losses are the other
// side's), so nothing is lost.
//
// WHAT COUNTS AS A DOUBLEHEADER. Two regular-season games between the SAME two
// clubs on the SAME day, both Final, with statsapi's `doubleHeader` flag on at
// least one of them — 'Y' (traditional, one admission) or 'S' (split
// admission). Both kinds count; the flag distinguishes how tickets were sold,
// not whether a club played twice in a day.
//
// WHAT IS DROPPED, AND WHY IT HAS TO BE. A scheduled doubleheader whose second
// game is rained out leaves ONE Final game carrying a doubleHeader flag. That
// is a club playing once, and folding it in would put single games into a
// doubleheader record. Such days are counted (`incomplete`) rather than
// silently discarded, so the number is visible if it ever stops being small.
// A game that ends tied (Final with equal scores — rare, and possible after a
// called game) counts toward neither side's wins; the pair still counts.
//
// FULL REBUILD, not incremental. Twenty-three seasons is twenty-three schedule
// requests with a narrow `fields` filter, which is a few seconds — cheaper than
// the bookkeeping an append-only archive would need, and it means a fix to the
// pairing rule reaches the whole history on the next run instead of only the
// tail. Past seasons are frozen anyway; only the current one changes.
//
// SPOILER-SAFE on the same footing as gen-comeback-wins.mjs: a season-level
// aggregate over FINAL games carries no live-game score, and the page it feeds
// (/doubleheaders) never prints an individual game's runs — only records,
// sweep counts and opponent totals.
//
// Run by hand:
//   node scripts/gen-doubleheaders.mjs
//   node scripts/gen-doubleheaders.mjs --from=2019   # a shorter sweep, for a test
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'doubleheaders.json')

// 2004 is the floor the report page opens on, and it is also about as far back
// as the schedule feed's doubleHeader flag can be trusted without spot-checking
// every season by hand.
export const FIRST_SEASON = 2004

// Only what the pairing rule reads. Without this filter a season's schedule is
// several megabytes of broadcast and venue detail we throw away.
const FIELDS = [
  'dates',
  'date',
  'games',
  'gamePk',
  'gameType',
  'doubleHeader',
  'gameNumber',
  'status',
  'codedGameState',
  'teams',
  'away',
  'home',
  'team',
  'id',
  'score',
  'isWinner',
].join(',')

function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a)
    if (m) args[m[1]] = m[2] ?? true
  }
  return args
}

// A game statsapi has actually finished. 'F' is Final and 'O' is "Game Over" —
// the state a just-ended game sits in for a few minutes before it is Final, and
// the one the rest of this app already treats as decided.
const isFinal = (g) => g?.status?.codedGameState === 'F' || g?.status?.codedGameState === 'O'

// Group one season's games into candidate doubleheader days: same date, same
// two clubs. Exported for the unit test, which feeds it hand-built days rather
// than a live season.
//
// THE KEY IS AN UNORDERED PAIR, and that is not a tidiness choice. A makeup
// doubleheader routinely SWAPS which club is home between its two games — the
// second game is the postponed one being played at the wrong park, so the
// visiting club bats last. 2020-08-05 has two of them (143 at 147 then 147 at
// 143; 146 at 110 then 110 at 146). Keying on away|home splits every one of
// those into two lone games and drops the whole doubleheader as incomplete —
// it cost 2020 more than twenty real pairs before this was caught. Sorting the
// two ids into a stable order keys the DAY, which is what a doubleheader is.
export function pairsFromGames(games) {
  const byDay = new Map()
  for (const g of games) {
    const away = g?.teams?.away?.team?.id
    const home = g?.teams?.home?.team?.id
    if (!away || !home || !g.date) continue
    const [low, high] = away < home ? [away, home] : [home, away]
    const key = `${g.date}|${low}|${high}`
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(g)
  }

  const pairs = []
  let incomplete = 0
  for (const [key, day] of byDay) {
    // The flag can sit on either game of the pair, so ask the day, not a game.
    const flagged = day.some((g) => g.doubleHeader === 'Y' || g.doubleHeader === 'S')
    if (!flagged) continue
    const played = day.filter(isFinal)
    if (played.length < 2) {
      // A doubleheader whose second game was rained out, or one postponed
      // whole. Either way the clubs did not play twice.
      incomplete += 1
      continue
    }
    // Three Final games between two clubs on one date is not something the feed
    // should produce. Take the first two by game number rather than guessing.
    const [gameA, gameB] = played
      .slice()
      .sort((x, y) => (x.gameNumber ?? 0) - (y.gameNumber ?? 0))
    const [date, lowId, highId] = key.split('|')
    const low = Number(lowId)
    let lowWins = 0
    let highWins = 0
    for (const g of [gameA, gameB]) {
      const winner = g?.teams?.away?.isWinner
        ? g.teams.away.team.id
        : g?.teams?.home?.isWinner
          ? g.teams.home.team.id
          : null
      // No winner: a tie. Counted in the pair, credited to no one.
      if (winner == null) continue
      if (winner === low) lowWins += 1
      else highWins += 1
    }
    pairs.push([date, low, Number(highId), lowWins, highWins])
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]))
  return { pairs, incomplete }
}

async function seasonPairs(season) {
  const path =
    `/api/v1/schedule?sportId=1&season=${season}&gameType=R&fields=${encodeURIComponent(FIELDS)}`
  const json = await getJson(path)
  const games = (json?.dates ?? []).flatMap((d) => (d.games ?? []).map((g) => ({ ...g, date: d.date })))
  return pairsFromGames(games)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const from = Number(args.from) || FIRST_SEASON
  const to = Number(args.to) || new Date().getUTCFullYear()

  const seasons = {}
  let incompleteTotal = 0
  for (let season = from; season <= to; season += 1) {
    const { pairs, incomplete } = await seasonPairs(season)
    incompleteTotal += incomplete
    // A season with no completed doubleheader at all is still recorded, as an
    // empty list: the page's year slider has to know the season EXISTS, and an
    // absent key would read the same as a season that has not been fetched.
    seasons[season] = pairs
    console.log(`${season}: ${pairs.length} doubleheaders${incomplete ? ` (${incomplete} incomplete)` : ''}`)
  }

  const payload = {
    generated: new Date().toISOString().slice(0, 10),
    firstSeason: from,
    lastSeason: to,
    incomplete: incompleteTotal,
    // [date, teamA, teamB, teamAWins, teamBWins] per pair, per season. The two
    // club ids are sorted, low first; see pairsFromGames for why the pair is
    // unordered rather than away/home.
    columns: ['date', 'teamA', 'teamB', 'teamAWins', 'teamBWins'],
    seasons,
  }
  await writeJsonAtomic(out, payload)
  const total = Object.values(seasons).reduce((n, p) => n + p.length, 0)
  console.log(`\nWrote ${out} — ${total} doubleheaders, ${from}–${to}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
