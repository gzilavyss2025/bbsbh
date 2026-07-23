// Regenerates public/data/fouls.json — season-long MLB foul-ball aggregates:
// per-batter, per-pitcher, per-team totals, a league by-inning distribution
// (with a starter-vs-reliever split), and a league by-pitch-type foul rate.
// See .scratch/metric-engines/foul-tracker.md (engine F2) for the design.
//
// WHY A SWEEP (not a one-call rebuild). Foul balls are not pre-totaled anywhere
// in the API — the only source is each game's per-pitch play-by-play. A Final
// game's fouls are immutable, so this is an APPEND-ONLY/incremental sweep in the
// mould of gen-umpire-accuracy.mjs + gen-postseason-leaders.mjs: each run scans
// a trailing window of schedule Finals, fetches the live feed for every gamePk
// not yet ingested, folds each game's aggregates into the shared SQLite layer
// (scripts/lib/schema.sql's foul_* tables, docs/adr/0021) via incrementing
// upserts, and marks it in foul_ingested_games so a resumed/re-run sweep never
// double-counts. NEVER stores a feed on disk. MLB only (sportId 1), regular
// season only (gameType R).
//
// FOUL COUNTING mirrors the live derive.js path EXACTLY (importing the shared
// FOUL_CODES/WHIFF_CODES/NON_PA_EVENT_TYPES/pitchCallCode from
// src/api/playbyplay.js — the gen-minors-leaders convention of importing app
// constants so the precomputed and live tallies can't drift). A pitch is a foul
// iff pitchCallCode(e) is in FOUL_CODES. A pitch event's own `count` is the
// count AFTER the pitch, so the pre-pitch strike count is carried pitch-to-pitch
// AND across a non-PA baserunning play into the same batter's resumed at-bat; a
// foul hit with two pre-pitch strikes is a two-strike foul (the AB-extending
// kind). A pitcher is "the starter" for a game iff he's his team's first pitcher
// (boxscore team.pitchers[0]); that drives the by-inning starter/reliever split
// and each pitcher's is_starter flag (majority of appearances were starts).
//
// Runs on the nightly cron; also by hand:
//   node scripts/gen-fouls.mjs                       # trailing 3 days
//   node scripts/gen-fouls.mjs --days=7
//   node scripts/gen-fouls.mjs --since=2026-03-20 [--until=2026-07-19]
//   node scripts/gen-fouls.mjs --backfill-games      # see below
//   node scripts/gen-fouls.mjs --backfill-team-pitch-types  # see below
// The --since form is the one-time / full-season backfill; nightly runs use the
// default trailing window. Checkpoints (dump + JSON export) every 100 games so a
// long backfill resumes cleanly. --backfill-games is a SEPARATE one-time backfill
// for foul_game_totals specifically: since that table was added after most games
// were already ingested, it re-fetches every already-ingested gamePk's feed and
// fills in just that table (see main()'s early-return branch) without touching
// the accumulating season tables. --backfill-team-pitch-types is the same idea
// for foul_team_pitch_types_batting/_pitching (the team-filtered "batters vs
// pitchers by pitch type" board), but since those two ACCUMULATE across games
// rather than overwrite per gamePk, it wipes both tables first and rebuilds
// them from scratch every time it runs, rather than only filling gaps.
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openDb, dumpGroup } from './lib/db.js'
import {
  FOUL_CODES,
  WHIFF_CODES,
  NON_PA_EVENT_TYPES,
  pitchCallCode,
} from '../src/api/playbyplay.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'fouls.json')
const BASE = 'https://statsapi.mlb.com'

