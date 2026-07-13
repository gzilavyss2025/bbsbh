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
// APPEND-ONLY / incremental, same shape as gen-umpire-accuracy.mjs: each run
// sweeps a small trailing window of dates across MLB + the four full-season
// MiLB levels, fetches the live feed for every newly-Final gamePk not already
// in the output file, scores it, and MERGES it in (deduped by gamePk). A
// Final game's score never changes, so an already-scored game is never
// refetched. Runs on a tight cron (.github/workflows/update-game-score.yml,
// every 10 minutes) — deliberately NOT the once-nightly batch — so a score is
// usually available within minutes of a game going Final. MLB + MiLB (no
// winProbability dependency, which is MLB-only — see game.js — so this works
// anywhere the live feed carries play-by-play).
//
// Run by hand:
//   node scripts/gen-game-score.mjs           # trailing 3 days
//   node scripts/gen-game-score.mjs --days=7
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectRegulationInnings } from '../src/api/select.js'

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
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (m) args[m[1]] = m[2]
  }
  return args
}

const isoDay = (d) => d.toISOString().slice(0, 10)
const args = parseArgs(process.argv.slice(2))
const days = Number(args.days) || DEFAULT_DAYS

// --- the formula -------------------------------------------------------------
// Additive composite: base 2.0 (every completed game earns something) + drama
// + action + spectacle − dud, clamped to [0, 10] and rounded to one decimal
// AFTER summing, so no single factor is individually recoverable from the
// shown number. Needs only the live feed's linescore + play-by-play — never
// runs/hits/errors' exact values are exposed to the caller, only this one
// blended score.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

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

  // No-hit bid through the late-start inning: the eventual loser's cumulative
  // hits sat at 0 through at least that many innings, even if broken up later.
  const loserSide = winnerIsHome ? 'away' : 'home'
  let loserHitsThruLate = 0
  for (const inn of innings) {
    if (inn.num > lateStart) break
    loserHitsThruLate += inn?.[loserSide]?.hits ?? 0
  }
  const noHitBid = loserHitsThruLate === 0

  // ---- composite --------------------------------------------------------
  const leadFlux = Math.min(1.5, 0.4 * leadChanges + 0.2 * ties)
  const comeback = Math.min(1.2, 0.4 * largestComeback)
  const lateCloseScore = lateClose ? 0.8 : 0
  const extras = Math.min(1.0, extraInnings * 0.5)
  const walkoffScore = walkoff ? 0.8 : 0
  const drama = Math.min(5.0, leadFlux + comeback + lateCloseScore + extras + walkoffScore)

  const runsScore = Math.min(1.2, totalRuns * 0.1)
  const balance = 0.6 * (Math.min(loserRuns, 4) / 4)
  const scoringHalfInnings = innings.filter(
    (i) => (i.away?.runs ?? 0) + (i.home?.runs ?? 0) > 0,
  ).length
  const spread = 0.7 * (Math.min(scoringHalfInnings, 7) / 7)
  const action = runsScore + balance + spread

  const bigHRs = 0.5 * Math.min(2, clutchHomers)
  const rare = noHitBid ? 1.0 : cycle ? 0.6 : grandSlam ? 0.4 : 0
  const hrScore = Math.min(0.4, homeRuns * 0.1)
  const spectacle = Math.min(1.5, bigHRs + rare + hrScore)

  const dud = Math.min(2.0, Math.max(0, margin - 3) * 0.35) + (errorsTotal >= 4 ? 0.3 : 0)

  const raw = 2.0 + drama + action + spectacle - dud
  return Math.round(clamp(raw, 0, 10) * 10) / 10
}

// --- sweep + merge -----------------------------------------------------------
async function loadExisting() {
  try {
    const raw = await readFile(out, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { generatedAt: null, scores: {} }
  }
}

const existing = await loadExisting()
const scores = { ...existing.scores }

const today = new Date()
const dates = []
for (let i = 0; i < days; i++) {
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() - i)
  dates.push(isoDay(d))
}

let candidates = []
for (const dateStr of dates) {
  const slate = await getJson(
    `/api/v1/schedule?sportId=${SWEPT_SPORT_IDS.join(',')}&date=${dateStr}`,
  )
  const games = (slate.dates ?? []).flatMap((d) => d.games ?? [])
  for (const g of games) {
    if (g.status?.abstractGameState !== 'Final') continue
    if (g.status?.detailedState === 'Postponed') continue
    if (scores[g.gamePk] != null) continue
    candidates.push(g.gamePk)
  }
}
candidates = [...new Set(candidates)]

console.log(`${candidates.length} newly-Final game(s) to score (${dates[dates.length - 1]}..${dates[0]})`)

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
    scores[gamePk] = score
    scored++
  } catch (err) {
    console.error(`gamePk ${gamePk}: ${err.message}`)
  }
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), scores }))
console.log(`wrote ${out} (${scored} newly scored, ${skipped} skipped, ${Object.keys(scores).length} total)`)
