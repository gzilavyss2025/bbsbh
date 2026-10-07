// Regenerates public/data/comeback-wins.json — per-team, per-season COMEBACK
// counts that form a comeback RATE. For every Final game, BOTH sides' minimum
// win probability is bucketed: whichever side fell below 10 / 20 / 30% at some
// point counts an ATTEMPT (att10/att20/att30) at that depth, and if that side
// went on to win it also counts a comeback WIN (sub10/sub20/sub30). So a team's
// (or the league's) rate of clawing back from a given hole is sub/att, and both
// pairs are NESTED (a sub-10 win also counts sub-20/sub-30; likewise att).
// Shown on the Team Page as the "Comeback wins" card (rate vs. league baseline)
// when non-zero — see src/api/comebackWins.js. The MLB POSTSEASON sits BESIDE the
// regular season, never inside it (ADR-0094): each row carries scope 'R' or 'P',
// the export keeps the regular season under `byTeamId` as before and adds a `post`
// block, and the league baseline stays regular season.
//
// Spoiler-safe: a season aggregate over FINAL games carries no live-game score
// (same footing as WAR / the team-score aggregates), so the Team-page card needs
// no SealBox. Only the in-game per-play win prob (src/api/winprob.js) is sealed.
//
// APPEND-ONLY / incremental, same shape as gen-fouls.mjs:
// each run sweeps a small trailing window of dates, and for every newly-Final
// MLB game (regular season or postseason) not already ingested, fetches its win-probability
// history, buckets BOTH sides' minimum win %, and folds attempts (both sides) +
// wins (winner) into the running per-team totals (SQLite, docs/adr/0021). A
// Final game's win-prob history never changes, so an already-ingested game is
// never refetched (guarded by comeback_ingested_games). MLB only (sportId 1) —
// the winProbability endpoint is MLB-only (see src/api/game.js) and a league
// rank needs the whole 30-team pool anyway; MiLB parks have no endpoint.
//
// Run by hand:
//   node scripts/gen-comeback-wins.mjs            # trailing 3 days
//   node scripts/gen-comeback-wins.mjs --days=200 # season-to-date backfill
//   node scripts/gen-comeback-wins.mjs --rebuild --days=200
//                                     # wipe both tables first, then re-ingest —
//                                     # required when a schema change leaves old rows
//                                     # without data the new column needs (the att*
//                                     # columns did). The `scope` column does NOT:
//                                     # it defaults to 'R'.
//   node scripts/gen-comeback-wins.mjs --days=<n>  # postseason backfill: the nightly
//                                     # window is 3 days, so older October games
//                                     # need a hand run reaching back to them.
import { dirname, join } from 'node:path'
import { writeJsonAtomic } from './lib/io.js'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openDb, dumpGroup } from './lib/db.js'
import { getJson } from './lib/statsapi.mjs'
import { POSTSEASON_GAME_TYPES, scopeOfGameType } from './lib/records/postseason.mjs'
import { parseArgs } from './lib/args.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'comeback-wins.json')
const DEFAULT_DAYS = 3
// The cumulative home win % (+ its `about` for nothing here, but kept minimal).
// Only homeTeamWinProbability is read; pruning keeps each game's payload small.
const WP_FIELDS = 'homeTeamWinProbability'

const isoDay = (d) => d.toISOString().slice(0, 10)
const args = parseArgs(process.argv.slice(2))
const days = Number(args.days) || DEFAULT_DAYS

// BOTH sides' MINIMUM win probability across the whole game. Home's share is
// homeTeamWinProbability directly, so its minimum is the running low; the away
// team's share is 100 − that, so the away minimum is 100 − the home MAXIMUM.
// Null when the endpoint carries no numeric win prob (shouldn't happen for a
// Final MLB game, but guard).
export function bothMinWinProbs(winProb) {
  if (!Array.isArray(winProb) || winProb.length === 0) return null
  let minHome = Infinity
  let maxHome = -Infinity
  let seen = false
  for (const e of winProb) {
    const h = e?.homeTeamWinProbability
    if (typeof h !== 'number') continue
    seen = true
    if (h < minHome) minHome = h
    if (h > maxHome) maxHome = h
  }
  if (!seen) return null
  return { home: minHome, away: 100 - maxHome }
}