const DEFAULT_DAYS = 3
const CHECKPOINT_EVERY = 100
const CONCURRENCY = 8
const MAX_INNING_BUCKET = 10 // innings 10+ fold into inning 10

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// --- pure per-game aggregation (exported for tests) --------------------------
//
// Walks one game's live feed and returns the per-entity foul deltas to fold in.
// No network, no DB — a pure function of the feed, so a synthetic fixture can
// drive the exact counting rules. Shape:
//   { batters:  Map personId -> { name, teamId, pa, pitchesSeen, fouls,
//                                 twoStrikeFouls, gameFouls, opponentId,
//                                 bestPaFouls, bestPa },
//     pitchers: Map personId -> { name, teamId, pitches, fouls, whiffs, isStarter },
//     teams:    Map teamId   -> { fouls, twoStrikeFouls },
//     innings:  Map inning   -> { pitches, fouls, pitchesVsStarter, foulsVsStarter,
//                                 pitchesVsReliever, foulsVsReliever },
//     pitchTypes: Map code   -> { description, pitches, fouls },
//     game: { awayId, homeId, awayFouls, homeFouls, totalFouls, awayScore, homeScore },
//     battingPitchTypes:  Map teamId -> Map code -> { description, pitches, fouls, whiffs },
//     pitchingPitchTypes: Map teamId -> Map code -> { description, pitches, fouls, whiffs } }
export function aggregateGameFouls(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const awayId = feed?.gameData?.teams?.away?.id ?? null
  const homeId = feed?.gameData?.teams?.home?.id ?? null
  const box = feed?.liveData?.boxscore
  const awayStarter = box?.teams?.away?.pitchers?.[0] ?? null
  const homeStarter = box?.teams?.home?.pitchers?.[0] ?? null

  const batters = new Map()
  const pitchers = new Map()
  const teams = new Map()
  const innings = new Map()
  const pitchTypes = new Map()
  // Team-scoped counterparts to `pitchTypes` above — keyed teamId -> code ->
  // { description, pitches, fouls }. `battingPitchTypes` is the pitch types a
  // team's OWN BATTERS saw (whoever was pitching); `pitchingPitchTypes` is the
  // pitch types a team's OWN PITCHERS threw (whoever was batting). Two maps,
  // not one keyed by (teamId, side), since a single pitch belongs to a
  // batting team AND a pitching team at once — it always updates one entry in
  // each map, never a shared row.
  const battingPitchTypes = new Map()
  const pitchingPitchTypes = new Map()

  const getBatter = (id, name, teamId) => {
    let b = batters.get(id)
    if (!b) {
      b = {
        name, teamId, pa: 0, pitchesSeen: 0, fouls: 0, twoStrikeFouls: 0, gameFouls: 0,
        opponentId: null, bestPaFouls: 0, bestPa: null, gameHisScore: null, gameOppScore: null,
      }
      batters.set(id, b)
    } else {
      if (name) b.name = name
      if (teamId != null) b.teamId = teamId
    }
    return b
  }
  const getPitcher = (id, name, teamId) => {
    let p = pitchers.get(id)
    if (!p) {
      p = { name, teamId, pitches: 0, fouls: 0, whiffs: 0, isStarter: false }
      pitchers.set(id, p)
    } else {
      if (name) p.name = name
      if (teamId != null) p.teamId = teamId
    }
    return p
  }
  const getTeam = (id) => {
    let t = teams.get(id)
    if (!t) {
      t = { fouls: 0, twoStrikeFouls: 0 }
      teams.set(id, t)
    }
    return t
  }
  const getInning = (n) => {
    let i = innings.get(n)
    if (!i) {
      i = { pitches: 0, fouls: 0, pitchesVsStarter: 0, foulsVsStarter: 0, pitchesVsReliever: 0, foulsVsReliever: 0 }
      innings.set(n, i)
    }
    return i
  }
  const getPitchType = (code, desc) => {
    let pt = pitchTypes.get(code)
    if (!pt) {
      pt = { description: desc || '', pitches: 0, fouls: 0, whiffs: 0 }
      pitchTypes.set(code, pt)
    } else if (desc && !pt.description) {
      pt.description = desc
    }
    return pt
  }
  const getTeamPitchType = (store, teamId, code, desc) => {
    let byCode = store.get(teamId)
    if (!byCode) {
      byCode = new Map()
      store.set(teamId, byCode)
    }
    let pt = byCode.get(code)
    if (!pt) {
      pt = { description: desc || '', pitches: 0, fouls: 0, whiffs: 0 }
      byCode.set(code, pt)
    } else if (desc && !pt.description) {
      pt.description = desc
    }
    return pt
  }

  // Pre-pitch strike count carried across pitches and across a non-PA play into
  // the same batter's resumed at-bat — identical to derive.js's carry logic.
  // carryPaFouls/carryPaContext do the same for the Most-Fouls-In-A-PA board:
  // a foul (or the entering situational snapshot) hit before a mid-AB
  // interruption still belongs to the SAME plate appearance once it resumes.
  let carryBatter = null
  let carryStrikes = 0
  let carryPaFouls = 0
  let carryPaContext = null

  // Running per-half-inning game state, always advanced to the play's OWN
  // (POST-play) outs/runners/score before that play is otherwise processed —
  // same off-by-one convention as the pitch-level count (see module header) —
  // so each play's "entering" snapshot, captured below BEFORE this advance,
  // is the state that PA actually started in. Outs/runners reset at every
  // half-inning boundary; the score does not.
  let outsEntering = 0
  let onFirst = false
  let onSecond = false
  let onThird = false
  let awayScore = 0
  let homeScore = 0
  let lastHalfKey = null

  for (const play of plays) {
    const inningNum = play?.about?.inning
    const half = play?.about?.halfInning
    if (!inningNum || !half) continue

    const halfKey = `${inningNum}-${half}`
    if (halfKey !== lastHalfKey) {
      outsEntering = 0
      onFirst = false
      onSecond = false
      onThird = false
      lastHalfKey = halfKey
    }
    const enteringOuts = outsEntering
    const enteringOnFirst = onFirst
    const enteringOnSecond = onSecond
    const enteringOnThird = onThird
    const enteringAway = awayScore
    const enteringHome = homeScore
    // Advance the trackers for every play (even a zero-pitch one below), so a
    // later play's "entering" snapshot is never stale.
    if (Number.isFinite(play.count?.outs)) outsEntering = play.count.outs
    onFirst = !!play.matchup?.postOnFirst
    onSecond = !!play.matchup?.postOnSecond
    onThird = !!play.matchup?.postOnThird
    if (Number.isFinite(play.result?.awayScore)) awayScore = play.result.awayScore
    if (Number.isFinite(play.result?.homeScore)) homeScore = play.result.homeScore

    const pitchEvents = (play.playEvents ?? []).filter((e) => e.isPitch)
    if (pitchEvents.length === 0) continue

    // 'top' bats away (home fields/pitches); 'bottom' bats home (away pitches).
    const battingTeamId = half === 'top' ? awayId : homeId
    const fieldingTeamId = half === 'top' ? homeId : awayId
    const starterId = half === 'top' ? homeStarter : awayStarter

    const isPA = !NON_PA_EVENT_TYPES.has(play.result?.eventType)

    const batterId = play.matchup?.batter?.id ?? null
    const pitcherId = play.matchup?.pitcher?.id ?? null
    const vsStarter = pitcherId != null && starterId != null && pitcherId === starterId

    const b = batterId != null ? getBatter(batterId, play.matchup?.batter?.fullName ?? '', battingTeamId) : null
    const p = pitcherId != null ? getPitcher(pitcherId, play.matchup?.pitcher?.fullName ?? '', fieldingTeamId) : null
    if (p && vsStarter) p.isStarter = true // he is his team's first pitcher this game
    // A batter's own team can't change mid-game, so the opponent he faced is the
    // same every time we touch him this game — just keep (re)setting it.
    if (b) b.opponentId = fieldingTeamId
    const team = battingTeamId != null ? getTeam(battingTeamId) : null
    const inn = getInning(Math.min(inningNum, MAX_INNING_BUCKET))

    if (isPA && b) b.pa += 1

    // A NEW plate appearance (not a resumed one) is where the "entering"
    // snapshot for this PA gets fixed — carried through any mid-AB
    // interruption via carryPaContext, same idea as carryStrikes.
    const isNewPa = batterId == null || batterId !== carryBatter
    const paContextEntering = isNewPa
      ? {
          outs: enteringOuts,
          onFirst: enteringOnFirst,
          onSecond: enteringOnSecond,
          onThird: enteringOnThird,
          awayScore: enteringAway,
          homeScore: enteringHome,
        }
      : carryPaContext

    let preStrikes = isNewPa ? 0 : carryStrikes
    let paFouls = isNewPa ? 0 : carryPaFouls

    for (const e of pitchEvents) {
      const code = pitchCallCode(e)
      const isFoul = !!code && FOUL_CODES.has(code)
      const isWhiff = !!code && WHIFF_CODES.has(code)
      // A two-strike foul TIP ('T') is caught for strike three — it ENDS the
      // at-bat, the opposite of the AB-extending spoil twoStrikeFouls
      // measures — so tips count as plain fouls only (mirrors derive.js).
      const twoStrike = isFoul && preStrikes === 2 && code !== 'T'

      if (b) b.pitchesSeen += 1
      if (p) p.pitches += 1
      inn.pitches += 1
      if (vsStarter) inn.pitchesVsStarter += 1
      else inn.pitchesVsReliever += 1

      const tcode = e.details?.type?.code
      if (tcode) {
        const desc = e.details?.type?.description
        const pt = getPitchType(tcode, desc)
        pt.pitches += 1
        if (isFoul) pt.fouls += 1
        if (isWhiff) pt.whiffs += 1
        if (battingTeamId != null) {
          const bpt = getTeamPitchType(battingPitchTypes, battingTeamId, tcode, desc)
          bpt.pitches += 1
          if (isFoul) bpt.fouls += 1
          if (isWhiff) bpt.whiffs += 1
        }
        if (fieldingTeamId != null) {
          const ppt = getTeamPitchType(pitchingPitchTypes, fieldingTeamId, tcode, desc)
          ppt.pitches += 1
          if (isFoul) ppt.fouls += 1
          if (isWhiff) ppt.whiffs += 1
        }
      }

      if (isWhiff && p) p.whiffs += 1

      if (isFoul) {
        if (b) {
          b.fouls += 1
          b.gameFouls += 1
        }
        if (p) p.fouls += 1
        if (team) team.fouls += 1
        inn.fouls += 1
        if (vsStarter) inn.foulsVsStarter += 1
        else inn.foulsVsReliever += 1
        if (twoStrike) {
          if (b) b.twoStrikeFouls += 1
          if (team) team.twoStrikeFouls += 1
        }
        paFouls += 1
      }

      preStrikes = e.count?.strikes ?? preStrikes
    }

    // A non-PA play's batter resumes with his count (and PA-foul tally +
    // entering snapshot) intact in a later play; a completed PA resets every
    // carry (mirrors derive.js) and, if it beats this GAME's best so far,
    // records the plate appearance's full context — a season-wide max is
    // resolved later by the SQL upsert's CASE guard, same as max_game_fouls.
    if (!isPA) {
      carryBatter = batterId
      carryStrikes = preStrikes
      carryPaFouls = paFouls
      carryPaContext = paContextEntering
    } else {
      carryBatter = null
      carryStrikes = 0
      carryPaFouls = 0
      carryPaContext = null
      if (b && paFouls > b.bestPaFouls) {
        b.bestPaFouls = paFouls
        b.bestPa = {
          pitcherId,
          pitcherName: p?.name ?? play.matchup?.pitcher?.fullName ?? '',
          resultEvent: play.result?.event ?? '',
          resultType: play.result?.eventType ?? '',
          inning: inningNum,
          half,
          battingTeamId,
          opponentId: fieldingTeamId,
          ...paContextEntering,
        }
      }
    }
  }

  // Final score, oriented to "his"/"opp" rather than home/away so the UI never
  // has to re-derive which side a batter's team was — his team can't change
  // mid-game, so teamId vs. awayId/homeId settles it once per batter.
  for (const [, b] of batters) {
    b.gameHisScore = b.teamId === awayId ? awayScore : homeScore
    b.gameOppScore = b.teamId === awayId ? homeScore : awayScore
  }

  // Both teams' fouls for THIS game (the "best souvenir odds" board) — just
  // the two sides of `teams` above, oriented home/away since neither side is
  // "his" the way a batter's own total is. awayScore/homeScore are already
  // the FINAL score at this point (the running trackers advanced on every
  // play all the way through the last one).
  const awayFouls = teams.get(awayId)?.fouls ?? 0
  const homeFouls = teams.get(homeId)?.fouls ?? 0
  const game = {
    awayId, homeId, awayFouls, homeFouls, totalFouls: awayFouls + homeFouls, awayScore, homeScore,
  }

  return {
    batters, pitchers, teams, innings, pitchTypes, game, battingPitchTypes, pitchingPitchTypes,
  }
}

