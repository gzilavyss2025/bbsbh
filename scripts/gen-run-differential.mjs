// Regenerates public/data/run-differential.json — every MLB club season since
// 1901 that outscored its opponents by at least +150 runs, and what that club
// then did in the postseason.
//
// THE QUESTION THE PAGE ASKS. A club that wins by 200 runs over a season was
// not lucky; it was better. The page asks whether being better survives
// October. The answer changes by era, and it does not change in the direction
// most people expect — so the file has to carry enough history to show the
// change, not only the recent seasons that prompted the question.
//
// WHY +150 AND NOT +200. The page opens on +200, which is the round number
// people ask about, but its threshold control moves between +150 and +350. A
// file cut at exactly +200 would make every step of that control a refetch.
// +150 is ~250 club seasons over 126 years, which is a small file, and it is
// low enough that the control never runs off the bottom of the data.
//
// EVERY NUMBER ON THE PAGE IS DERIVED, NOT ASSUMED. The bracket got deeper four
// times since 1901, and the depth is what the page's era table is built on. It
// would be easy to hard-code "1969 added the LCS, 1995 added the Division
// Series" and be roughly right. This reads the round count off each season's
// own postseason schedule instead, so 1981's extra round (the split-season
// Division Series, which no era rule would predict) lands in the right bucket
// and a future format change needs no edit here.
//
// THREE THINGS A CLUB WITH NO POSTSEASON GAMES CAN MEAN, and the page says all
// three differently. In 1901, 1902, 1904 and 1994 nobody played a postseason at
// all, so a dominant club that year did not miss anything. In 1954 the Yankees
// won 103 games, outscored the league by 242, and stayed home, because one
// pennant per league and no wild card meant the second-best club's season
// simply ended. And in the season being played right now, the bracket is not
// missed or absent — it has not happened yet.
//
// All three are read off the season, never off a year rule. statsapi's season
// record carries a `postSeasonEndDate` only for years that scheduled one, which
// separates the first case exactly; comparing that date to today separates the
// third. So the file records `held` and `complete` per season and states plain
// facts, and the page picks the words.
//
// A SCHEDULED GAME IS NOT A RESULT. statsapi puts the coming postseason on the
// schedule as placeholder games well before the regular season ends — a run of
// this generator on 2026-09-18 saw 53 of them for a bracket nobody had played.
// Every round tally here counts only games where one side carries `isWinner`,
// so a placeholder can never become a series result. This is also what keeps
// the file honest for the current season, whose postseason fills in as it is
// played.
//
// A SUSPENDED GAME APPEARS TWICE, and so does a postponed one: the schedule
// lists the same gamePk under both dates. Counting rows would have given the
// 2011 Yankees a 3-3 Division Series and the 2019 Astros a 3-2 Championship
// Series they actually won 4-2. Rows are deduplicated by gamePk, keeping
// whichever copy carries the decision.
//
// SPOILER-SAFE, on the same footing as gen-doubleheaders.mjs and
// gen-comeback-wins.mjs. Every figure is a season aggregate over finished
// games plus completed postseason series. No individual game's runs appear
// here, the current season's unplayed bracket is excluded by the rule above,
// and the page this feeds is a history report outside the scoring flow — the
// same class as /postseason-history.
//
// FULL REBUILD, not incremental. 126 seasons is three narrow requests each and
// runs in well under a minute. Closed seasons never change, so the cost buys
// the one thing an append-only archive would not: a fix to the pairing or
// naming rule reaches all 126 years on the next run.
//
// Run by hand:
//   node scripts/gen-run-differential.mjs
//   node scripts/gen-run-differential.mjs --from=2015   # a short sweep, for a test
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'run-differential.json')

// 1901 is the first season of the two-league era — the first year the
// American League counted, and the earliest the page's premise holds.
export const FIRST_SEASON = 1901

// The cut. See the header for why it sits below the +200 the page opens on.
export const FLOOR = 150

const AL = 103
const NL = 104

