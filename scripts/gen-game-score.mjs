// Regenerates public/data/game-score.json — a spoiler-safe, deliberately fuzzy
// 0.0-10.0 "how exciting was this game" rating shown UNSEALED right next to
// FINAL on the slate card (GameCard), for a reader deciding which of tonight's
// finished games is worth their scoring time. It is NOT the pitching Game
// Score stat — this one rates the whole game. See docs/game-score.md for the
// factor table + calibration anchors, and ADR-0015 for why this single number
// is allowed to render outside a SealBox despite being derived from
// score-revealing data: every factor is capped/blended before summing, so no
// individual factor (margin especially) is recoverable from the shown value.
//
// Each entry is { score, sportId, homeId, awayId } — the level + both team ids
// ride along from the SAME live feed already fetched to compute the score (no
// extra call), so the Top Games page can filter its pool by level/team without
// fetching metadata for every scored game in the season. None of these three
// are score-revealing.
//
// APPEND-ONLY / incremental, same shape as gen-umpire-accuracy.mjs: each run
// sweeps a small trailing window of dates across MLB + the four full-season
// MiLB levels, fetches the live feed for every newly-Final gamePk not already
// in the output file, scores it, and MERGES it in (deduped by gamePk). A
// Final game's score never changes, so an already-scored game is never
// refetched. The source of truth is now the shared SQLite layer
// (scripts/lib/db.js, docs/adr/0021) — this script writes to the game_scores
// table and exports this JSON from it, byte-for-byte the same reader shape.
// Runs on a tight cron (.github/workflows/update-game-score.yml,
// every 10 minutes) — deliberately NOT the once-nightly batch — so a score is
// usually available within minutes of a game going Final. MLB + MiLB (no
// winProbability dependency, which is MLB-only — see game.js — so this works
// anywhere the live feed carries play-by-play). Regular-season games only
// (gameType 'R') — spring training/exhibition results aren't "the season".
//
// Run by hand:
//   node scripts/gen-game-score.mjs           # trailing 3 days
//   node scripts/gen-game-score.mjs --days=7
//
// One-time season backfill (e.g. folding in a new season, or the gap before
// this generator existed): delete the game_scores rows from
// scripts/data/bbsbh.sql first (or --rescore, if the whole table should be
// rebuilt) so every entry gets rebuilt in the current schema, then run with
// `--days` covering from the earliest sportId's regularSeasonStartDate (see
// /api/v1/seasons?sportId={id}&season={year}) through today.
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { selectRegulationInnings } from '../src/api/select.js'
import { openDb, dumpGroup } from './lib/db.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'game-score.json')
const BASE = 'https://statsapi.mlb.com'
const SWEPT_SPORT_IDS = [1, 11, 12, 13, 14] // MLB + AAA/AA/A+/A — same set gen-callouts.mjs sweeps
const DEFAULT_DAYS = 3

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a)
    if (m) args[m[1]] = m[2] ?? true // bare --flag -> true, --key=value -> value
  }
  return args
}

const isoDay = (d) => d.toISOString().slice(0, 10)
const args = parseArgs(process.argv.slice(2))
const days = Number(args.days) || DEFAULT_DAYS

// --- the formula -------------------------------------------------------------
// Additive composite: base 2.0 (every completed game earns something) + drama
// + action + spectacle + dominance − dud, clamped to [0, 10] and rounded to one
// decimal AFTER summing, so no single factor is individually recoverable from
// the shown number. Every factor is capped, and DOMINANCE (a co-equal axis) is
// built from several sub-factors each kept modest, so many distinct game shapes
// collide onto the same displayed value — a "10" can be a walk-off, a slugfest,
// a perfect game, or a 3-HR night. That collision is what keeps this safe to
// render unsealed (see ADR-0015). Needs only the live feed's linescore +
// play-by-play + boxscore + gameData bios — never winProbability (MLB-only), so
// it works at every MiLB level too.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const ipOuts = (ip) => {
  if (ip == null) return 0
  const [full, part = 0] = String(ip).split('.')
  return Number(full) * 3 + Number(part)
}