// --- SQLite upserts ----------------------------------------------------------
const upsertBatter = (db) =>
  db.prepare(
    `INSERT INTO foul_batter_totals
       (person_id, season, name, team_id, games, pa, pitches_seen, fouls,
        two_strike_fouls, max_game_fouls, max_game_pk, max_game_pa,
        max_game_pitches, max_game_opp_id, max_game_his_score, max_game_opp_score)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(person_id) DO UPDATE SET
       season = excluded.season,
       name = excluded.name,
       team_id = excluded.team_id,
       games = foul_batter_totals.games + 1,
       pa = foul_batter_totals.pa + excluded.pa,
       pitches_seen = foul_batter_totals.pitches_seen + excluded.pitches_seen,
       fouls = foul_batter_totals.fouls + excluded.fouls,
       two_strike_fouls = foul_batter_totals.two_strike_fouls + excluded.two_strike_fouls,
       max_game_fouls = CASE WHEN excluded.max_game_fouls > foul_batter_totals.max_game_fouls
                             THEN excluded.max_game_fouls ELSE foul_batter_totals.max_game_fouls END,
       max_game_pk = CASE WHEN excluded.max_game_fouls > foul_batter_totals.max_game_fouls
                          THEN excluded.max_game_pk ELSE foul_batter_totals.max_game_pk END,
       max_game_pa = CASE WHEN excluded.max_game_fouls > foul_batter_totals.max_game_fouls
                          THEN excluded.max_game_pa ELSE foul_batter_totals.max_game_pa END,
       max_game_pitches = CASE WHEN excluded.max_game_fouls > foul_batter_totals.max_game_fouls
                          THEN excluded.max_game_pitches ELSE foul_batter_totals.max_game_pitches END,
       max_game_opp_id = CASE WHEN excluded.max_game_fouls > foul_batter_totals.max_game_fouls
                          THEN excluded.max_game_opp_id ELSE foul_batter_totals.max_game_opp_id END,
       max_game_his_score = CASE WHEN excluded.max_game_fouls > foul_batter_totals.max_game_fouls
                          THEN excluded.max_game_his_score ELSE foul_batter_totals.max_game_his_score END,
       max_game_opp_score = CASE WHEN excluded.max_game_fouls > foul_batter_totals.max_game_fouls
                          THEN excluded.max_game_opp_score ELSE foul_batter_totals.max_game_opp_score END`,
  )