// Postseason rounds, shallowest first. The page's era grouping is the COUNT of
// distinct ranks a season actually played, so this map's job is to collapse
// each league's copy of a round onto one rank — an AL Division Series and an NL
// Division Series are the same depth of bracket, not two.
//
// An unlisted round throws rather than defaulting. A new round name that ranked
// itself 0 would quietly file a champion as a first-round exit, which is the
// one failure this file would not show on its face.
const ROUND_RANK = {
  'AL Wild Card Game': 1,
  'NL Wild Card Game': 1,
  'AL Wild Card Series': 1,
  'NL Wild Card Series': 1,
  'AL Division Series': 2,
  'NL Division Series': 2,
  'AL Championship Series': 3,
  'NL Championship Series': 3,
  'World Series': 4,
}

// Only the fields the tallies read. A season's unfiltered postseason schedule
// carries broadcast, venue and probable-pitcher detail we drop.
const SCHEDULE_FIELDS = [
  'dates',
  'games',
  'gamePk',
  'seriesDescription',
  'teams',
  'away',
  'home',
  'team',
  'id',
  'isWinner',
].join(',')

// --- the season calendar ---------------------------------------------------

// Every season's end dates in ONE request, keyed by year.
//
// `postSeasonEndDate` is absent for a year that scheduled no postseason, which
// is a cleaner separator than any year rule: 1901, 1902, 1904 and 1994 simply
// have no such date. Comparing it to today says whether a season that DID
// schedule one has finished it.
async function seasonCalendar() {
  const data = await getJson(
    '/api/v1/seasons/all?sportId=1&fields=seasons,seasonId,regularSeasonEndDate,postSeasonEndDate',
  )
  const today = new Date().toISOString().slice(0, 10)
  const calendar = new Map()
  for (const season of data.seasons ?? []) {
    const postEnd = season.postSeasonEndDate ?? null
    calendar.set(Number(season.seasonId), {
      held: postEnd != null,
      // A season is complete once the day its postseason ends has passed. A
      // year with no postseason falls back to the regular season's last day.
      complete: today > (postEnd ?? season.regularSeasonEndDate ?? '9999-12-31'),
    })
  }
  return calendar
}

// --- one season's regular-season rows -------------------------------------

// Every club's record and run differential for one season, plus the two
// denominators the page's frequency table needs: how many clubs played, and
// how long the schedule was. Season length is read as the most games any club
// finished, which is what makes a 154-game 1927 and a 60-game 2020 comparable
// on one axis without a table of scheduled lengths per era.
async function seasonStandings(season) {
  const data = await getJson(
    `/api/v1/standings?leagueId=${AL},${NL}&season=${season}&standingsTypes=regularSeason`,
  )
  const clubs = []
  for (const record of data.records ?? []) {
    for (const team of record.teamRecords ?? []) {
      const rs = team.runsScored
      const ra = team.runsAllowed
      // A season the feed has no run totals for cannot be measured. None are
      // missing back to 1901 today; if that changes, the club is left out of
      // both the rows and the denominator rather than counted as +0.
      if (rs == null || ra == null) continue
      clubs.push({
        teamId: team.team.id,
        wins: team.wins ?? 0,
        losses: team.losses ?? 0,
        rs,
        ra,
        diff: rs - ra,
      })
    }
  }
  const games = clubs.reduce((most, c) => Math.max(most, c.wins + c.losses), 0)
  return { clubs, games }
}

// Era-correct club names. The Dodgers were the Superbas in 1901 and the Robins
// in 1920; the Athletics have been Philadelphia's, Kansas City's and Oakland's.
// statsapi answers this per season, so the page can print the name the club
// actually wore that year beside the franchise id its logo is keyed on.
//
// ONLY WHEN IT DIFFERS. A row carries `era` only if the name that season is not
// the name the club wears today, so the board prints "Brooklyn Superbas" under
// the 1901 Dodgers and prints nothing under the 1939 Yankees rather than the
// same name twice. The comparison is made HERE, against the current season's
// answer from this same endpoint, so both sides are spelled the one way; the
// app's own teams.js spells some clubs differently ("Athletics" against
// "Oakland Athletics") and comparing across the two would invent differences.
async function seasonNames(season) {
  const data = await getJson(
    `/api/v1/teams?sportId=1&season=${season}&fields=teams,id,name,clubName`,
  )
  const names = new Map()
  for (const team of data.teams ?? []) names.set(team.id, { name: team.name, short: team.clubName })
  return names
}