// One dominant PITCHING line: suppression-led floor + strikeout spice + a small
// depth/cleanliness bonus. A gem SUPPRESSES scoring, so it correlates with a low
// margin — which is why pitching dominance is allowed to cancel the dud penalty
// (a 6-0 no-hitter must not be scored as a blowout).
function pitchLineDom(o, h, bb, k) {
  const supp = clamp(o * 0.16 - h * 0.55, 0, 4.2) // suppression spine
  const kScore = clamp(k * 0.13, 0, 1.6) // strikeouts (balanced with suppression)
  const clean = bb === 0 && o >= 24 ? 0.5 : 0 // walkless, deep — perfect-game flavor
  const deep = o >= 24 ? 0.4 : 0 // went 8+
  return clamp(supp + kScore + clean + deep, 0, 7.5)
}

// One dominant BATTING line — HISTORIC lines only. Leans on context-INDEPENDENT
// signals (total bases, 4+ hits, multi-HR) so an ordinary line inflated by a
// blowout's RBI chances stays ~0; only a genuine monster (Swanson's 3H/2HR/6RBI)
// scores. RBI is de-weighted because it just accumulates with runners on.
function batLineDom(h, tb, rbi, hr) {
  const hitsC = clamp((h - 3) * 0.9, 0, 1.8) // 4h .9 / 5h 1.8
  const tbC = clamp((tb - 5) * 0.5, 0, 2.5) // extra-base explosion (the spine)
  const rbiC = clamp((rbi - 4) * 0.3, 0, 1.2) // de-weighted, context-dependent
  const hrC = hr >= 2 ? clamp((hr - 1) * 0.8, 0, 1.6) : 0 // multi-HR only
  return clamp(hitsC + tbC + rbiC + hrC, 0, 7.5)
}

// Typical player age per full-season MiLB level, for the young-for-level arc:
// a 19yo dominating AA (norm ~23.5) is more remarkable than a 23yo doing the
// same. MLB uses the mlbDebut/rookie + twilight-age arc instead (see below).
const LEVEL_BASELINE_AGE = { 11: 26.5, 12: 23.5, 13: 22, 14: 21 } // AAA/AA/A+/A

// Dominance is only credited ABOVE a floor, then GAIN-amplified — a routine
// quality start nets ~0 (it clears neither), so it stops lifting the typical
// game, while a genuine gem/monster survives and the gain restores the tail.
// ARC_BONUS is a floor-EXEMPT additive lift for the career-arc: a short but
// electric edge-of-career gem (a 5-inning MLB debut) would otherwise be washed
// out by a floor high enough to keep 10s rare — this keeps it above the field
// without moving the median, since prime players (arc === 1) get zero bonus.
// Tuned against the full 886-game population: median ~5.4, 10s ~2-3%.
const DOM_FLOOR = 2.0
const DOM_GAIN = 1.5
const ARC_BONUS = 0.6