// Every column beyond `fouls` rides the SAME CASE guard (excluded.fouls >
// the stored fouls) since they all describe the ONE plate appearance the
// fouls count belongs to — a season-wide max resolved the same way
// max_game_fouls is, just with a whole context object instead of a lone int.
const upsertBatterPaHigh = (db) =>
  db.prepare(
    `INSERT INTO foul_batter_pa_high
       (person_id, fouls, game_pk, pitcher_id, pitcher_name, result_event,
        result_type, inning, half, outs, on_first, on_second, on_third,
        away_score, home_score, batting_team_id, opponent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(person_id) DO UPDATE SET
       fouls = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                    THEN excluded.fouls ELSE foul_batter_pa_high.fouls END,
       game_pk = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                      THEN excluded.game_pk ELSE foul_batter_pa_high.game_pk END,
       pitcher_id = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                         THEN excluded.pitcher_id ELSE foul_batter_pa_high.pitcher_id END,
       pitcher_name = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                           THEN excluded.pitcher_name ELSE foul_batter_pa_high.pitcher_name END,
       result_event = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                           THEN excluded.result_event ELSE foul_batter_pa_high.result_event END,
       result_type = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                          THEN excluded.result_type ELSE foul_batter_pa_high.result_type END,
       inning = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                     THEN excluded.inning ELSE foul_batter_pa_high.inning END,
       half = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                   THEN excluded.half ELSE foul_batter_pa_high.half END,
       outs = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                   THEN excluded.outs ELSE foul_batter_pa_high.outs END,
       on_first = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                       THEN excluded.on_first ELSE foul_batter_pa_high.on_first END,
       on_second = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                        THEN excluded.on_second ELSE foul_batter_pa_high.on_second END,
       on_third = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                       THEN excluded.on_third ELSE foul_batter_pa_high.on_third END,
       away_score = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                         THEN excluded.away_score ELSE foul_batter_pa_high.away_score END,
       home_score = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                         THEN excluded.home_score ELSE foul_batter_pa_high.home_score END,
       batting_team_id = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                              THEN excluded.batting_team_id ELSE foul_batter_pa_high.batting_team_id END,
       opponent_id = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                          THEN excluded.opponent_id ELSE foul_batter_pa_high.opponent_id END`,
  )

