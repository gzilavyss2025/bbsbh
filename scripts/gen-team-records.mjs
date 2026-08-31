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
// APPEND-ONLY / incremental, same shape as gen-pitch-arsenal.mjs: each run
// sweeps a trailing window of dates and ingests only newly-Final games not
// already on file (team_record_ingested_games is the guard). A Final game's
// box score is immutable, so the nightly cost is the ~65 games that actually
// finished, never the season.
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
import { parseArgs, dateRange } from './lib/args.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import {
  inningRuns,
  encodeInnings,
  decodeInnings,
  scoredFirstSide,
  leadStateAfter,
  leadTrailFlags,
  lastAtBatOutcome,
  inningsScoredMask,
  scoredInExtras,
  starterLine,
  isQualityStart,
  battedAroundHalves,
  firstPitcherKind,
  refreshRoleFacts,
  roleKey,
  storedRoleFacts,
  tagSeries,
  isGetawayDay,
  dailyDivisionRanks,
} from './lib/team-records.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'team-records')
const teamsFile = join(here, '..', 'public', 'data', 'teams.json')

const DEFAULT_DAYS = 3
// MLB + the four full-season MiLB levels + Rookie (sportId 16, complex leagues
// like the ACL/FCL/DSL). Nothing here depends on `probablePitcher` or assumes a
// 9-inning game — `starterLine` reads the boxscore's actual `pitchers[0]`, and
// every inning-count derivation in `lib/team-records.mjs` keys off the
// linescore's own length, so a short complex-league game degrades the same way
// a rain-shortened MLB game already does (see `leadStateAfter`'s header).
const SPORT_IDS = [1, 11, 12, 13, 14, 16]
const CONCURRENCY = 6
const CHECKPOINT_EVERY = 300

// Only what the row needs. The unpruned box score is ~170 KB; this is a
// fraction of it, and a season backfill is ten thousand of them.
const BOX_FIELDS =
  'teams,away,home,teamStats,batting,homeRuns,pitchers,players,stats,pitching,inningsPitched,earnedRuns'
const PBP_FIELDS = 'allPlays,about,inning,halfInning,result,type'
// The two season numbers the opener inference needs and nothing else; the
// unpruned bulk pitching line is ~40 fields per pitcher at the level.
const ROLE_FIELDS = 'stats,splits,player,id,stat,gamesPlayed,gamesStarted'

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

// Every pitcher's throwing hand at one level, `{ [personId]: 'R' | 'L' }`.
// Resolved once per run and joined at ingest; an unresolved hand stores NULL
// and the app simply counts that game in neither the vs-RHS nor the vs-LHS
// row, which is the conservative degrade — never a guess.
async function pitchHandsFor(sportId, season) {
  try {
    const data = await getJson(
      `/api/v1/sports/${sportId}/players?season=${season}&fields=people,id,pitchHand,code`,
    )
    const map = {}
    for (const p of data.people ?? []) {
      const code = p?.pitchHand?.code
      if (p?.id != null && (code === 'R' || code === 'L')) map[p.id] = code
    }
    return map
  } catch (err) {
    console.error(`pitch hands sportId ${sportId}: ${err.message}`)
    return {}
  }
}

// Every pitcher's season line at one level, `{ [personId]: { gamesPlayed,
// gamesStarted } }` — the facts the opener / early-exit split is inferred from
// (scripts/lib/team-records.mjs holds the inference and the argument for it).
// One bulk call per level per run, the same export-time-join shape the
// handedness map above uses. Returns NULL, not `{}`, when the call fails: an
// empty map would read as "no pitcher here has a role" and blank the level,
// while null tells the merge to leave the stored snapshot standing.
async function pitcherRolesFor(sportId, season) {
  try {
    const data = await getJson(
      `/api/v1/stats?stats=season&group=pitching&season=${season}&sportId=${sportId}` +
        `&playerPool=all&limit=8000&fields=${ROLE_FIELDS}`,
    )
    const map = {}
    for (const split of data.stats?.[0]?.splits ?? []) {
      const id = split?.player?.id
      if (id == null) continue
      const stat = split.stat ?? {}
      map[id] = { gamesPlayed: Number(stat.gamesPlayed) || 0, gamesStarted: Number(stat.gamesStarted) || 0 }
    }
    return map
  } catch (err) {
    console.error(`pitcher roles sportId ${sportId}: ${err.message}`)
    return null
  }
}

// Final regular-season games in the window, at every swept level, that aren't
// already on file. A Postponed row keeps its original date in the feed and
// carries no linescore, so it is dropped rather than ingested as a 0-0 tie.
async function candidatesFor(dates, existing) {
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
        if (g.status?.abstractGameState !== 'Final') continue
        if (g.status?.detailedState === 'Postponed') continue
        if (existing.has(String(g.gamePk))) continue
        const away = g.teams?.away?.team
        const home = g.teams?.home?.team
        if (!away?.id || !home?.id) continue
        out.push({ game: g, sportId, date: g.officialDate ?? date })
      }
    }
  }
  return out
}