export function computeGameScore(feed) {
  const linescore = feed?.liveData?.linescore
  const plays = feed?.liveData?.plays?.allPlays ?? []
  if (!linescore || plays.length === 0) return null

  const totals = linescore.teams ?? {}
  const awayFinal = totals.away?.runs
  const homeFinal = totals.home?.runs
  if (typeof awayFinal !== 'number' || typeof homeFinal !== 'number') return null
  if (awayFinal === homeFinal) return null // suspended/tied oddity — no decided result to score

  const winnerIsHome = homeFinal > awayFinal
  const winnerRuns = winnerIsHome ? homeFinal : awayFinal
  const loserRuns = winnerIsHome ? awayFinal : homeFinal
  const margin = winnerRuns - loserRuns
  const totalRuns = winnerRuns + loserRuns
  const errorsTotal = (totals.away?.errors ?? 0) + (totals.home?.errors ?? 0)

  const scheduledInnings = selectRegulationInnings(feed)
  const lateStart = Math.max(1, scheduledInnings - 2) // 9 -> 7th inning on, 7 -> 5th on

  // Walk every play in order, tracking the running score — each play's
  // result.awayScore/homeScore is the CUMULATIVE total right after it
  // (verified in src/api/playbyplay.js) — to find lead changes, ties, the
  // winner's largest deficit, late-and-close innings, and clutch homers in one
  // pass. Deliberately never touches winProbability (MLB-only).
  let prevSign = 0 // -1 away leads, 0 tied, 1 home leads
  let leadChanges = 0
  let ties = 0
  let minWinnerDiff = 0 // most negative seen = the winner's largest deficit
  let lateClose = false
  let clutchHomers = 0
  let grandSlam = false
  let homeRuns = 0
  const hitTypesByBatter = new Map() // cycle detection

  for (const play of plays) {
    const r = play.result ?? {}
    const a = play.about ?? {}
    if (typeof r.awayScore === 'number' && typeof r.homeScore === 'number') {
      const diff = r.homeScore - r.awayScore
      const sign = diff > 0 ? 1 : diff < 0 ? -1 : 0
      if (sign !== prevSign) {
        if (prevSign !== 0) {
          if (sign === 0) ties++
          else leadChanges++
        }
        prevSign = sign
      }

      const winnerDiff = winnerIsHome ? diff : -diff
      if (winnerDiff < minWinnerDiff) minWinnerDiff = winnerDiff

      if (a.inning >= lateStart && Math.abs(diff) <= 1) lateClose = true

      if (r.eventType === 'home_run') {
        homeRuns++
        if (r.rbi === 4) grandSlam = true
        if (a.inning >= lateStart) {
          // "Clutch" = ties the game or hands the lead to the team that hit it.
          const battingIsHome = a.halfInning === 'bottom'
          const battingLeadsOrTies = battingIsHome ? diff >= 0 : diff <= 0
          if (battingLeadsOrTies) clutchHomers++
        }
      }
    }

    const batterId = play.matchup?.batter?.id
    if (batterId && r.isBaseHit) {
      const set = hitTypesByBatter.get(batterId) ?? new Set()
      set.add(r.eventType)
      hitTypesByBatter.set(batterId, set)
    }
  }
  const cycle = [...hitTypesByBatter.values()].some(
    (s) => s.has('single') && s.has('double') && s.has('triple') && s.has('home_run'),
  )
  const largestComeback = Math.max(0, -minWinnerDiff)

  const innings = linescore.innings ?? []
  const extraInnings = Math.max(0, innings.length - scheduledInnings)

  // Walk-off: the last play landed in the bottom half and ended the game
  // before that half recorded its 3rd out — the standard "winning run
  // crossed and nobody needed the last out" signal.
  const lastPlay = plays[plays.length - 1]
  const walkoff =
    winnerIsHome &&
    lastPlay?.about?.halfInning === 'bottom' &&
    (lastPlay?.count?.outs ?? 3) < 3

  // ---- DOMINANCE: the best individual performance, either side of the ball --
  // A historic individual line makes a game worth scoring regardless of the
  // score's shape. Best PITCHING line (>=5 IP to be the story of the game) or
  // best BATTING line, whichever is more impressive; plus a combined-team
  // shutout bonus that only rewards a genuinely stingy staff (<=3 hits allowed).
  // All null-guarded: a thin MiLB box score just degrades dominance to 0.
  const box = feed?.liveData?.boxscore?.teams ?? {}
  let bestPitch = 0
  let bestPitchId = null
  let bestBat = 0
  let bestBatId = null
  for (const side of ['away', 'home']) {
    const t = box[side]
    if (!t) continue
    for (const pid of t.pitchers ?? []) {
      const s = t.players?.['ID' + pid]?.stats?.pitching ?? {}
      const o = ipOuts(s.inningsPitched)
      if (o < 15) continue
      const d = pitchLineDom(o, +s.hits || 0, +s.baseOnBalls || 0, +s.strikeOuts || 0)
      if (d > bestPitch) {
        bestPitch = d
        bestPitchId = pid
      }
    }
    for (const pid of t.batters ?? []) {
      const s = t.players?.['ID' + pid]?.stats?.batting ?? {}
      const d = batLineDom(+s.hits || 0, +s.totalBases || 0, +s.rbi || 0, +s.homeRuns || 0)
      if (d > bestBat) {
        bestBat = d
        bestBatId = pid
      }
    }
  }
  // Combined-team dominance: only impressive at <=3 hits in a shutout.
  const combinedDom = (hitsAllowed, oppRuns) =>
    oppRuns === 0 && hitsAllowed <= 3 ? [3.0, 2.4, 1.8, 1.2][hitsAllowed] : 0
  const teamDom = Math.max(
    combinedDom(totals.home?.hits ?? 99, homeFinal),
    combinedDom(totals.away?.hits ?? 99, awayFinal),
  )
  const pitchDom = Math.max(bestPitch, teamDom)
  const battingWins = bestBat >= pitchDom

  // Career-arc modifier for the dominance owner — dominant at EITHER END of a
  // career weighs more (reverse bell). MLB: MLB-debut ×1.5, tapering across the
  // first ~1.5 seasons, flat 1.0 in the prime, rising again with age (×1.0 at
  // 35 → ×1.5 at 40+). MiLB: no meaningful MLB debut, so young-FOR-LEVEL instead
  // (5+ years under the level norm → ×1.5). Amplifies the dominance bucket only.
  const gameDate = feed?.gameData?.datetime?.officialDate
  const sportId = feed?.gameData?.teams?.home?.sport?.id ?? feed?.gameData?.teams?.away?.sport?.id
  const owner = feed?.gameData?.players?.['ID' + (battingWins ? bestBatId : bestPitchId)]
  let arc = 1.0
  if (owner && (battingWins ? bestBat : pitchDom) > 0) {
    const ageAtGame =
      owner.birthDate && gameDate
        ? (Date.parse(gameDate) - Date.parse(owner.birthDate)) / (365.25 * 864e5)
        : (owner.currentAge ?? 28)
    if (sportId === 1) {
      const daysSinceDebut =
        owner.mlbDebutDate && gameDate
          ? (Date.parse(gameDate) - Date.parse(owner.mlbDebutDate)) / 864e5
          : 9999
      const rookieFrac = clamp(1 - daysSinceDebut / 540, 0, 1) // first ~1.5 yrs
      const wYoung = owner.mlbDebutDate === gameDate ? 1.5 : 1 + 0.45 * rookieFrac
      const wOld = 1 + 0.5 * clamp((ageAtGame - 35) / 5, 0, 1)
      arc = clamp(Math.max(wYoung, wOld), 1, 1.5)
    } else {
      const baseline = LEVEL_BASELINE_AGE[sportId] ?? 20
      arc = clamp(1 + 0.5 * clamp((baseline - ageAtGame) / 5, 0, 1), 1, 1.5)
    }
  }
  const rawDom = Math.max(pitchDom, bestBat)
  const arcBonus = ARC_BONUS * (arc - 1) * Math.min(rawDom, 4) // floor-exempt edge-of-career lift
  const dominance = Math.min(7.5, Math.max(0, rawDom - DOM_FLOOR) * DOM_GAIN * arc + arcBonus)

  // ---- composite --------------------------------------------------------
  const leadFlux = Math.min(1.5, 0.4 * leadChanges + 0.2 * ties)
  const comeback = Math.min(1.2, 0.4 * largestComeback)
  const lateCloseScore = lateClose ? 0.8 : 0
  const extras = Math.min(1.0, extraInnings * 0.5)
  const walkoffScore = walkoff ? 0.8 : 0
  // Low-score tension: a taut, low-scoring game is gripping to score even
  // without lead changes — a 1-0 pitchers' duel, a 3-2 stolen late.
  const tension =
    margin <= 2 && totalRuns <= 6 ? (margin === 1 ? 0.9 : 0.5) + (totalRuns <= 3 ? 0.4 : 0) : 0
  const drama = Math.min(
    5.0,
    leadFlux + comeback + lateCloseScore + extras + walkoffScore + tension,
  )

  const runsScore = Math.min(1.2, totalRuns * 0.1)
  const balance = 0.6 * (Math.min(loserRuns, 4) / 4)
  const scoringHalfInnings = innings.filter(
    (i) => (i.away?.runs ?? 0) + (i.home?.runs ?? 0) > 0,
  ).length
  const spread = 0.7 * (Math.min(scoringHalfInnings, 7) / 7)
  const action = runsScore + balance + spread

  // Spectacle keeps the OFFENSIVE feats (clutch HRs, cycle/GS, HR count); the
  // no-hit bid moved into the dominance axis.
  const bigHRs = 0.5 * Math.min(2, clutchHomers)
  const feats = cycle ? 0.6 : grandSlam ? 0.4 : 0
  const hrScore = Math.min(0.4, homeRuns * 0.1)
  const spectacle = Math.min(1.5, bigHRs + feats + hrScore)

  // Dominance (either kind) cancels the blowout penalty — a gem or a monster
  // individual game must not be dismissed as a laugher.
  const dudRaw = Math.min(2.0, Math.max(0, margin - 3) * 0.35) + (errorsTotal >= 4 ? 0.3 : 0)
  const dud = Math.max(0, dudRaw - 0.5 * dominance)

  const raw = 2.0 + drama + action + spectacle + dominance - dud
  return Math.round(clamp(raw, 0, 10) * 10) / 10
}