const upsertPitcher = (db) =>
  db.prepare(
    `INSERT INTO foul_pitcher_totals
       (person_id, season, name, team_id, games, starts, pitches, fouls, whiffs)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
     ON CONFLICT(person_id) DO UPDATE SET
       season = excluded.season,
       name = excluded.name,
       team_id = excluded.team_id,
       games = foul_pitcher_totals.games + 1,
       starts = foul_pitcher_totals.starts + excluded.starts,
       pitches = foul_pitcher_totals.pitches + excluded.pitches,
       fouls = foul_pitcher_totals.fouls + excluded.fouls,
       whiffs = foul_pitcher_totals.whiffs + excluded.whiffs`,
  )

const upsertTeam = (db) =>
  db.prepare(
    `INSERT INTO foul_team_totals (team_id, season, games, fouls, two_strike_fouls)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET
       season = excluded.season,
       games = foul_team_totals.games + 1,
       fouls = foul_team_totals.fouls + excluded.fouls,
       two_strike_fouls = foul_team_totals.two_strike_fouls + excluded.two_strike_fouls`,
  )

const upsertInning = (db) =>
  db.prepare(
    `INSERT INTO foul_league_innings
       (inning, season, pitches, fouls, pitches_vs_starter, fouls_vs_starter,
        pitches_vs_reliever, fouls_vs_reliever)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(inning) DO UPDATE SET
       season = excluded.season,
       pitches = foul_league_innings.pitches + excluded.pitches,
       fouls = foul_league_innings.fouls + excluded.fouls,
       pitches_vs_starter = foul_league_innings.pitches_vs_starter + excluded.pitches_vs_starter,
       fouls_vs_starter = foul_league_innings.fouls_vs_starter + excluded.fouls_vs_starter,
       pitches_vs_reliever = foul_league_innings.pitches_vs_reliever + excluded.pitches_vs_reliever,
       fouls_vs_reliever = foul_league_innings.fouls_vs_reliever + excluded.fouls_vs_reliever`,
  )

const upsertPitchType = (db) =>
  db.prepare(
    `INSERT INTO foul_pitch_types (code, season, description, pitches, fouls, whiffs)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       season = excluded.season,
       description = excluded.description,
       pitches = foul_pitch_types.pitches + excluded.pitches,
       fouls = foul_pitch_types.fouls + excluded.fouls,
       whiffs = foul_pitch_types.whiffs + excluded.whiffs`,
  )

const upsertTeamPitchTypeBatting = (db) =>
  db.prepare(
    `INSERT INTO foul_team_pitch_types_batting (team_id, code, season, description, pitches, fouls, whiffs)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_id, code) DO UPDATE SET
       season = excluded.season,
       description = excluded.description,
       pitches = foul_team_pitch_types_batting.pitches + excluded.pitches,
       fouls = foul_team_pitch_types_batting.fouls + excluded.fouls,
       whiffs = foul_team_pitch_types_batting.whiffs + excluded.whiffs`,
  )

const upsertTeamPitchTypePitching = (db) =>
  db.prepare(
    `INSERT INTO foul_team_pitch_types_pitching (team_id, code, season, description, pitches, fouls, whiffs)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_id, code) DO UPDATE SET
       season = excluded.season,
       description = excluded.description,
       pitches = foul_team_pitch_types_pitching.pitches + excluded.pitches,
       fouls = foul_team_pitch_types_pitching.fouls + excluded.fouls,
       whiffs = foul_team_pitch_types_pitching.whiffs + excluded.whiffs`,
  )

// A whole game is inserted (or, during --backfill-games, re-upserted) as one
// unit — there's no per-column accumulation the way the season totals above
// have, so a plain overwrite-on-conflict is correct rather than a CASE guard.
const upsertGameTotals = (db) =>
  db.prepare(
    `INSERT INTO foul_game_totals
       (game_pk, home_team_id, home_fouls, home_score, away_team_id, away_fouls, away_score, total_fouls)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_pk) DO UPDATE SET
       home_team_id = excluded.home_team_id,
       home_fouls = excluded.home_fouls,
       home_score = excluded.home_score,
       away_team_id = excluded.away_team_id,
       away_fouls = excluded.away_fouls,
       away_score = excluded.away_score,
       total_fouls = excluded.total_fouls`,
  )

const markIngested = (db) => db.prepare('INSERT OR IGNORE INTO foul_ingested_games (game_pk, date) VALUES (?, ?)')

