// Regenerates public/data/schedule-shape/{teamId}.json — the multi-season
// ledger of WHERE and WHEN each club played, and whether it won, cut into the
// three segments a drought is counted in: the series, the homestand, and the
// road trip.
//
// This is the dataset behind questions of the form "the last time they won
// game 1 of a road trip was July 3rd" — a family the app had no way to answer,
// because answering it needs the SHAPE of a schedule (which games open a trip,
// which close a series) across more than one season. src/api/scheduleShape.js
// is the reader; docs/schedule-shape.md is the catalog of what the shape
// supports, and which candidate stats were measured and rejected.
//
// CHEAP ON PURPOSE. One request per season covers all thirty clubs:
//   GET /api/v1/schedule?sportId=1&season=Y&gameType=R
// with `fields=` pruning the response to ~650 KB. A twelve-season rebuild is
// twelve requests and about eight seconds, so this generator has no
// incremental mode and no scan table — it rebuilds the whole range every run.
// That is a deliberate difference from gen-team-records.mjs, whose three
// calls per game make a full rebuild a ~73,000-request proposition and force
// an append-only design. Nothing here is worth the complexity of resuming.
//
// STORES FACTS, NOT FLAGS. The shipped row is [mmdd, opponentId, site,
// result] and nothing else; every segment tag — opener, finale, trip length —
// is recomputed by the reader from the ordered rows. So a changed definition
// of "road trip" is a change to src/api/scheduleShape.js alone, with no
// regeneration at all. scripts/lib/team-records.mjs's header makes the long
// version of this argument; the taggers themselves live in
// scripts/lib/schedule-shape.mjs so test/schedule-shape.test.js can import
// them without running this file.
//
// FINAL GAMES ONLY, and the season floor is 2015 (EARLIEST_SEASON). Both are
// spoiler-relevant as well as correctness-relevant: a ledger that admitted a
// live or scheduled game would carry tonight's state, and this file is read on
// an open surface. See the reader's header.
//
// Run by hand:
//   node scripts/gen-schedule-shape.mjs                # 2015 → current season
//   node scripts/gen-schedule-shape.mjs --since=2023   # a shorter range
//   node scripts/gen-schedule-shape.mjs --season=2026  # one season only
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeShards } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { parseArgs } from './lib/args.mjs'
import { homeVenueByTeam, ledgerFor, encodeRow, encodeDetailRow, detailFacts } from './lib/schedule-shape.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'data', 'schedule-shape')

// 2015 is the floor for a practical reason and a data one. Practical: a
// "since" that reaches past a decade stops reading as a drought and starts
// reading as trivia — nobody on the roster was there. Data: the further back
// the sweep goes the more franchise moves and league realignments the club ids
// have to survive, and 2015 is comfortably inside the current thirty-club,
// two-league, six-division shape.
const EARLIEST_SEASON = 2015

// The most recent seasons also carry PER-GAME DETAIL — runs, hits, errors, the
// lead into the 8th and 9th, and a flag word — for the event droughts ("have
// not thrown a shutout since April 26"). Three, not twelve, and the asymmetry
// is the point: an event comes around every twenty games or so, so the longest
// drought a club can plausibly be carrying is a season or two, while the
// opponent-narrowed SLOT droughts need a decade because a club visits any one
// park twice a year. Detail costs `hydrate=linescore`, which is 2.3 MB a season
// against 0.65 MB without it — affordable for all twelve, and still not taken,
// because the bytes would land in every reader's download for facts no drought
// could reach.
const DETAIL_SEASONS = 3

// The response is pruned to the eight facts the ledger needs. Without this the
// same call returns ~4 MB per season of content links, broadcast lists and
// record objects nothing here reads.
const FIELDS = [
  'dates', 'games', 'gamePk', 'officialDate', 'gameNumber', 'doubleHeader',
  'teams', 'away', 'home', 'team', 'id', 'score', 'isWinner',
  'venue', 'status', 'codedGameState',
].join(',')

// The same list plus what a linescore carries. Pruning matters more here, not
// less: an unpruned `hydrate=linescore` season is 10.3 MB against 2.3 MB with
// this, and the difference is entirely defense, offense, balls/strikes/outs and
// per-inning leftOnBase that nothing reads.
const DETAIL_FIELDS = [
  FIELDS, 'linescore', 'scheduledInnings', 'innings', 'num', 'runs', 'hits', 'errors',
].join(',')

