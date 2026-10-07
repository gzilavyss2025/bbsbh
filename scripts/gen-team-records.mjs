// Regenerates public/data/team-records/{season}/{teamId}.json — the per-game
// ledger every club's SITUATIONAL RECORDS are read off, at MLB, the four
// full-season MiLB levels, and Rookie (sportId 16, the complex leagues).
// Surfaced as the "Records" table under Team Leaders on the Numbers tab
// (src/api/teamRecords.js).
//
// The records themselves — scoring first, out-hitting the opponent, leading
// after 7, vs. a left-handed starter, by month, in a getaway day, before and
// after the All-Star break, and forty more — are NOT stored. What is stored is
// one row per (game, club) of raw facts, and the app derives every split from
// those rows at read time. Two things follow from that, both deliberate:
//
//   1. A new split, or a changed definition, is a code change with NO
//      regeneration. See scripts/lib/team-records.mjs's header for the full
//      argument and the two generators that already paid the other bill.
//   2. A dated (`?d=`) team page filters the rows by date itself, so the
//      records never look further ahead than the standings beside them. A
//      precomputed season total could not do that without a date-keyed
//      snapshot per club per day.
//
// INCREMENTAL, same shape as gen-pitch-arsenal.mjs: each run sweeps a trailing
// window of dates and ingests newly-Final games not already on file
// (team_record_ingested_games is the guard). statsapi corrects a box score after
// Final, so a game dated inside the window is read AGAIN each run (REREAD_DAYS)
// and its rows replaced; --reingest does the same for any range by hand (#1466).
// Older games stay as first read, until a --reingest range reaches them.
//
// THREE calls per game, no more: the date's schedule (bulk, one per date per
// level, carrying the full linescore), the box score (team home runs and both
// starters' lines — a PROBABLE pitcher is a prediction and is wrong often
// enough to be useless for a record), and a field-pruned play-by-play at ~8 KB
// (the batted-around count, the one fact no other endpoint carries). Each
// level's pitcher handedness comes from ONE bulk /sports/{id}/players call per
// run, the same export-time join gen-pitch-arsenal.mjs uses and for the same
// reason — a per-game column would only fill in as each pitcher next appeared.
//
// VERIFIED AGAINST STATSAPI'S OWN SPLITS. statsapi publishes eight of these
// records per club at every level — one /standings call per league — which
// makes a free oracle for a ledger this size. What matched, and the two known
// and deliberate disagreements (a doubleheader nightcap's day/night, and one
// starting hand), are recorded in docs/scripts/generators.md. RE-RUN THAT
// CHECK after changing anything in this file's linescore handling.
//
// Run by hand:
//   node scripts/gen-team-records.mjs                 # trailing 3 days
//   node scripts/gen-team-records.mjs --days=200      # season-to-date backfill
//   node scripts/gen-team-records.mjs --since=2026-04-01 --until=2026-05-01
//   node scripts/gen-team-records.mjs --reingest --since=2026-04-01 --until=2026-05-01
//                                                     # re-read games already on
//                                                     # file, to pick up corrections
//   node scripts/gen-team-records.mjs --sports=1      # restrict the sweep
//   node scripts/gen-team-records.mjs --export-only   # rebuild the JSON from
//                                                     # rows already on disk,
//                                                     # no sweep — the mode for
//                                                     # a changed definition
//   node scripts/gen-team-records.mjs --export-only --refresh-roles
//                                                     # ...re-reading the roles
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { writeShards } from './lib/io.js'
import { openDb, dumpGroup } from './lib/db.js'
import { getJson } from './lib/statsapi.mjs'
import { parseArgs, dateRange, isoDay } from './lib/args.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import {
  isPlayedGame,
  uniqueByGamePk,
  refreshRoleFacts,
  storedRoleFacts,
  tagSeries,
  isGetawayDay,
  dailyDivisionRanks,
} from './lib/team-records.mjs'
import { pitchHandsFor, pitcherRolesFor, rowsForGame, shipRow, storeGame,
  REREAD_DAYS, rereadPks } from './lib/records/ingest.mjs'