// One game → the two rows it produces, one per club. Returns null when the
// game's own feeds fail, so the gamePk stays unmarked and is retried next run
// rather than being permanently missed.
async function rowsForGame({ game, sportId, date }, hands) {
  const gamePk = game.gamePk
  const [box, pbp] = await Promise.all([
    getJson(`/api/v1/game/${gamePk}/boxscore?fields=${BOX_FIELDS}`),
    // Best-effort: a missing play-by-play costs only the batted-around count,
    // so it degrades to zero rather than dropping the whole game.
    getJson(`/api/v1/game/${gamePk}/playByPlay?fields=${PBP_FIELDS}`).catch(() => null),
  ])

  const ls = game.linescore ?? {}
  const innings = inningRuns(ls)
  const awayTotals = ls.teams?.away ?? {}
  const homeTotals = ls.teams?.home ?? {}
  const awayId = game.teams.away.team.id
  const homeId = game.teams.home.team.id
  const homeWon =
    game.teams.home.isWinner === true ? true : game.teams.away.isWinner === true ? false : null

  const starters = {
    away: starterLine(box.teams?.away),
    home: starterLine(box.teams?.home),
  }
  const ba = battedAroundHalves(pbp?.allPlays)
  const season = Number(date.slice(0, 4))

  const side = (isHome) => {
    const me = isHome ? homeTotals : awayTotals
    const them = isHome ? awayTotals : homeTotals
    const myBox = isHome ? box.teams?.home : box.teams?.away
    const oppBox = isHome ? box.teams?.away : box.teams?.home
    const myStarter = isHome ? starters.home : starters.away
    const oppStarter = isHome ? starters.away : starters.home
    return {
      game_pk: gamePk,
      team_id: isHome ? homeId : awayId,
      season,
      sport_id: sportId,
      date,
      opp_id: isHome ? awayId : homeId,
      result: homeWon == null ? 'T' : homeWon === isHome ? 'W' : 'L',
      payload: {
        innings: encodeInnings(innings),
        isHome,
        runs: Number(me.runs) || 0,
        oppRuns: Number(them.runs) || 0,
        hits: Number(me.hits) || 0,
        oppHits: Number(them.hits) || 0,
        errors: Number(me.errors) || 0,
        oppErrors: Number(them.errors) || 0,
        homeRuns: Number(myBox?.teamStats?.batting?.homeRuns) || 0,
        oppHomeRuns: Number(oppBox?.teamStats?.batting?.homeRuns) || 0,
        scheduledInnings: Number(game.scheduledInnings) || Number(ls.scheduledInnings) || 9,
        dayNight: game.dayNight ?? '',
        doubleHeader: game.doubleHeader ?? 'N',
        gameNumber: Number(game.gameNumber) || 1,
        venueId: game.venue?.id ?? null,
        starterId: myStarter.id,
        starterOuts: myStarter.outs,
        starterEr: myStarter.earnedRuns,
        oppStarterId: oppStarter.id,
        oppStarterOuts: oppStarter.outs,
        oppStarterEr: oppStarter.earnedRuns,
        oppStarterHand: oppStarter.id != null ? (hands[oppStarter.id] ?? null) : null,
        battedAround: isHome ? ba.home : ba.away,
        oppBattedAround: isHome ? ba.away : ba.home,
      },
    }
  }
  return [side(false), side(true)]
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

// A shipped row. Keys are short because there are ~160 of these per club per
// season and the whole set is committed; a falsy value is OMITTED rather than
// written as 0/false/null, which is most of the saving (a typical row carries
// a dozen keys, not thirty). The reader treats an absent key as falsy — so the
// few whose 0 is a real answer, marked below, are written the long way.
function shipRow(r, getaway, roles) {
  const p = r.payload
  const innings = decodeInnings(p.innings)
  const isHome = p.isHome === true
  const first = scoredFirstSide(innings)
  const { led, trailed } = leadTrailFlags(innings, isHome)
  const homeWon = r.result === 'T' ? null : isHome === (r.result === 'W')
  const { decided, walkOff } = lastAtBatOutcome(innings, homeWon)
  const won = r.result === 'W'

  const row = {
    d: r.date,
    o: r.opp_id,
    r: r.result,
    rs: p.runs,
    ra: p.oppRuns,
    hi: p.hits,
    ha: p.oppHits,
  }
  const put = (k, v) => {
    if (v) row[k] = v
  }
  put('h', isHome ? 1 : 0)
  put('e', p.errors)
  put('ea', p.oppErrors)
  put('hr', p.homeRuns)
  put('hra', p.oppHomeRuns)
  // Lead state after 6/7/8 completed innings: 1 ahead, -1 behind, 0 tied.
  // A 0 is a real answer here (the "Tied after 7" row), so it can't ride the
  // omit-if-falsy path — it is written whenever the inning was reached.
  for (const [key, n] of [['l6', 6], ['l7', 7], ['l8', 8]]) {
    const state = leadStateAfter(innings, n, isHome)
    if (state != null) row[key] = state
  }
  put('x', innings.length > p.scheduledInnings ? 1 : 0)
  // The club's own scoring line as a bitmask (see inningsScoredMask), plus the
  // one thing the mask cannot say on its own: whether any of that scoring
  // happened past the scheduled length. Together they answer "scored in the
  // top/bottom of the Nth" and "scored in extra innings" for a row that costs
  // a handful of bytes.
  put('ib', inningsScoredMask(innings, isHome))
  put('ix', scoredInExtras(innings, isHome, p.scheduledInnings) ? 1 : 0)
  put('sf', first ? (first === (isHome ? 'home' : 'away') ? 1 : -1) : 0)
  put('cb', won && trailed ? 1 : 0)
  put('ll', !won && r.result === 'L' && led ? 1 : 0)
  // A property of the GAME, not of the winner — both clubs played in a game
  // decided in the last at-bat, so both carry the flag and the row reads as a
  // record. `wo` is the directional half: +1 walked them off, -1 walked off.
  put('la', decided ? 1 : 0)
  put('wo', walkOff ? (won ? 1 : -1) : 0)
  put('ba', p.battedAround)
  // Both out totals ride around the omit-if-falsy path, as the lead states
  // above do: no out recorded is a real answer, the shortest outing there is,
  // while an ABSENT key keeps meaning "no pitching line at all" — the case
  // every starter-length row excludes rather than counts.
  if (p.starterOuts != null) row.si = p.starterOuts
  put('qs', isQualityStart(p.starterOuts, p.starterEr) ? 1 : 0)
  if (p.oppStarterOuts != null) row.oi = p.oppStarterOuts
  put('oh', p.oppStarterHand)
  // What each side's FIRST PITCHER was doing when the outing was short: an
  // opener, or a starter who exited early. Pitcher identity and season totals
  // stay in the authoring layer; the row ships the verdict alone, one digit.
  const roleOf = (id) => (id == null ? null : roles.get(roleKey(r.sport_id, id)))
  put('sk', firstPitcherKind(p.starterOuts, roleOf(p.starterId)))
  put('ok', firstPitcherKind(p.oppStarterOuts, roleOf(p.oppStarterId)))
  put('n', p.dayNight === 'night' ? 1 : 0)
  put('dh', p.doubleHeader !== 'N' ? 1 : 0)
  put('sg', r.seriesGame)
  put('sl', r.seriesLength)
  put('op', r.opener ? 1 : 0)
  put('fi', r.finale ? 1 : 0)
  put('ga', getaway ? 1 : 0)
  return row
}

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

  // Unpack the payload once, and lift the two fields the ledger passes below
  // actually navigate by — the series tagger compares venues, and a
  // doubleheader needs its game number to order within a date. Sorting happens
  // here rather than in SQL because both now live inside payload_json.
  const rows = raw.map((r) => {
    const payload = JSON.parse(r.payload_json)
    return { ...r, payload, venue_id: payload.venueId ?? null, game_number: payload.gameNumber ?? 1 }
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
    const existing = new Set(
      db.prepare('SELECT game_pk FROM team_record_ingested_games').all().map((r) => String(r.game_pk)),
    )
    const candidates = await candidatesFor(dates, existing)
    console.log(`${candidates.length} game(s) to ingest (${startDate}..${endDate})`)

    const hands = {}
    for (const sportId of sports) Object.assign(hands, await pitchHandsFor(sportId, roleSeason))

    const insertRow = db.prepare(
      `INSERT OR REPLACE INTO team_record_games (
         game_pk, team_id, season, sport_id, date, opp_id, result, payload_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const markIngested = db.prepare(
      'INSERT OR IGNORE INTO team_record_ingested_games (game_pk, date, season) VALUES (?, ?, ?)',
    )

    let ingested = 0
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
        for (const r of rows) {
          insertRow.run(
            r.game_pk, r.team_id, r.season, r.sport_id, r.date, r.opp_id, r.result,
            JSON.stringify(r.payload),
          )
        }
        markIngested.run(rows[0].game_pk, rows[0].date, rows[0].season)
        ingested++
      }
      if (candidates.length > CHECKPOINT_EVERY) {
        await dumpGroup(db, 'team-records')
        console.log(`checkpoint: ${ingested}/${candidates.length} ingested`)
      }
    }
    console.log(`${ingested} game(s) ingested`)
    if (ingested > 0) await dumpGroup(db, 'team-records')
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