// The winner's minimum win probability — the numerator side of a comeback win.
// Thin wrapper over bothMinWinProbs so callers that only need the winner (and
// the unit tests) keep their shape.
export function winnerMinWinProb(winProb, winnerIsHome) {
  const m = bothMinWinProbs(winProb)
  if (!m) return null
  return winnerIsHome ? m.home : m.away
}

// Nested threshold buckets for one winner's minimum win %.
export function comebackBuckets(minWinProb) {
  if (minWinProb == null) return { sub10: 0, sub20: 0, sub30: 0 }
  return {
    sub10: minWinProb < 10 ? 1 : 0,
    sub20: minWinProb < 20 ? 1 : 0,
    sub30: minWinProb < 30 ? 1 : 0,
  }
}

// `byTeamId` is the regular season, exactly as before. The postseason is a new
// key beside it, `post.byTeamId`, same row shape, so a reader that knows only
// the old keys sees no change and a postseason row never lands on a regular one.
export function exportJson(db) {
  const rows = db
    .prepare('SELECT * FROM comeback_win_totals ORDER BY season, scope DESC, team_id')
    .all()
  const seasons = {}
  for (const r of rows) {
    const season = (seasons[r.season] ??= { byTeamId: {} })
    const bucket = r.scope === 'P' ? (season.post ??= { byTeamId: {} }) : season
    bucket.byTeamId[r.team_id] = {
      sub10: r.sub10,
      sub20: r.sub20,
      sub30: r.sub30,
      att10: r.att10,
      att20: r.att20,
      att30: r.att30,
      wins: r.wins,
    }
  }
  return { version: 2, generatedAt: new Date().toISOString(), seasons }
}

const CHECKPOINT_EVERY = 200