// One season of finished regular-season games, flattened out of the feed's
// date buckets.
//
// `codedGameState === 'F'` is the gate, plus a score on both sides. A
// postponed, suspended, cancelled or not-yet-played game answers this call
// with a row and no runs; admitting one would put a null into a W/L ledger and
// invent a loss. The score check is belt-and-braces against a Final game whose
// linescore the feed has not caught up on.
async function fetchSeason(season, withDetail) {
  const query = withDetail
    ? `hydrate=linescore&fields=${DETAIL_FIELDS}`
    : `fields=${FIELDS}`
  const feed = await getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=R&${query}`)
  const games = []
  // A season's schedule lists some games TWICE, under two different `dates[]`
  // buckets — 37 of them across 2015-2026, every one byte-identical in date,
  // teams and score. Left in, a duplicate lengthens the series it falls inside
  // by a game and adds a chance to whatever slot it lands in, so a drought
  // counted in chances comes out wrong. Deduplicated on gamePk and NOT on
  // (date, teams): a doubleheader is two real games sharing all three, and
  // the same San Francisco season carries both shapes on separate dates.
  const seen = new Set()
  for (const day of feed?.dates ?? []) {
    for (const g of day?.games ?? []) {
      if (g?.status?.codedGameState !== 'F') continue
      const away = g?.teams?.away
      const home = g?.teams?.home
      if (away?.score == null || home?.score == null) continue
      if (g.gamePk != null) {
        if (seen.has(g.gamePk)) continue
        seen.add(g.gamePk)
      }
      const ls = g.linescore
      games.push({
        date: g.officialDate,
        gameNumber: g.gameNumber ?? 1,
        venueId: g.venue?.id ?? null,
        awayId: away.team?.id,
        homeId: home.team?.id,
        awayScore: away.score,
        homeScore: home.score,
        // Absent on a thin season, and absent on a detail season whose game
        // has no linescore at all — a row that then ships thin rather than
        // wide, which the reader already handles by row length.
        linescore: ls
          ? {
              scheduledInnings: ls.scheduledInnings ?? 9,
              innings: (ls.innings ?? []).map((i) => ({
                a: Number(i?.away?.runs) || 0,
                h: i?.home && i.home.runs != null ? Number(i.home.runs) || 0 : null,
              })),
              awayHits: ls.teams?.away?.hits ?? null,
              homeHits: ls.teams?.home?.hits ?? null,
              awayErrors: ls.teams?.away?.errors ?? null,
              homeErrors: ls.teams?.home?.errors ?? null,
            }
          : null,
      })
    }
  }
  return games
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const thisYear = new Date().getFullYear()
  const seasons = args.season
    ? [Number(args.season)]
    : range(Math.max(EARLIEST_SEASON, Number(args.since) || EARLIEST_SEASON), thisYear)

  // teamId -> { [season]: rows }. Built club-by-club per season rather than in
  // one pass because ledgerFor needs the season's OWN home-venue table: a club
  // that moved parks mid-range has a different answer every year, and a table
  // built across the whole range would resolve one of those seasons wrong.
  const byTeam = new Map()
  let totalGames = 0
  const detailFrom = Math.max(...seasons) - DETAIL_SEASONS + 1
  for (const season of seasons) {
    const withDetail = season >= detailFrom
    let games
    try {
      games = await fetchSeason(season, withDetail)
    } catch (err) {
      // A single season's failure must not empty every shard: writeShards
      // rewrites the whole directory, so a partial in-memory result would ship
      // as a truncated ledger that looks complete. Abort loudly instead.
      throw new Error(`season ${season} failed (${err.message}) — no files written`)
    }
    if (!games.length) {
      console.log(`  ${season}: no final games yet, skipped`)
      continue
    }
    const homeVenues = homeVenueByTeam(games)
    const teamIds = [...new Set(games.flatMap((g) => [g.awayId, g.homeId]))].filter(Boolean)
    for (const teamId of teamIds) {
      const ledger = ledgerFor(games, teamId, homeVenues)
      const rows = ledger.map((row) => {
        if (!withDetail) return encodeRow(row)
        const g = row.source
        if (!g?.linescore?.innings?.length) return encodeRow(row)
        const isHome = g.homeId === teamId
        const d = detailFacts({
          innings: g.linescore.innings,
          scheduledInnings: g.linescore.scheduledInnings,
          isHome,
        })
        return encodeDetailRow(
          {
            ...row,
            runsFor: isHome ? g.homeScore : g.awayScore,
            runsAgainst: isHome ? g.awayScore : g.homeScore,
            hits: isHome ? g.linescore.homeHits : g.linescore.awayHits,
            oppHits: isHome ? g.linescore.awayHits : g.linescore.homeHits,
            errors: isHome ? g.linescore.homeErrors : g.linescore.awayErrors,
            oppErrors: isHome ? g.linescore.awayErrors : g.linescore.homeErrors,
          },
          d,
        )
      })
      if (!byTeam.has(teamId)) byTeam.set(teamId, {})
      byTeam.get(teamId)[season] = rows
    }
    totalGames += games.length
    console.log(`  ${season}: ${games.length} final games, ${teamIds.length} clubs${withDetail ? ' (with detail)' : ''}`)
  }

  if (!byTeam.size) throw new Error('no seasons returned any games — no files written')

  // No `generatedAt` on a shard. Thirty committed files on a nightly cron must
  // not all churn on a timestamp alone — the trap gen-milb-alumni.mjs records
  // in docs/scripts/generators.md, where a re-run dirties every file and a
  // reviewer cannot see which ones actually changed. The season keys already
  // say how current the file is.
  const entries = [...byTeam].map(([teamId, seasons]) => [String(teamId), { teamId, seasons }])
  const { written, swept } = await writeShards(OUT_DIR, entries)
  console.log(`schedule-shape: ${written} shards written, ${swept} swept (${totalGames} games over ${seasons.length} seasons)`)
}

function range(from, to) {
  const out = []
  for (let y = from; y <= to; y++) out.push(y)
  return out
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