import { homeVenueByTeam, siteOf } from './lib/schedule-shape.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'team-records')
const teamsFile = join(here, '..', 'public', 'data', 'teams.json')

const DEFAULT_DAYS = REREAD_DAYS
// MLB + the four full-season MiLB levels + Rookie (sportId 16, complex leagues
// like the ACL/FCL/DSL). Nothing here depends on `probablePitcher` or assumes a
// 9-inning game — `starterLine` reads the boxscore's actual `pitchers[0]`, and
// every inning-count derivation in `lib/team-records.mjs` keys off the
// linescore's own length, so a short complex-league game degrades the same way
// a rain-shortened MLB game already does (see `leadStateAfter`'s header).
const SPORT_IDS = [1, 11, 12, 13, 14, 16]
const CONCURRENCY = 6
const CHECKPOINT_EVERY = 300

const args = parseArgs(process.argv.slice(2))
const sports = args.sports ? String(args.sports).split(',').map(Number) : SPORT_IDS

function datesBetween(startDate, endDate) {
  const out = []
  const d = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

// Final regular-season games in the window, at every swept level, that aren't
// already on file (`skip`). A Postponed or Cancelled row reads "Final" too, keeps its
// original date in the feed and carries no linescore, so isPlayedGame drops
// it rather than ingesting it as a 0-0 tie.
async function candidatesFor(dates, skip) {
  const out = []
  for (const sportId of sports) {
    for (const date of dates) {
      let slate
      try {
        slate = await getJson(
          `/api/v1/schedule?sportId=${sportId}&gameType=R&date=${date}&hydrate=linescore,team`,
        )
      } catch (err) {
        console.error(`schedule sportId ${sportId} ${date}: ${err.message}`)
        continue
      }
      for (const g of (slate.dates ?? []).flatMap((d) => d.games ?? [])) {
        if (!isPlayedGame(g)) continue
        if (skip.has(String(g.gamePk))) continue
        const away = g.teams?.away?.team
        const home = g.teams?.home?.team
        if (!away?.id || !home?.id) continue
        out.push({ game: g, sportId, date: g.officialDate ?? date })
      }
    }
  }
  return uniqueByGamePk(out)
}


// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------


// Which league/division each club belongs to, for the division and league
// splits and for the daily-rank series. Read from the committed teams.json
// (gen-teams.mjs's output, refreshed weekly) rather than re-fetched — it
// already carries leagueId/divisionId at every level, MiLB included. A club
// in a division-less league (the Northwest League's six) carries null, and
// every consumer degrades on that rather than dropping the club.
async function loadTeamMeta() {
  const teams = JSON.parse(await readFile(teamsFile, 'utf8'))
  const meta = {}
  for (const list of Object.values(teams.bySportId ?? {})) {
    for (const t of list) {
      meta[t.id] = {
        leagueId: t.leagueId ?? null,
        leagueName: t.leagueName ?? '',
        divisionId: t.divisionId ?? null,
        divisionName: t.divisionName ?? '',
      }
    }
  }
  return meta
}

// The season's All-Star Game date — the hinge every record's pre-break /
// post-break lever swings on.
//
// MLB's date, applied at EVERY level. Each MiLB league runs its own All-Star
// break on its own dates, so there is no single true answer below MLB; but the
// leagues do pause around the same mid-July window, and "before the break" in
// ordinary use means the break everyone watched. One documented date reads the
// way people mean it and keeps the lever comparable across levels. Null when
// the game has not been scheduled yet (an early-season run), and the app then
// simply hides the lever.
async function allStarDateFor(season) {
  try {
    const data = await getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=A`)
    const game = (data.dates ?? []).flatMap((d) => d.games ?? [])[0]
    return game?.officialDate ?? ((game?.gameDate ?? '').slice(0, 10) || null)
  } catch {
    return null
  }
}

// League and division display names for every opponent one club faced,
// `{ leagues: {id: name}, divisions: {id: name} }`.
function namesFor(teamRows, teamMeta) {
  const leagues = {}
  const divisions = {}
  for (const id of new Set(teamRows.map((r) => r.opp_id))) {
    const m = teamMeta[id]
    if (m?.leagueId != null && m.leagueName) leagues[m.leagueId] = m.leagueName
    if (m?.divisionId != null && m.divisionName) divisions[m.divisionId] = m.divisionName
  }
  return { leagues, divisions }
}

async function exportSeason(db, season, teamMeta, allStarDate) {
  const raw = db.prepare('SELECT * FROM team_record_games WHERE season = ?').all(season)
  if (raw.length === 0) return { written: 0, swept: 0 }

  // The role facts, off the ledger's own group rather than the network. A
  // season with no snapshot classifies nothing rather than guess.
  const roles = storedRoleFacts(
    db.prepare('SELECT * FROM team_record_pitcher_roles WHERE season = ?').all(season),
  )

  // Unpack the payload once, and lift the fields the ledger passes below
  // navigate by — `site` for the series tagger (the home-park inference
  // gen-schedule-shape uses), and a doubleheader's game number. Sorting happens
  // here, not in SQL, because both live inside payload_json.
  const unpacked = raw.map((r) => {
    const payload = JSON.parse(r.payload_json)
    return { ...r, payload, venue_id: payload.venueId ?? null }
  })
  const homeVenues = homeVenueByTeam(
    unpacked.filter((r) => r.payload.isHome).map((r) => ({ homeId: r.team_id, venueId: r.venue_id })),
  )
  const rows = unpacked.map((r) => {
    const [homeId, awayId] = r.payload.isHome ? [r.team_id, r.opp_id] : [r.opp_id, r.team_id]
    const site = siteOf({ homeId, awayId, venueId: r.venue_id }, r.team_id, homeVenues)
    return { ...r, game_number: r.payload.gameNumber ?? 1, site }
  })

  const byTeam = new Map()
  for (const r of rows) {
    if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, [])
    byTeam.get(r.team_id).push(r)
  }
  for (const teamRows of byTeam.values()) {
    teamRows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_number - b.game_number))
  }

  // Daily division ranks, per division, over the clubs that actually played in
  // it — a club whose division is unknown simply gets no rank series and the
  // app hides that row.
  const byDivision = new Map()
  for (const [teamId, teamRows] of byTeam) {
    const div = teamMeta[teamId]?.divisionId
    if (div == null) continue
    if (!byDivision.has(div)) byDivision.set(div, new Map())
    byDivision.get(div).set(teamId, teamRows)
  }
  const ranks = {}
  for (const members of byDivision.values()) Object.assign(ranks, dailyDivisionRanks(members))

  const entries = []
  for (const [teamId, teamRows] of byTeam) {
    const tagged = tagSeries(teamRows)
    const games = tagged.map((t, i) => shipRow(t, isGetawayDay(t, tagged[i + 1]), roles))
    entries.push([
      String(teamId),
      {
        teamId,
        season,
        sportId: teamRows[0].sport_id,
        allStarDate,
        leagueId: teamMeta[teamId]?.leagueId ?? null,
        divisionId: teamMeta[teamId]?.divisionId ?? null,
        // Opponent league/division for the vs-division and vs-league splits.
        // Carried per FILE so the reader needs no second fetch of teams.json
        // to answer "who is in my division"; only the clubs this one played
        // are listed, which is a few dozen keys.
        opponents: Object.fromEntries(
          [...new Set(teamRows.map((r) => r.opp_id))].map((id) => [
            id,
            {
              l: teamMeta[id]?.leagueId ?? null,
              v: teamMeta[id]?.divisionId ?? null,
            },
          ]),
        ),
        // The names for those ids, so the card can label a "vs. NL Central"
        // row without a second fetch of teams.json. Only the leagues and
        // divisions this club actually played are listed.
        names: namesFor(teamRows, teamMeta),
        // Division rank at the end of each date the division played. Ties
        // share the best rank, which is how "days in first place" is counted.
        dailyRank: ranks[teamId] ?? {},
        games,
      },
    ])
    // No generatedAt per shard, on purpose: 150 committed files on a nightly
    // cron must not all churn on a timestamp (gen-milb-alumni.mjs's lesson).
  }
  return writeShards(join(outDir, String(season)), entries)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const db = await openDb()
  const teamMeta = await loadTeamMeta()
  const { startDate, endDate } = dateRange(args, DEFAULT_DAYS)
  // The season the run is about, for both bulk joins: a backfill window names
  // its own year, the nightly trailing window names this one.
  const roleSeason = Number(endDate.slice(0, 4))

  if (!args['export-only']) {
    const dates = datesBetween(startDate, endDate)
    const ingested = db.prepare('SELECT game_pk, date FROM team_record_ingested_games').all()
    // Skip every game on file except those inside the re-read window (all of
    // them with --reingest, which re-reads the whole date range).
    const reread = args.reingest ? null : new Set(rereadPks(ingested, isoDay(new Date())))
    const skip = new Set(
      ingested.map((r) => String(r.game_pk)).filter((pk) => reread && !reread.has(pk)),
    )
    const candidates = await candidatesFor(dates, skip)
    console.log(`${candidates.length} game(s) to ingest (${startDate}..${endDate})`)

    const hands = {}
    for (const sportId of sports) Object.assign(hands, await pitchHandsFor(sportId, roleSeason))

    let done = 0
    // Chunked so a checkpoint can land mid-backfill: the pool runs the
    // fetches, the writes happen on this thread in order.
    for (let i = 0; i < candidates.length; i += CHECKPOINT_EVERY) {
      const chunk = candidates.slice(i, i + CHECKPOINT_EVERY)
      const results = await mapConcurrent(chunk, CONCURRENCY, (c) => rowsForGame(c, hands))
      for (let j = 0; j < chunk.length; j++) {
        const rows = results[j]
        if (!rows) {
          console.error(`gamePk ${chunk[j].game.gamePk}: fetch failed, will retry next run`)
          continue
        }
        storeGame(db, rows)
        done++
      }
      if (candidates.length > CHECKPOINT_EVERY) {
        await dumpGroup(db, 'team-records')
        console.log(`checkpoint: ${done}/${candidates.length} ingested`)
      }
    }
    console.log(`${done} game(s) ingested`)
    if (done > 0) await dumpGroup(db, 'team-records')
  }

  // The role refresh rides with a sweep, never with `--export-only` — that
  // mode re-derives from what is on disk, and a rebuild that quietly reached
  // for the network would not be that. Its own flag runs it alone: how a
  // season's snapshot is first filled, and how a failed level is repaired.
  if (!args['export-only'] || args['refresh-roles']) {
    console.log(await refreshRoleFacts(db, roleSeason, sports, pitcherRolesFor))
    await dumpGroup(db, 'team-records')
  }

  // Always re-export: an --export-only run is the whole point of the mode, and
  // a sweep that ingested nothing still costs one cheap rebuild that produces
  // byte-identical files (so no git churn) when nothing changed.
  const seasons = db
    .prepare('SELECT DISTINCT season FROM team_record_games ORDER BY season')
    .all()
    .map((r) => r.season)
  for (const season of seasons) {
    const { written, swept } = await exportSeason(db, season, teamMeta, await allStarDateFor(season))
    console.log(`${season}: wrote ${written} club file(s)${swept ? `, swept ${swept}` : ''}`)
  }
  const total = db.prepare('SELECT COUNT(*) AS n FROM team_record_ingested_games').get().n
  console.log(`${total} total games on file`)
  db.close()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