async function main() {
  const db = await openDb()
  // A schema change (the att* columns) means old rows have no attempts, so a
  // one-time --rebuild wipes both tables and re-sweeps from scratch. On a
  // normal run this is a no-op and the incremental append proceeds as before.
  if (args.rebuild) {
    db.exec('DELETE FROM comeback_win_totals; DELETE FROM comeback_ingested_games;')
    console.log('--rebuild: cleared comeback_win_totals + comeback_ingested_games')
  }
  const existing = new Set(
    db.prepare('SELECT game_pk FROM comeback_ingested_games').all().map((r) => String(r.game_pk)),
  )
  // The winner both ATTEMPTED (fell into the hole) and WON from it, so its att*
  // and sub* both take the winner's buckets; `wins` is +1 per ingested game.
  const upsertWinner = db.prepare(
    `INSERT INTO comeback_win_totals (team_id, season, scope, wins, sub10, sub20, sub30, att10, att20, att30)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_id, season, scope) DO UPDATE SET
       wins = wins + 1,
       sub10 = sub10 + excluded.sub10,
       sub20 = sub20 + excluded.sub20,
       sub30 = sub30 + excluded.sub30,
       att10 = att10 + excluded.att10,
       att20 = att20 + excluded.att20,
       att30 = att30 + excluded.att30`,
  )
  // The loser only ATTEMPTED (fell into the hole, then lost) — att* only, and a
  // row may be created here before the club has any ingested win (wins stays 0).
  const upsertLoser = db.prepare(
    `INSERT INTO comeback_win_totals (team_id, season, scope, wins, sub10, sub20, sub30, att10, att20, att30)
     VALUES (?, ?, ?, 0, 0, 0, 0, ?, ?, ?)
     ON CONFLICT(team_id, season, scope) DO UPDATE SET
       att10 = att10 + excluded.att10,
       att20 = att20 + excluded.att20,
       att30 = att30 + excluded.att30`,
  )
  const markIngested = db.prepare(
    'INSERT OR IGNORE INTO comeback_ingested_games (game_pk, season) VALUES (?, ?)',
  )

  const writeOut = async () => {
    await dumpGroup(db, 'comeback-wins')
    await writeJsonAtomic(out, exportJson(db))
  }

  const today = new Date()
  const dates = []
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(isoDay(d))
  }

  // Gather Final MLB games (regular season and postseason) with a decided winner, newest date
  // first, skipping anything already ingested.
  const candidates = []
  for (const dateStr of dates) {
    const slate = await getJson(`/api/v1/schedule?sportId=1&gameType=R,${POSTSEASON_GAME_TYPES}&date=${dateStr}`)
    for (const g of (slate.dates ?? []).flatMap((d) => d.games ?? [])) {
      if (g.status?.abstractGameState !== 'Final') continue
      if (g.status?.detailedState === 'Postponed') continue
      if (existing.has(String(g.gamePk))) continue
      const away = g.teams?.away
      const home = g.teams?.home
      const winnerIsHome = home?.isWinner === true
      const winnerIsAway = away?.isWinner === true
      if (!winnerIsHome && !winnerIsAway) continue // tie/suspended — no decided win
      const winnerId = winnerIsHome ? home?.team?.id : away?.team?.id
      const loserId = winnerIsHome ? away?.team?.id : home?.team?.id
      if (!winnerId || !loserId) continue
      candidates.push({
        gamePk: g.gamePk,
        season: Number(dateStr.slice(0, 4)),
        scope: scopeOfGameType(g.gameType),
        winnerId,
        loserId,
        winnerIsHome,
      })
    }
  }

  console.log(
    `${candidates.length} game(s) to ingest (${dates[dates.length - 1]}..${dates[0]})`,
  )

  let ingested = 0
  for (const c of candidates) {
    try {
      // Throws on a network/HTTP error → caught below → NOT marked ingested, so
      // a transient outage is retried next run rather than permanently missed.
      const wp = await getJson(`/api/v1/game/${c.gamePk}/winProbability?fields=${WP_FIELDS}`)
      const m = bothMinWinProbs(wp)
      // Guard a payload with no numeric win prob: still mark ingested (a Final
      // game's history won't improve on a re-run) but fold in nothing.
      const winnerB = comebackBuckets(m ? (c.winnerIsHome ? m.home : m.away) : null)
      const loserB = comebackBuckets(m ? (c.winnerIsHome ? m.away : m.home) : null)
      upsertWinner.run(
        c.winnerId, c.season, c.scope,
        winnerB.sub10, winnerB.sub20, winnerB.sub30,
        winnerB.sub10, winnerB.sub20, winnerB.sub30,
      )
      upsertLoser.run(c.loserId, c.season, c.scope, loserB.sub10, loserB.sub20, loserB.sub30)
      markIngested.run(c.gamePk, c.season)
      ingested++
      if (ingested % CHECKPOINT_EVERY === 0) {
        await writeOut()
        console.log(`checkpoint: ${ingested} ingested so far`)
      }
    } catch (err) {
      console.error(`gamePk ${c.gamePk}: ${err.message}`)
    }
  }

  const total = db.prepare('SELECT COUNT(*) AS n FROM comeback_ingested_games').get().n
  // Write even when nothing was ingested. The file carries generatedAt, and
  // check-data-freshness.mjs reads it as proof the generator RAN. Skipping the
  // write on a quiet night (the last days of the regular season, then every
  // night of the offseason) let that stamp age past the 20-hour budget and
  // failed the whole nightly run on 2026-09-29. The nightly job commits every
  // night anyway, so the stamp costs no extra commit.
  await writeOut()
  console.log(`wrote ${out} (${ingested} ingested this run, ${total} total games)`)
  db.close()
}

// Only sweep when run as a script — keeps the pure helpers importable for tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
