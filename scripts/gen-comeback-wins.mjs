// Regenerates public/data/comeback-wins.json — per-team, per-season COMEBACK
// counts that form a comeback RATE. For every Final game, BOTH sides' minimum
// win probability is bucketed: whichever side fell below 10 / 20 / 30% at some
// point counts an ATTEMPT (att10/att20/att30) at that depth, and if that side
// went on to win it also counts a comeback WIN (sub10/sub20/sub30). So a team's
// (or the league's) rate of clawing back from a given hole is sub/att, and both
// pairs are NESTED (a sub-10 win also counts sub-20/sub-30; likewise att).
// Shown on the Team Page as the "Comeback wins" card (rate vs. league baseline)
// when non-zero — see src/api/comebackWins.js.
//
// Spoiler-safe: a season aggregate over FINAL games carries no live-game score
// (same footing as WAR / the team-score aggregates), so the Team-page card needs
// no SealBox. Only the in-game per-play win prob (src/api/winprob.js) is sealed.
//
// APPEND-ONLY / incremental, same shape as gen-game-score.mjs / gen-fouls.mjs:
// each run sweeps a small trailing window of dates, and for every newly-Final
// MLB regular-season game not already ingested, fetches its win-probability
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
//                                     # required after the schema gains a column
//                                     # (att*), since old rows carry no attempts.
import { dirname, join } from 'node:path'
import { writeJsonAtomic } from './lib/io.js'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openDb, dumpGroup } from './lib/db.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'comeback-wins.json')
const BASE = 'https://statsapi.mlb.com'
const DEFAULT_DAYS = 3
// The cumulative home win % (+ its `about` for nothing here, but kept minimal).
// Only homeTeamWinProbability is read; pruning keeps each game's payload small.
const WP_FIELDS = 'homeTeamWinProbability'

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a)
    if (m) args[m[1]] = m[2] ?? true
  }
  return args
}

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

function exportJson(db) {
  const rows = db.prepare('SELECT * FROM comeback_win_totals ORDER BY season, team_id').all()
  const seasons = {}
  for (const r of rows) {
    ;(seasons[r.season] ??= { byTeamId: {} }).byTeamId[r.team_id] = {
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
    `INSERT INTO comeback_win_totals (team_id, season, wins, sub10, sub20, sub30, att10, att20, att30)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_id, season) DO UPDATE SET
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
    `INSERT INTO comeback_win_totals (team_id, season, wins, sub10, sub20, sub30, att10, att20, att30)
     VALUES (?, ?, 0, 0, 0, 0, ?, ?, ?)
     ON CONFLICT(team_id, season) DO UPDATE SET
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

  // Gather Final regular-season MLB games with a decided winner, newest date
  // first, skipping anything already ingested.
  const candidates = []
  for (const dateStr of dates) {
    const slate = await getJson(`/api/v1/schedule?sportId=1&gameType=R&date=${dateStr}`)
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
        c.winnerId, c.season,
        winnerB.sub10, winnerB.sub20, winnerB.sub30,
        winnerB.sub10, winnerB.sub20, winnerB.sub30,
      )
      upsertLoser.run(c.loserId, c.season, loserB.sub10, loserB.sub20, loserB.sub30)
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
  if (ingested > 0) {
    await writeOut()
    console.log(`wrote ${out} (${ingested} ingested this run, ${total} total games)`)
  } else {
    console.log(`no changes (${total} total games)`)
  }
  db.close()
}

// Only sweep when run as a script — keeps the pure helpers importable for tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
