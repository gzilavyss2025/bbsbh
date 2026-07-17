// Regenerates public/data/postseason-leaders.json — since-2000 career
// postseason leaderboards (batting + pitching), plus franchise/award
// leaders derived straight from the already-generated postseason-history.json
// (no extra fetch needed for those).
//
// Player batting/pitching totals need per-game boxscore stat lines that
// gen-postseason-history.mjs never fetches (it only stores series/game
// RESULTS, not individual stat lines) — this is the genuine cross-game
// aggregation case docs/adr/0021 calls out as the reason to add a new
// SQLite table group rather than another bespoke JSON file. Every
// postseason game's boxscore is folded ONCE into an incrementing career
// total per player (scripts/lib/schema.sql's postseason_batting_totals /
// postseason_pitching_totals — CAREER totals, not one row per game: a
// per-game grain would be ~30x more rows for value this page doesn't need,
// and a full re-sweep of every game since 2000 takes under a minute, so
// there's no real cost to re-deriving it fresh instead of keeping a bulky
// per-game ledger in git). postseason_ingested_games is the idempotency
// guard so a resumed/re-run sweep never double-counts an already-folded
// game.
//
// Hand-run, like gen-postseason-history.mjs — postseason results are
// immutable once played, so this is a yearly regenerate, not a cron.
// RUN gen-postseason-history.mjs FIRST: this script reads its gamePk list
// straight from public/data/postseason-history.json rather than re-walking
// the schedule API itself.
//
// Source: GET /api/v1/game/{gamePk}/boxscore per game (verified live
// against gamePk 263172 — 2009 ALCS Game 6 — batting carries atBats/hits/
// doubles/triples/homeRuns/rbi/stolenBases/caughtStealing/baseOnBalls/
// strikeOuts directly, pitching carries outs/wins/losses/saves/hits/
// earnedRuns/baseOnBalls/strikeOuts directly — no separate decision/box
// lookup needed for W/L/SV).
//
// Run by hand: node scripts/gen-postseason-leaders.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb, dumpGroup } from './lib/db.js'

const here = dirname(fileURLToPath(import.meta.url))
const historyPath = join(here, '..', 'public', 'data', 'postseason-history.json')
const out = join(here, '..', 'public', 'data', 'postseason-leaders.json')
const BASE = 'https://statsapi.mlb.com'

// Career-postseason qualifier floors for rate stats — same idea as the live
// leader boards' playing-time floor (teamLeaders.js): a single pinch-hit at-bat
// or one mop-up relief inning shouldn't win a rate-stat leaderboard.
const MIN_AB_FOR_AVG = 40
const MIN_OUTS_FOR_ERA = 45 // 15 innings
const TOP_N = 10
const CHECKPOINT_EVERY = 100
const CONCURRENCY = 8

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

function allGames(history) {
  const games = []
  for (const season of history.seasons) {
    for (const round of season.rounds) {
      for (const series of round.series) {
        for (const g of series.games) {
          games.push({ gamePk: g.gamePk, season: season.year })
        }
      }
    }
  }
  return games
}

const markIngested = (db) => db.prepare('INSERT OR IGNORE INTO postseason_ingested_games (game_pk) VALUES (?)')

const upsertBatting = (db) =>
  db.prepare(
    `INSERT INTO postseason_batting_totals
       (player_id, player_name, latest_team_id, latest_season, at_bats, runs, hits,
        doubles, triples, home_runs, rbi, stolen_bases, caught_stealing, walks, strikeouts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET
       player_name = excluded.player_name,
       latest_team_id = CASE WHEN excluded.latest_season >= postseason_batting_totals.latest_season
                              THEN excluded.latest_team_id ELSE postseason_batting_totals.latest_team_id END,
       latest_season = MAX(postseason_batting_totals.latest_season, excluded.latest_season),
       at_bats = postseason_batting_totals.at_bats + excluded.at_bats,
       runs = postseason_batting_totals.runs + excluded.runs,
       hits = postseason_batting_totals.hits + excluded.hits,
       doubles = postseason_batting_totals.doubles + excluded.doubles,
       triples = postseason_batting_totals.triples + excluded.triples,
       home_runs = postseason_batting_totals.home_runs + excluded.home_runs,
       rbi = postseason_batting_totals.rbi + excluded.rbi,
       stolen_bases = postseason_batting_totals.stolen_bases + excluded.stolen_bases,
       caught_stealing = postseason_batting_totals.caught_stealing + excluded.caught_stealing,
       walks = postseason_batting_totals.walks + excluded.walks,
       strikeouts = postseason_batting_totals.strikeouts + excluded.strikeouts`,
  )