// Fetch the feed (the only await), then fold the whole game in as one atomic
// synchronous transaction — same pattern/rationale as gen-postseason-leaders.mjs:
// Node's single thread means the sync block runs to completion before any other
// worker's transaction, so either every row AND the ingest mark commit together
// or none do, and a resumed run never re-adds a partially-counted game.
async function ingestGame(db, stmts, gamePk, date, season) {
  const feed = await getJson(`/api/v1.1/game/${gamePk}/feed/live`)
  const agg = aggregateGameFouls(feed)
  db.exec('BEGIN')
  try {
    for (const [id, b] of agg.batters) {
      stmts.batter.run(
        id, season, b.name, b.teamId, b.pa, b.pitchesSeen, b.fouls, b.twoStrikeFouls,
        b.gameFouls, gamePk, b.pa, b.pitchesSeen, b.opponentId, b.gameHisScore, b.gameOppScore,
      )
      if (b.bestPa) {
        const pa = b.bestPa
        stmts.batterPaHigh.run(
          id, b.bestPaFouls, gamePk, pa.pitcherId, pa.pitcherName, pa.resultEvent,
          pa.resultType, pa.inning, pa.half, pa.outs, pa.onFirst ? 1 : 0, pa.onSecond ? 1 : 0,
          pa.onThird ? 1 : 0, pa.awayScore, pa.homeScore, pa.battingTeamId, pa.opponentId,
        )
      }
    }
    for (const [id, p] of agg.pitchers) {
      stmts.pitcher.run(id, season, p.name, p.teamId, p.isStarter ? 1 : 0, p.pitches, p.fouls, p.whiffs)
    }
    for (const [id, t] of agg.teams) {
      stmts.team.run(id, season, t.fouls, t.twoStrikeFouls)
    }
    for (const [inning, i] of agg.innings) {
      stmts.inning.run(inning, season, i.pitches, i.fouls, i.pitchesVsStarter, i.foulsVsStarter, i.pitchesVsReliever, i.foulsVsReliever)
    }
    for (const [code, pt] of agg.pitchTypes) {
      stmts.pitchType.run(code, season, pt.description, pt.pitches, pt.fouls, pt.whiffs)
    }
    for (const [teamId, byCode] of agg.battingPitchTypes) {
      for (const [code, pt] of byCode) {
        stmts.teamPitchTypeBatting.run(teamId, code, season, pt.description, pt.pitches, pt.fouls, pt.whiffs)
      }
    }
    for (const [teamId, byCode] of agg.pitchingPitchTypes) {
      for (const [code, pt] of byCode) {
        stmts.teamPitchTypePitching.run(teamId, code, season, pt.description, pt.pitches, pt.fouls, pt.whiffs)
      }
    }
    stmts.game.run(gamePk, agg.game.homeId, agg.game.homeFouls, agg.game.homeScore, agg.game.awayId, agg.game.awayFouls, agg.game.awayScore, agg.game.totalFouls)
    stmts.mark.run(gamePk, date)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

// --- JSON export from the accumulated tables ---------------------------------
export function exportFouls(db) {
  const ingested = db.prepare('SELECT game_pk, date FROM foul_ingested_games').all()
  const coverageSince = ingested.reduce((min, r) => (min == null || r.date < min ? r.date : min), null)
  const seasonRow = db.prepare('SELECT season FROM foul_batter_totals LIMIT 1').get()
  const season = seasonRow?.season ?? (Number((coverageSince ?? '').slice(0, 4)) || null)

  // gamePk -> officialDate, so a batter's max-game record can carry a date
  // without duplicating it onto every row (foul_ingested_games already has it).
  const dateByGamePk = new Map(
    db.prepare('SELECT game_pk, date FROM foul_ingested_games').all().map((r) => [r.game_pk, r.date]),
  )

  const paHighByPerson = new Map(
    db.prepare('SELECT * FROM foul_batter_pa_high WHERE fouls > 0').all().map((r) => [r.person_id, r]),
  )

  const batters = {}
  for (const r of db.prepare('SELECT * FROM foul_batter_totals').all()) {
    const pa = paHighByPerson.get(r.person_id)
    batters[r.person_id] = {
      name: r.name,
      teamId: r.team_id,
      g: r.games,
      pa: r.pa,
      pitchesSeen: r.pitches_seen,
      fouls: r.fouls,
      twoStrikeFouls: r.two_strike_fouls,
      maxGameFouls: r.max_game_fouls,
      maxGamePk: r.max_game_pk,
      maxGamePa: r.max_game_pa,
      maxGamePitches: r.max_game_pitches,
      maxGameOpponentId: r.max_game_opp_id,
      maxGameHisScore: r.max_game_his_score,
      maxGameOppScore: r.max_game_opp_score,
      maxGameDate: r.max_game_pk != null ? (dateByGamePk.get(r.max_game_pk) ?? null) : null,
      bestPa: pa
        ? {
            fouls: pa.fouls,
            gamePk: pa.game_pk,
            date: dateByGamePk.get(pa.game_pk) ?? null,
            pitcherId: pa.pitcher_id,
            pitcherName: pa.pitcher_name,
            resultEvent: pa.result_event,
            resultType: pa.result_type,
            inning: pa.inning,
            half: pa.half,
            outs: pa.outs,
            onFirst: !!pa.on_first,
            onSecond: !!pa.on_second,
            onThird: !!pa.on_third,
            awayScore: pa.away_score,
            homeScore: pa.home_score,
            battingTeamId: pa.batting_team_id,
            opponentId: pa.opponent_id,
          }
        : null,
    }
  }

  const pitchers = {}
  for (const r of db.prepare('SELECT * FROM foul_pitcher_totals').all()) {
    pitchers[r.person_id] = {
      name: r.name,
      teamId: r.team_id,
      g: r.games,
      pitches: r.pitches,
      fouls: r.fouls,
      whiffs: r.whiffs,
      isStarter: r.starts * 2 > r.games, // majority of appearances were starts
    }
  }

  const teams = {}
  for (const r of db.prepare('SELECT * FROM foul_team_totals').all()) {
    teams[r.team_id] = { g: r.games, fouls: r.fouls, twoStrikeFouls: r.two_strike_fouls }
  }

  const byInning = db
    .prepare('SELECT * FROM foul_league_innings ORDER BY inning')
    .all()
    .map((r) => ({
      inning: r.inning,
      pitches: r.pitches,
      fouls: r.fouls,
      vsStarter: { pitches: r.pitches_vs_starter, fouls: r.fouls_vs_starter },
      vsReliever: { pitches: r.pitches_vs_reliever, fouls: r.fouls_vs_reliever },
    }))

  const byPitchType = db
    .prepare('SELECT * FROM foul_pitch_types ORDER BY pitches DESC')
    .all()
    .map((r) => ({ code: r.code, description: r.description, pitches: r.pitches, fouls: r.fouls, whiffs: r.whiffs }))

  // Every game with a combined total, richest first — the reader trims this to
  // a top N (see src/api/fouls.js's topFoulGames), same "export the full sorted
  // pool, let the page slice it" convention foulLeaders' callers use.
  const topFoulGames = db
    .prepare('SELECT * FROM foul_game_totals ORDER BY total_fouls DESC')
    .all()
    .map((r) => ({
      gamePk: r.game_pk,
      date: dateByGamePk.get(r.game_pk) ?? null,
      homeTeamId: r.home_team_id,
      homeFouls: r.home_fouls,
      homeScore: r.home_score,
      awayTeamId: r.away_team_id,
      awayFouls: r.away_fouls,
      awayScore: r.away_score,
      totalFouls: r.total_fouls,
    }))

  // League totals: pitches from the by-inning sum (every pitch is bucketed by
  // inning); fouls / two-strike fouls from the team sum (every foul is a foul BY
  // some team's batter) — the two independent roll-ups cross-check each other.
  const totals = {
    pitches: byInning.reduce((s, r) => s + r.pitches, 0),
    fouls: Object.values(teams).reduce((s, t) => s + t.fouls, 0),
    twoStrikeFouls: Object.values(teams).reduce((s, t) => s + t.twoStrikeFouls, 0),
  }

  // Team-filtered pitch-type rows: keyed teamId -> array of rows, so the
  // reader (src/api/fouls.js's teamPitchTypeRates) can look up one team's
  // slice without scanning every row. `batting` is that team's own batters'
  // fouls BY pitch type (whoever was pitching); `pitching` is that team's own
  // pitchers' fouls BY pitch type (whoever was batting) — see schema.sql's
  // foul_team_pitch_types_batting/_pitching for why these are two tables.
  const groupByTeam = (rows) => {
    const byTeam = {}
    for (const r of rows) {
      const list = byTeam[r.team_id] ?? (byTeam[r.team_id] = [])
      list.push({ code: r.code, description: r.description, pitches: r.pitches, fouls: r.fouls, whiffs: r.whiffs })
    }
    return byTeam
  }
  const teamPitchTypes = {
    batting: groupByTeam(db.prepare('SELECT * FROM foul_team_pitch_types_batting').all()),
    pitching: groupByTeam(db.prepare('SELECT * FROM foul_team_pitch_types_pitching').all()),
  }

  return {
    season,
    asOf: new Date().toISOString(),
    coverageSince,
    gamesIngested: ingested.length,
    batters,
    pitchers,
    teams,
    league: { byInning, byPitchType, totals },
    topFoulGames,
    teamPitchTypes,
  }
}

// --- CLI ---------------------------------------------------------------------
function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (m) args[m[1]] = m[2]
    else if (a.startsWith('--')) args[a.slice(2)] = true
  }
  return args
}