// --- one season's postseason ----------------------------------------------

// Every DECIDED postseason game of one season, deduplicated by gamePk.
//
// Both halves of this matter and both come from real bugs. A schedule row with
// no winner is either a placeholder for a bracket not yet played or the
// postponed copy of a game played the next day; keeping it would either invent
// a result or hide one. Deduplication keeps whichever copy of a gamePk carries
// the decision, which is why the filter runs after the map and not before.
async function seasonPostseason(season) {
  const data = await getJson(
    `/api/v1/schedule?sportId=1&season=${season}&gameTypes=F,D,L,W&fields=${SCHEDULE_FIELDS}`,
  )
  const byPk = new Map()
  for (const game of (data.dates ?? []).flatMap((d) => d.games ?? [])) {
    const decided = game.teams?.home?.isWinner === true || game.teams?.away?.isWinner === true
    const held = byPk.get(game.gamePk)
    const heldDecided =
      held && (held.teams?.home?.isWinner === true || held.teams?.away?.isWinner === true)
    if (!held || (decided && !heldDecided)) byPk.set(game.gamePk, game)
  }
  return [...byPk.values()].filter(
    (g) => g.teams?.home?.isWinner === true || g.teams?.away?.isWinner === true,
  )
}

// How deep that season's bracket ran — the distinct round ranks actually
// played. 0 means no postseason was held at all (1901, 1902, 1904, 1994), which
// is what lets the page say "there was nothing to miss" rather than "missed".
function bracketDepth(games) {
  const ranks = new Set()
  for (const game of games) {
    const rank = ROUND_RANK[game.seriesDescription]
    if (rank === undefined) {
      throw new Error(`unknown postseason round: ${game.seriesDescription}`)
    }
    ranks.add(rank)
  }
  return ranks.size
}

// One club's postseason, folded into a round-by-round line.
//
// `exitRank` is the depth the club reached, which the page's era table counts
// on; `ring` is the only place a championship is asserted, and it reads the
// World Series row rather than trusting the last round played, so a club that
// lost the World Series cannot be mistaken for one that won it.
function clubPostseason(games, teamId) {
  const mine = games.filter(
    (g) => g.teams.home.team.id === teamId || g.teams.away.team.id === teamId,
  )
  if (!mine.length) return { made: false, ring: false, reachedWS: false, exitRank: 0, rounds: [] }

  const byRound = new Map()
  for (const game of mine) {
    const home = game.teams.home.team.id === teamId
    const side = home ? game.teams.home : game.teams.away
    const other = home ? game.teams.away : game.teams.home
    const round = game.seriesDescription
    if (!byRound.has(round)) {
      byRound.set(round, { round, rank: ROUND_RANK[round], w: 0, l: 0, opp: other.team.id })
    }
    const tally = byRound.get(round)
    if (side.isWinner) tally.w += 1
    else tally.l += 1
  }

  const rounds = [...byRound.values()].sort((a, b) => a.rank - b.rank)
  const final = rounds[rounds.length - 1]
  const ws = rounds.find((r) => r.round === 'World Series')
  return {
    made: true,
    ring: Boolean(ws && ws.w > ws.l),
    reachedWS: Boolean(ws),
    exitRank: final.rank,
    rounds: rounds.map(({ round, w, l, opp }) => ({ round, w, l, opp })),
  }
}

// A club's differential stretched to a 162-game season. The page prints this
// beside the raw number so a 154-game 1927 and a 60-game 2020 can be read on one
// scale. A club with no finished games prorates to nothing rather than to
// infinity.
export function prorated({ wins, losses, diff }) {
  const played = wins + losses
  if (!played) return 0
  return (diff * 162) / played
}