// --- sweep + merge -----------------------------------------------------------
// Exports the game_scores table to the exact reader shape src/api/gameScore.js
// expects: { generatedAt, scores: { <gamePk>: { score, sportId, homeId, awayId } } }.
function exportJson(db) {
  const rows = db.prepare('SELECT * FROM game_scores ORDER BY game_pk').all()
  const scores = {}
  for (const row of rows) {
    scores[row.game_pk] = {
      score: row.score,
      sportId: row.sport_id,
      homeId: row.home_id,
      awayId: row.away_id,
    }
  }
  return { generatedAt: new Date().toISOString(), scores }
}

// Checkpointed every CHECKPOINT_EVERY games, not just at the very end — a
// large one-time backfill (thousands of gamePks, each its own feed fetch) can
// run long enough to get interrupted, and this loop is otherwise all-or-
// nothing. A checkpoint write (dump the DB + export the JSON) is safe
// mid-run: rows are only ever inserted/replaced, never deleted, so a resumed
// run's "already in game_scores" skip check picks up exactly where the last
// checkpoint left off.
const CHECKPOINT_EVERY = 200

const upsertScore = (db) =>
  db.prepare(
    `INSERT INTO game_scores (game_pk, score, sport_id, home_id, away_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_pk) DO UPDATE SET
       score = excluded.score, sport_id = excluded.sport_id,
       home_id = excluded.home_id, away_id = excluded.away_id,
       updated_at = excluded.updated_at`,
  )