const upsertPitching = (db) =>
  db.prepare(
    `INSERT INTO postseason_pitching_totals
       (player_id, player_name, latest_team_id, latest_season, outs, wins, losses, saves,
        hits, earned_runs, walks, strikeouts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET
       player_name = excluded.player_name,
       latest_team_id = CASE WHEN excluded.latest_season >= postseason_pitching_totals.latest_season
                              THEN excluded.latest_team_id ELSE postseason_pitching_totals.latest_team_id END,
       latest_season = MAX(postseason_pitching_totals.latest_season, excluded.latest_season),
       outs = postseason_pitching_totals.outs + excluded.outs,
       wins = postseason_pitching_totals.wins + excluded.wins,
       losses = postseason_pitching_totals.losses + excluded.losses,
       saves = postseason_pitching_totals.saves + excluded.saves,
       hits = postseason_pitching_totals.hits + excluded.hits,
       earned_runs = postseason_pitching_totals.earned_runs + excluded.earned_runs,
       walks = postseason_pitching_totals.walks + excluded.walks,
       strikeouts = postseason_pitching_totals.strikeouts + excluded.strikeouts`,
  )

async function ingestGame(db, insertBat, insertPitch, markGame, gamePk, season) {
  const box = await getJson(`/api/v1/game/${gamePk}/boxscore`)
  for (const side of [box.teams?.away, box.teams?.home]) {
    if (!side) continue
    const teamId = side.team.id
    for (const key of Object.keys(side.players ?? {})) {
      const p = side.players[key]
      const personId = p.person?.id
      if (!personId) continue
      const name = p.person.fullName ?? ''
      const bat = p.stats?.batting
      if (bat && (bat.atBats > 0 || bat.plateAppearances > 0)) {
        insertBat.run(
          personId, name, teamId, season,
          bat.atBats ?? 0, bat.runs ?? 0, bat.hits ?? 0, bat.doubles ?? 0, bat.triples ?? 0,
          bat.homeRuns ?? 0, bat.rbi ?? 0, bat.stolenBases ?? 0, bat.caughtStealing ?? 0,
          bat.baseOnBalls ?? 0, bat.strikeOuts ?? 0,
        )
      }
      const pitch = p.stats?.pitching
      if (pitch && pitch.outs > 0) {
        insertPitch.run(
          personId, name, teamId, season,
          pitch.outs ?? 0, pitch.wins ?? 0, pitch.losses ?? 0, pitch.saves ?? 0,
          pitch.hits ?? 0, pitch.earnedRuns ?? 0, pitch.baseOnBalls ?? 0, pitch.strikeOuts ?? 0,
        )
      }
    }
  }
  markGame.run(gamePk)
}

// --- team/award leaders, straight from postseason-history.json (free — no fetch) ---