const isoDay = (d) => d.toISOString().slice(0, 10)

function dateRange(args) {
  const today = new Date()
  if (args.since) return { startDate: args.since, endDate: args.until || isoDay(today) }
  const days = Number(args.days) || DEFAULT_DAYS
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: isoDay(start), endDate: isoDay(today) }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { startDate, endDate } = dateRange(args)

  const db = await openDb()
  const stmts = {
    batter: upsertBatter(db),
    batterPaHigh: upsertBatterPaHigh(db),
    pitcher: upsertPitcher(db),
    team: upsertTeam(db),
    inning: upsertInning(db),
    pitchType: upsertPitchType(db),
    teamPitchTypeBatting: upsertTeamPitchTypeBatting(db),
    teamPitchTypePitching: upsertTeamPitchTypePitching(db),
    game: upsertGameTotals(db),
    mark: markIngested(db),
  }

  // One-time backfill: foul_game_totals didn't exist when most of this season's
  // games were first swept, so their per-game totals are missing even though
  // they're already in foul_ingested_games (and thus skipped by the normal
  // pending-games loop below, which only ever looks at UN-ingested gamePks).
  // Re-fetches every already-ingested game's feed and upserts ONLY
  // foul_game_totals — never touches the accumulating season tables, so it's
  // safe to run repeatedly and never double-counts them. Add --force to
  // re-fill EVERY already-ingested game rather than just the ones with no row
  // yet — needed the one time a column is added to foul_game_totals itself
  // (e.g. away_score/home_score) after the first --backfill-games already ran,
  // since those existing rows have the new column defaulted, not populated.
  //   node scripts/gen-fouls.mjs --backfill-games [--force]
  if (args['backfill-games']) {
    const already = new Set(db.prepare('SELECT game_pk FROM foul_game_totals').all().map((r) => r.game_pk))
    const targets = db
      .prepare('SELECT game_pk FROM foul_ingested_games')
      .all()
      .map((r) => r.game_pk)
      .filter((pk) => args.force || !already.has(pk))
    console.log(`--backfill-games${args.force ? ' --force' : ''}: ${targets.length} games to (re)fill in foul_game_totals`)
    let done = 0
    const queue = [...targets]
    async function backfillWorker() {
      while (queue.length) {
        const gamePk = queue.shift()
        if (gamePk == null) return
        try {
          const feed = await getJson(`/api/v1.1/game/${gamePk}/feed/live`)
          const agg = aggregateGameFouls(feed)
          stmts.game.run(gamePk, agg.game.homeId, agg.game.homeFouls, agg.game.homeScore, agg.game.awayId, agg.game.awayFouls, agg.game.awayScore, agg.game.totalFouls)
        } catch (err) {
          console.error(`backfill gamePk ${gamePk}: ${err.message}`)
        }
        done += 1
        if (done % CHECKPOINT_EVERY === 0) {
          console.log(`${done}/${targets.length} backfilled, checkpointing...`)
          await dumpGroup(db, 'fouls')
          await mkdir(dirname(out), { recursive: true })
          await writeFile(out, JSON.stringify(exportFouls(db)))
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, backfillWorker))
    await dumpGroup(db, 'fouls')
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, JSON.stringify(exportFouls(db)))
    console.log(`backfilled ${done} games' foul_game_totals`)
    db.close()
    return
  }

  // One-time (re)build of the per-team pitch-type tables — added after most
  // of the season's games were already swept, same situation as
  // --backfill-games. UNLIKE that one, these two tables ACCUMULATE across
  // games (like foul_pitch_types) rather than overwrite per gamePk, so there
  // is no "just fill the missing rows" option: re-running against an
  // already-populated table would double-count every game it touches again.
  // Always wipes both tables first and rebuilds from every already-ingested
  // game's feed, so it's safe to re-run (e.g. after a season reset) — it
  // always starts from zero, never adds onto whatever was there.
  //   node scripts/gen-fouls.mjs --backfill-team-pitch-types
  if (args['backfill-team-pitch-types']) {
    db.exec('DELETE FROM foul_team_pitch_types_batting')
    db.exec('DELETE FROM foul_team_pitch_types_pitching')
    const targets = db.prepare('SELECT game_pk, date FROM foul_ingested_games').all()
    console.log(`--backfill-team-pitch-types: rebuilding from ${targets.length} already-ingested games`)
    let done = 0
    const queue = [...targets]
    async function teamPitchTypeWorker() {
      while (queue.length) {
        const g = queue.shift()
        if (!g) return
        try {
          const feed = await getJson(`/api/v1.1/game/${g.game_pk}/feed/live`)
          const agg = aggregateGameFouls(feed)
          const season = Number(g.date.slice(0, 4))
          db.exec('BEGIN')
          try {
            for (const [teamId, byCode] of agg.battingPitchTypes) {
              for (const [code, pt] of byCode) {
                stmts.teamPitchTypeBatting.run(teamId, code, season, pt.description, pt.pitches, pt.fouls, pt.whiffs)
              }
            }
            for (const [teamId, byCode] of agg.pitchingPitchTypes) {
              for (const [code, pt] of byCode) {
                stmts.teamPitchTypePitching.run(teamId, code, season, pt.description, pt.pitches, pt.fouls, pt.whiffs)
              }
            }
            db.exec('COMMIT')
          } catch (err) {
            db.exec('ROLLBACK')
            throw err
          }
        } catch (err) {
          console.error(`team-pitch-type backfill gamePk ${g.game_pk}: ${err.message}`)
        }
        done += 1
        if (done % CHECKPOINT_EVERY === 0) {
          console.log(`${done}/${targets.length} rebuilt, checkpointing...`)
          await dumpGroup(db, 'fouls')
          await mkdir(dirname(out), { recursive: true })
          await writeFile(out, JSON.stringify(exportFouls(db)))
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, teamPitchTypeWorker))
    await dumpGroup(db, 'fouls')
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, JSON.stringify(exportFouls(db)))
    console.log(`rebuilt foul_team_pitch_types_batting/pitching from ${done} games`)
    db.close()
    return
  }

  const existing = new Set(db.prepare('SELECT game_pk FROM foul_ingested_games').all().map((r) => r.game_pk))

  // MLB regular season only. Same postponed-replay dedup as the other sweeps: a
  // replayed game is listed under both dates; keep only the officialDate bucket.
  const schedule = await getJson(
    `/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R`,
  )
  const pending = []
  for (const d of schedule.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status?.abstractGameState !== 'Final') continue
      if (d.date !== g.officialDate) continue
      if (existing.has(g.gamePk)) continue
      pending.push({ gamePk: g.gamePk, date: g.officialDate, season: g.season ?? Number(g.officialDate.slice(0, 4)) })
    }
  }
  console.log(`${startDate}..${endDate}: ${pending.length} un-ingested Final MLB regular-season games`)

  const writeOut = async () => {
    await dumpGroup(db, 'fouls')
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, JSON.stringify(exportFouls(db)))
  }

  let done = 0
  const queue = [...pending]
  async function worker() {
    while (queue.length) {
      const g = queue.shift()
      if (!g) return
      try {
        await ingestGame(db, stmts, g.gamePk, g.date, g.season)
      } catch (err) {
        console.error(`gamePk ${g.gamePk}: ${err.message}`)
      }
      done += 1
      if (done % CHECKPOINT_EVERY === 0) {
        console.log(`${done}/${pending.length} ingested, checkpointing...`)
        await writeOut()
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  await writeOut()

  const total = db.prepare('SELECT COUNT(*) AS n FROM foul_ingested_games').get().n
  console.log(`wrote ${out} — ${total} games on file (+${done} swept this run)`)
  db.close()
}

// Only sweep when run as a script — keeps aggregateGameFouls / exportFouls
// importable for tests without triggering a live fetch + file write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