// Normal run sweeps a trailing window of newly-Final games not yet scored.
// `--rescore` re-scores every gamePk already in the table too — the one-time
// backfill after a formula change (a Final game is otherwise never recomputed).
async function main() {
  const rescore = args.rescore != null
  const db = await openDb()
  const existingIds = new Set(
    db.prepare('SELECT game_pk FROM game_scores').all().map((r) => String(r.game_pk)),
  )
  const insert = upsertScore(db)

  const writeOut = async () => {
    await dumpGroup(db, 'game-scores')
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, JSON.stringify(exportJson(db)))
  }

  const today = new Date()
  const dates = []
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(isoDay(d))
  }

  const candidates = new Set(rescore ? existingIds : [])
  for (const dateStr of dates) {
    const slate = await getJson(
      `/api/v1/schedule?sportId=${SWEPT_SPORT_IDS.join(',')}&date=${dateStr}`,
    )
    const games = (slate.dates ?? []).flatMap((d) => d.games ?? [])
    for (const g of games) {
      if (g.status?.abstractGameState !== 'Final') continue
      if (g.status?.detailedState === 'Postponed') continue
      if (g.gameType !== 'R') continue
      if (!rescore && existingIds.has(String(g.gamePk))) continue
      candidates.add(String(g.gamePk))
    }
  }

  console.log(
    `${candidates.size} game(s) to score${rescore ? ' (--rescore: full backfill)' : ` (${dates[dates.length - 1]}..${dates[0]})`}`,
  )

  let scored = 0
  let skipped = 0
  for (const gamePk of candidates) {
    try {
      const feed = await getJson(`/api/v1.1/game/${gamePk}/feed/live`)
      const score = computeGameScore(feed)
      if (score == null) {
        skipped++
        continue
      }
      const teams = feed?.gameData?.teams
      insert.run(
        Number(gamePk),
        score,
        teams?.home?.sport?.id ?? null,
        teams?.home?.id ?? null,
        teams?.away?.id ?? null,
        new Date().toISOString(),
      )
      scored++
      if (scored % CHECKPOINT_EVERY === 0) {
        await writeOut()
        console.log(`checkpoint: ${scored} scored so far`)
      }
    } catch (err) {
      console.error(`gamePk ${gamePk}: ${err.message}`)
    }
  }

  const total = db.prepare('SELECT COUNT(*) AS n FROM game_scores').get().n
  if (scored > 0) {
    await writeOut()
    console.log(`wrote ${out} (${scored} scored, ${skipped} skipped, ${total} total)`)
  } else {
    console.log(`no changes (${skipped} skipped, ${total} total)`)
  }
  db.close()
}

// Only sweep when run as a script — keeps computeGameScore importable for tests
// without triggering a live fetch + file write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