// --- the sweep -------------------------------------------------------------

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')),
  )
  const from = Number(args.from) || FIRST_SEASON
  const to = Number(args.to) || new Date().getUTCFullYear()
  const floor = Number(args.floor) || FLOOR

  const calendar = await seasonCalendar()
  // What each club is called NOW — the baseline every season's names are
  // compared against, fetched once rather than per season.
  const currentNames = await seasonNames(to)
  const seasons = {}
  const rows = []

  for (let season = from; season <= to; season += 1) {
    const { clubs, games } = await seasonStandings(season)
    // A season with no standings at all is skipped rather than recorded empty:
    // unlike the doubleheader file's year slider, nothing here needs to know a
    // season exists if no club played it.
    if (!clubs.length) {
      console.log(`${season}: no standings`)
      continue
    }

    const postseason = await seasonPostseason(season)
    const depth = bracketDepth(postseason)
    // A season the calendar has never heard of is read off its own games: a
    // bracket that was played was obviously held, and a season that is not the
    // one being played now is over.
    const { held, complete } = calendar.get(season) ?? { held: depth > 0, complete: true }
    seasons[season] = { clubs: clubs.length, games, rounds: depth, held, complete }

    // EITHER bar, not just the raw one. A season has not always been 162 games
    // — 154 until 1961, 117 in the 1994 strike, 60 in 2020 — so the page offers
    // a per-162 reading of the same threshold beside the raw one. A club that
    // clears only the prorated bar (the 2020 Dodgers, +136 in 60 games, which is
    // +367 over a full season) has to be IN the file, or that column would be
    // computed from rows that were cut before it could count them.
    const over = clubs
      .filter((c) => c.diff >= floor || prorated(c) >= floor)
      .sort((a, b) => b.diff - a.diff)
    if (!over.length) {
      console.log(`${season}: ${clubs.length} clubs, none over +${floor}`)
      continue
    }

    const names = await seasonNames(season)
    for (const club of over) {
      const named = names.get(club.teamId)
      const nowCalled = currentNames.get(club.teamId)?.name ?? null
      rows.push({
        season,
        teamId: club.teamId,
        // The name the club wore that year, and ONLY when it is not the name
        // it wears today. A club the current season does not list at all keeps
        // its era name, because "no longer exists under this id" is exactly the
        // case worth printing. null when the name has not changed.
        era: named?.name && named.name !== nowCalled ? named.name : null,
        w: club.wins,
        l: club.losses,
        rs: club.rs,
        ra: club.ra,
        diff: club.diff,
        // A season's postseason lands ALL AT ONCE, once the whole thing is
        // over, or not at all. This is the policy gen-postseason-history.mjs
        // already sets for the bracket page — it skips a season entirely unless
        // every postseason game is Final — and the reason is the same: a
        // half-played bracket on a history page is a live result, not history.
        // So `null` here covers both "no postseason was scheduled" and "not
        // finished yet", and the season's own `held` and `complete` flags are
        // what let the page tell those two apart. See the header.
        postseason: held && complete ? clubPostseason(postseason, club.teamId) : null,
      })
    }
    console.log(
      `${season}: ${clubs.length} clubs, ${over.length} over +${floor}` +
        ` (top ${over[0].diff}), bracket ${depth} round${depth === 1 ? '' : 's'}`,
    )
  }

  rows.sort((a, b) => b.diff - a.diff || a.season - b.season)

  const payload = {
    // `generatedAt`, in full, is what scripts/check-data-freshness.mjs reads by
    // default — this file first shipped writing `generated` with the time cut
    // off, which that guard counts as no stamp at all, and the nightly job
    // failed on the count two nights running while every generator stayed green.
    // The time is kept rather than sliced off because the budget is measured in
    // HOURS: a date-only stamp is read as midnight, so a file written at noon
    // already reports twelve hours old and a late run would alarm on nothing.
    generatedAt: new Date().toISOString(),
    firstSeason: from,
    lastSeason: to,
    // The cut the rows are taken at. The page's threshold control clamps to
    // this, so a rebuild at a different floor moves the control rather than
    // leaving it pointing past the end of the data.
    floor,
    // Per season: how many clubs played, the longest schedule any of them
    // finished, how many rounds that season's postseason ran, whether one was
    // scheduled at all, and whether the whole season has finished. The first two
    // are the frequency table's denominators, the third is its era grouping, and
    // the last two are how the page tells "nothing to miss" from "not yet".
    seasons,
    rows,
  }
  await writeJsonAtomic(out, payload)
  console.log(`\nWrote ${out} — ${rows.length} club seasons over +${floor}, ${from}–${to}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