function topCounts(counter, limit = TOP_N) {
  return [...counter.entries()]
    .map(([teamId, count]) => ({ teamId: Number(teamId), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function computeTeamLeaders(history) {
  const titles = new Map()
  const pennants = new Map()
  const appearances = new Map()

  for (const season of history.seasons) {
    if (season.championTeamId) {
      titles.set(season.championTeamId, (titles.get(season.championTeamId) ?? 0) + 1)
    }
    const ws = season.rounds.find((r) => r.key === 'worldseries')?.series?.[0]
    if (ws) {
      for (const teamId of [ws.teamA.teamId, ws.teamB.teamId]) {
        pennants.set(teamId, (pennants.get(teamId) ?? 0) + 1)
      }
    }
    const seasonTeamIds = new Set()
    for (const round of season.rounds) {
      for (const series of round.series) {
        seasonTeamIds.add(series.teamA.teamId)
        seasonTeamIds.add(series.teamB.teamId)
      }
    }
    for (const teamId of seasonTeamIds) {
      appearances.set(teamId, (appearances.get(teamId) ?? 0) + 1)
    }
  }

  return { titles: topCounts(titles), pennants: topCounts(pennants), appearances: topCounts(appearances) }
}

// Multiple-time Series MVP winners (LCS + World Series combined) — a fun,
// zero-extra-fetch category since gen-postseason-history.mjs already stores
// each series' mvp. Filtered to 2+ so this reads as "repeat winners", not a
// long tail of everyone who's won it once.
function computeMvpLeaders(history) {
  const byPlayer = new Map()
  for (const season of history.seasons) {
    for (const round of season.rounds) {
      if (round.key !== 'lcs' && round.key !== 'worldseries') continue
      for (const series of round.series) {
        if (!series.mvp) continue
        const key = series.mvp.playerId
        const entry = byPlayer.get(key) ?? { ...series.mvp, count: 0, lastSeason: 0 }
        entry.count += 1
        if (season.year >= entry.lastSeason) {
          entry.lastSeason = season.year
          entry.teamId = series.mvp.teamId
          entry.name = series.mvp.name
          entry.position = series.mvp.position
        }
        byPlayer.set(key, entry)
      }
    }
  }
  return [...byPlayer.values()]
    .filter((p) => p.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map(({ playerId, name, teamId, position, count }) => ({ playerId, name, teamId, position, count }))
}

// --- batting/pitching leaderboards, from the SQLite career totals ---

function battingLeaders(db) {
  const rows = db
    .prepare(
      `SELECT player_id, player_name, latest_team_id AS team_id, at_bats AS ab, hits AS h,
              home_runs AS hr, rbi, stolen_bases AS sb
       FROM postseason_batting_totals`,
    )
    .all()
  const rank = (key) =>
    rows
      .map((r) => ({ playerId: r.player_id, name: r.player_name, teamId: r.team_id, value: r[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N)

  const avgRows = rows
    .filter((r) => r.ab >= MIN_AB_FOR_AVG)
    .map((r) => ({
      playerId: r.player_id,
      name: r.player_name,
      teamId: r.team_id,
      value: Number((r.h / r.ab).toFixed(3)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N)

  return {
    homeRuns: rank('hr'),
    rbi: rank('rbi'),
    hits: rank('h'),
    stolenBases: rank('sb'),
    avg: avgRows,
  }
}

function pitchingLeaders(db) {
  const rows = db
    .prepare(
      `SELECT player_id, player_name, latest_team_id AS team_id, wins AS w, strikeouts AS so,
              saves AS sv, outs, earned_runs AS er
       FROM postseason_pitching_totals`,
    )
    .all()
  const rank = (key) =>
    rows
      .map((r) => ({ playerId: r.player_id, name: r.player_name, teamId: r.team_id, value: r[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N)

  const eraRows = rows
    .filter((r) => r.outs >= MIN_OUTS_FOR_ERA)
    .map((r) => ({
      playerId: r.player_id,
      name: r.player_name,
      teamId: r.team_id,
      value: Number(((r.er * 27) / r.outs).toFixed(2)),
    }))
    .sort((a, b) => a.value - b.value)
    .slice(0, TOP_N)

  return { wins: rank('w'), strikeouts: rank('so'), saves: rank('sv'), era: eraRows }
}

async function main() {
  const history = JSON.parse(await readFile(historyPath, 'utf8'))
  const games = allGames(history)

  const db = await openDb()
  const existing = new Set(
    db.prepare('SELECT game_pk FROM postseason_ingested_games').all().map((r) => r.game_pk),
  )
  const pending = games.filter((g) => !existing.has(g.gamePk))
  console.log(`${games.length} postseason games total, ${pending.length} not yet ingested`)

  const insertBat = upsertBatting(db)
  const insertPitch = upsertPitching(db)
  const markGame = markIngested(db)

  const writeOut = async () => {
    await dumpGroup(db, 'postseason-player-stats')
    await mkdir(dirname(out), { recursive: true })
    await writeFile(
      out,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        since: history.seasons[history.seasons.length - 1]?.year ?? null,
        teams: computeTeamLeaders(history),
        mvpAwards: computeMvpLeaders(history),
        batting: battingLeaders(db),
        pitching: pitchingLeaders(db),
      }),
    )
  }

  let done = 0
  const queue = [...pending]
  async function worker() {
    while (queue.length) {
      const g = queue.shift()
      if (!g) return
      try {
        await ingestGame(db, insertBat, insertPitch, markGame, g.gamePk, g.season)
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
  console.log(`wrote ${out}`)
}

main()
