// Regenerates public/data/umpire-accuracy.json — for every home-plate umpire,
// his season called-pitch accuracy (plus a compact zone-tendency breakdown),
// aggregated from each game's per-pitch tracking data. Keyed by MLB Stats API
// personId, the same id space as umpires.json / players.
//
// WHY A SEPARATE SCRIPT (not folded into gen-umpires.mjs). gen-umpires.mjs does
// one cheap season-schedule call and rebuilds umpires.json from scratch every
// night. Accuracy can't be built that way: it needs the full LIVE FEED of each
// game (per-pitch pX/pZ vs. the batter's strike zone), so it's a feed fetch PER
// GAME. A Final game's accuracy is immutable, so we never want to re-crunch the
// season — this job is APPEND-ONLY/incremental, mirroring gen-game-notes.mjs:
// each run sweeps only a small trailing window of finals, computes each game's
// row, and MERGES it in (deduped by gamePk), then recomputes the per-umpire
// season aggregate from the merged rows. That's the umpires.json (full-rebuild)
// vs. game-notes.json (append-only) split, applied to the same umpire surface.
//
// METHODOLOGY (see .scratch/umpire-accuracy/plan.md §1 for the full write-up).
// Only CALLED judgments count: details.code 'C' (called strike) and 'B'/'*B'
// (ball). Swings, fouls, balls in play, and HBP are not umpire ball/strike
// decisions and are excluded, as is any pitch missing coordinates or a strike
// zone (parks without Hawk-Eye — the game just contributes nothing). A pitch is
// a strike if any part of the ball could clip the rule-book zone: the plate
// half-width plus one baseball radius on every edge (the "Umpire Scorecards"
// buffer convention). The strike zone is per-batter (pitchData.strikeZoneTop/
// Bottom), never a league constant. A call is correct when the umpire's call
// matches that geometry.
//
// MLB (sportId 1) + AAA (sportId 11), like gen-umpires.mjs. Every AAA park
// feeds full Hawk-Eye pitch coordinates (the ABS/challenge-system rig — verified
// 100% coverage league-wide), so the exact same geometry scores an AAA game.
// The same umpires shuttle between the levels, so a call-up ump's page shows
// both. AA and below carry NO pitch coordinates (verified 0% across every AA
// park), so computeGameAccuracy() returns null for them and they contribute
// nothing even if one slips into the sweep — keep them out. Because the two
// levels run different regimes (AAA uses the ABS challenge system) and rank
// against different peer pools, the per-umpire aggregate is split BY LEVEL
// (`season` = MLB for back-compat, `seasonAAA` = AAA) rather than blended, and
// every game row carries a `level` tag. Runs on a cron
// (.github/workflows/update-nightly-data.yml); also by hand:
//   node scripts/gen-umpire-accuracy.mjs                 # trailing 3 days
//   node scripts/gen-umpire-accuracy.mjs --days=7
//   node scripts/gen-umpire-accuracy.mjs --since=2026-03-01 [--until=2026-07-10]
//   node scripts/gen-umpire-accuracy.mjs --since=2026-03-01 --sports=11
// The --since form is the one-time season backfill; nightly runs use the
// default trailing window. --sports restricts the sweep to a comma-separated
// list of sportIds (default: all levels below) — its one real use is adding a
// NEW level to a file that already has the others: since a Final game's
// accuracy is immutable, re-fetching the existing level's feeds is pure waste,
// so `--since=… --sports=11` backfills AAA alone and leaves the MLB rows (which
// default to level MLB) untouched.
//
// CONSISTENCY + FAVOR (see .scratch/umpire-accuracy/consistency-favor-scope.md).
// Two more per-game figures, computed alongside accuracy from the same feed
// walk, both degrading to null on any missing input rather than skewing a
// game's other numbers:
//   - `consistent`/`consistentCalled` — how many of the game's called pitches
//     agree with the umpire's OWN fitted zone that game (src/lib/euz.js's
//     kernel-density Estimated Umpire Zone), not the rulebook zone. Null
//     below euz.js's MIN_CONSISTENCY_SAMPLE (too few called pitches to fit a
//     zone at all).
//   - `favorAway`/`favorHome` (signed runs, this game only) and
//     `favorMagnitude` (sum of |favor| — the season aggregate's version,
//     since "away/home" isn't a stable identity across games) — the
//     run-expectancy swing (src/lib/runExpectancy.js's pitchFavor, reading
//     the historical RE288 table gen-run-expectancy.mjs builds) each missed
//     call handed the batting team. Needs the pre-pitch (base, outs, count)
//     state, which the existing per-play loop below didn't track — this file
//     now also walks runner movement across plays (same walk verified in
//     gen-run-expectancy.mjs) to reconstruct it. Null/0 when
//     public/data/run-expectancy.json hasn't been built yet (hand-run, not
//     nightly) — favor is a bonus figure on top of accuracy, never blocking.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { estimateGameConsistency } from '../src/lib/euz.js'
import { pitchFavor } from '../src/lib/runExpectancy.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'umpire-accuracy.json')
const reTablePath = join(here, '..', 'public', 'data', 'run-expectancy.json')
const BASE = 'https://statsapi.mlb.com'

// Loaded once at startup; null (favor degrades to 0/null everywhere) until
// scripts/gen-run-expectancy.mjs has been hand-run at least once.
let reTable = null
try {
  reTable = JSON.parse(await readFile(reTablePath, 'utf8'))
} catch {
  console.log('run-expectancy.json not found — favor will be 0/null this run')
}

const BASE_NUM = { '1B': 1, '2B': 2, '3B': 3 }

// Zone geometry, in feet. HALF_PLATE = half of the 17" plate; BALL_R = a
// baseball's radius (~2.9" diameter). A pitch is a strike if it's within the
// plate + one ball radius horizontally and within the batter's zone + one ball
// radius vertically — the standard Umpire Scorecards buffer.
const HALF_PLATE = 8.5 / 12 // 0.7083 ft
const BALL_R = 1.45 / 12 // 0.121 ft

const DEFAULT_DAYS = 3

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// --- date range from CLI ------------------------------------------------------
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
  if (args.since) {
    return { startDate: args.since, endDate: args.until || isoDay(today) }
  }
  const days = Number(args.days) || DEFAULT_DAYS
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: isoDay(start), endDate: isoDay(today) }
}

// --- per-game accuracy --------------------------------------------------------
// Attribute one missed call to a single zone edge: the boundary it's most on
// the wrong side of (expanded misses) or nearest to (squeezed misses) — i.e.
// the buffered edge with the smallest signed clearance. Horizontal is oriented
// to the batter (bx > 0 = inside) so "inside"/"outside" read from his box, not
// the catcher's. One region per miss keeps the tallies from double-counting a
// corner pitch.
function missRegion(pX, pZ, top, bot, batSide) {
  const bx = batSide === 'L' ? -pX : pX
  const clearances = {
    high: top + BALL_R - pZ, // <0 ⇒ above the zone
    low: pZ - (bot - BALL_R), // <0 ⇒ below the zone
    inside: HALF_PLATE + BALL_R - bx, // <0 ⇒ too far inside
    outside: bx + (HALF_PLATE + BALL_R), // <0 ⇒ too far outside
  }
  let region = 'high'
  let min = Infinity
  for (const [k, v] of Object.entries(clearances)) {
    if (v < min) {
      min = v
      region = k
    }
  }
  return region
}

// Place a called pitch in a 3×3 zone grid (row-major, index = row*3 + col) for
// the umpire-page zone map. Rows split the batter's own zone by normalized
// height zn = (pZ - bot) / (top - bot): top third (zn > 2/3, anything above the
// zone folds in), middle, bottom third (zn < 1/3, anything below folds in).
// Columns split the rule-book plate into thirds oriented to the batter (bx > 0
// = inside), off-plate pitches folding into the inside/outside columns: col 0 =
// outside, col 1 = middle, col 2 = inside. Every called judgment lands in
// exactly one cell, so the three per-cell tallies (called / called-strike /
// missed) feed both the perceived-zone shading and the over-average-miss
// overlay without storing any raw coordinates.
function cellIndex(pX, pZ, top, bot, batSide) {
  const bx = batSide === 'L' ? -pX : pX
  const third = HALF_PLATE / 3
  const zn = top > bot ? (pZ - bot) / (top - bot) : 0.5
  const row = zn > 2 / 3 ? 0 : zn < 1 / 3 ? 2 : 1
  const col = bx > third ? 2 : bx < -third ? 0 : 1
  return row * 3 + col
}

function computeGameAccuracy(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  let called = 0
  let correct = 0
  let expanded = 0 // called strike, out of zone → generous
  let squeezed = 0 // called ball, in zone → tight
  const region = { high: 0, low: 0, inside: 0, outside: 0 }
  // 3×3 zone-map tallies (see cellIndex): all called judgments, how many were
  // called strikes (perceived zone), and how many were wrong (miss overlay).
  const cellCalled = Array(9).fill(0)
  const cellStrikeCall = Array(9).fill(0)
  const cellMiss = Array(9).fill(0)
  const consistencyPitches = [] // { pX, pZ, strikeCall } — every called judgment, for euz.js
  let favorAway = 0
  let favorHome = 0
  let favorMagnitude = 0

  // Base/outs walk for favor's pre-pitch state (§ header comment above) — same
  // walk verified in gen-run-expectancy.mjs against a real 5–14 game (runs-per-
  // half matched linescore exactly). Reset at each new half-inning.
  let bases = [null, null, null]
  let outs = 0
  let curHalfKey = null

  for (const p of plays) {
    const halfKey = `${p.about?.inning}-${p.about?.halfInning}`
    if (halfKey !== curHalfKey) {
      bases = [null, null, null]
      outs = 0
      curHalfKey = halfKey
    }
    const preBaseMask = (bases[0] ? 1 : 0) | (bases[1] ? 2 : 0) | (bases[2] ? 4 : 0)
    const preOuts = Math.min(outs, 2) // a 3rd-out state is never a pre-pitch state
    // 'top' bats away, 'bottom' bats home — same convention as the rest of the app.
    const battingAway = p.about?.halfInning === 'top'

    const batSide = p.matchup?.batSide?.code ?? 'R'
    let prevCount = { balls: 0, strikes: 0 } // resets per play — see the header's documented edge case
    for (const ev of p.playEvents ?? []) {
      if (!ev.isPitch) continue
      const preCount = prevCount
      prevCount = { balls: ev.count?.balls ?? preCount.balls, strikes: ev.count?.strikes ?? preCount.strikes }

      const code = ev.details?.code
      const strikeCall = code === 'C'
      const ballCall = code === 'B' || code === '*B'
      if (!strikeCall && !ballCall) continue

      const c = ev.pitchData?.coordinates
      const top = ev.pitchData?.strikeZoneTop
      const bot = ev.pitchData?.strikeZoneBottom
      if (!c || c.pX == null || c.pZ == null || top == null || bot == null) continue

      const inX = Math.abs(c.pX) <= HALF_PLATE + BALL_R
      const inZ = c.pZ <= top + BALL_R && c.pZ >= bot - BALL_R
      const actualStrike = inX && inZ

      const cell = cellIndex(c.pX, c.pZ, top, bot, batSide)
      called++
      cellCalled[cell]++
      if (strikeCall) cellStrikeCall[cell]++
      consistencyPitches.push({ pX: c.pX, pZ: c.pZ, strikeCall })
      if (actualStrike === strikeCall) {
        correct++
        continue
      }
      if (strikeCall) expanded++
      else squeezed++
      region[missRegion(c.pX, c.pZ, top, bot, batSide)]++
      cellMiss[cell]++

      // A pre-pitch count outside 0–3 balls / 0–2 strikes is corrupted feed
      // data (a 4th ball ends the plate appearance) — rare, see
      // gen-run-expectancy.mjs's header — skip favor for that one pitch
      // rather than feed pitchFavor a state that shouldn't exist.
      if (reTable && preCount.balls <= 3 && preCount.strikes <= 2) {
        const favor = pitchFavor(reTable, preBaseMask, preOuts, preCount.balls, preCount.strikes, actualStrike)
        if (battingAway) favorAway += favor
        else favorHome += favor
        favorMagnitude += Math.abs(favor)
      }
    }

    // Apply this play's runner movements for the NEXT play's base/out state —
    // identical logic to gen-run-expectancy.mjs's accumulateGame.
    for (const r of p.runners ?? []) {
      const rid = r.details?.runner?.id
      const startBase = BASE_NUM[r.movement?.start]
      const endBase = BASE_NUM[r.movement?.end]
      const isOut = r.movement?.isOut
      if (startBase) bases[startBase - 1] = null
      if (isOut) outs = Math.min(outs + 1, 3)
      else if (endBase) bases[endBase - 1] = rid
    }
  }

  if (called === 0) return null
  const consistency = estimateGameConsistency(consistencyPitches)
  return {
    called,
    correct,
    expanded,
    squeezed,
    ...region,
    cellCalled,
    cellStrikeCall,
    cellMiss,
    consistent: consistency?.consistent ?? null,
    consistentCalled: consistency?.called ?? null,
    favorAway: reTable ? favorAway : null,
    favorHome: reTable ? favorHome : null,
    favorMagnitude: reTable ? favorMagnitude : null,
  }
}

// --- season aggregate from a umpire's game rows -------------------------------
function aggregate(games) {
  const sum = { games: games.length, called: 0, correct: 0, expanded: 0, squeezed: 0, high: 0, low: 0, inside: 0, outside: 0 }
  const cellCalled = Array(9).fill(0)
  const cellStrikeCall = Array(9).fill(0)
  const cellMiss = Array(9).fill(0)
  // Consistency/favor sum over only the games that carry them — an older row
  // (swept before these schemas shipped) or a thin-sample game (consistent
  // null, favorMagnitude null) simply contributes nothing, same degrade as
  // the cell-grid arrays above.
  let consistentSum = 0
  let consistentCalledSum = 0
  let favorMagnitudeSum = 0
  let favorGames = 0
  for (const g of games) {
    sum.called += g.called
    sum.correct += g.correct
    sum.expanded += g.expanded
    sum.squeezed += g.squeezed
    sum.high += g.high
    sum.low += g.low
    sum.inside += g.inside
    sum.outside += g.outside
    // Cell arrays only exist on rows swept after the zone-map schema shipped; an
    // older row simply contributes nothing to the grid (its totals still count).
    for (let i = 0; i < 9; i++) {
      cellCalled[i] += g.cellCalled?.[i] ?? 0
      cellStrikeCall[i] += g.cellStrikeCall?.[i] ?? 0
      cellMiss[i] += g.cellMiss?.[i] ?? 0
    }
    if (g.consistent != null && g.consistentCalled != null) {
      consistentSum += g.consistent
      consistentCalledSum += g.consistentCalled
    }
    if (g.favorMagnitude != null) {
      favorMagnitudeSum += g.favorMagnitude
      favorGames++
    }
  }
  sum.accuracy = sum.called ? sum.correct / sum.called : null
  sum.cellCalled = cellCalled
  sum.cellStrikeCall = cellStrikeCall
  sum.cellMiss = cellMiss
  sum.consistency = consistentCalledSum ? consistentSum / consistentCalledSum : null
  sum.favorMagnitude = favorGames ? favorMagnitudeSum : null
  sum.favorPerGame = favorGames ? favorMagnitudeSum / favorGames : null
  return sum
}

// Merge one game row into a umpire's list, deduped by gamePk (a Final game is
// immutable, so a re-run overwrites with identical numbers), newest first.
function upsertGame(games, row) {
  const byPk = new Map(games.map((g) => [g.gamePk, g]))
  byPk.set(row.gamePk, row)
  return [...byPk.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await fn(items[i])
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// --- main ---------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2))
const { startDate, endDate } = dateRange(args)
const season = Number(endDate.slice(0, 4))

let prev = { umpires: {} }
try {
  prev = JSON.parse(await readFile(out, 'utf8'))
} catch {
  // first run — no file yet
}

// The levels swept, most-senior first. AAA rides along because its parks carry
// the pitch tracking the score needs (see header); AA/below don't, so they stay
// out. Each target is tagged with its level so the aggregate can split by it.
const ALL_LEVELS = [
  { sportId: 1, level: 'MLB' },
  { sportId: 11, level: 'AAA' },
]
// --sports=1,11 restricts the sweep (default: every level); see the header.
const sportsFilter = args.sports
  ? new Set(String(args.sports).split(',').map((s) => Number(s.trim())))
  : null
const LEVELS = sportsFilter ? ALL_LEVELS.filter((l) => sportsFilter.has(l.sportId)) : ALL_LEVELS

// Collect the (gamePk, plate ump, level) triples to fetch. Same postponed-replay
// dedup guard as gen-umpires.mjs: a replayed game is listed under both its
// original date and its officialDate; keep only the bucket that matches
// officialDate.
const targets = []
for (const { sportId, level } of LEVELS) {
  // Regular season (R) + postseason (F/D/L/W) + All-Star Game (A). Regular-season
  // rows feed the ranked `season`/`seasonAAA` aggregates; postseason rows go to a
  // separate unranked `seasonPost`; the ASG shows per-game only. Each target
  // carries its gameType so the split can happen at aggregate time.
  const schedule = await getJson(
    `/api/v1/schedule?sportId=${sportId}&startDate=${startDate}&endDate=${endDate}&gameType=R,F,D,L,W,A&hydrate=officials,team`,
  )
  for (const d of schedule.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status?.abstractGameState !== 'Final') continue
      if (d.date !== g.officialDate) continue
      const hp = (g.officials ?? []).find((o) => o.officialType === 'Home Plate')
      if (!hp?.official?.id) continue
      targets.push({
        gamePk: g.gamePk,
        date: g.officialDate ?? (g.gameDate ?? '').slice(0, 10),
        level,
        gameType: g.gameType ?? 'R',
        umpId: hp.official.id,
        umpName: hp.official.fullName,
      })
    }
  }
}

const rows = await mapWithConcurrency(targets, 6, async (t) => {
  const feed = await getJson(`/api/v1.1/game/${t.gamePk}/feed/live`)
  const acc = computeGameAccuracy(feed)
  if (!acc) return null // park without pitch tracking — nothing to score
  return { ...t, acc }
})

// Merge every fresh row into the umpire it belongs to.
const umpires = {}
for (const [id, u] of Object.entries(prev.umpires ?? {})) {
  umpires[id] = { id: u.id ?? Number(id), name: u.name, games: [...(u.games ?? [])] }
}
let added = 0
for (const r of rows) {
  if (!r) continue
  const key = String(r.umpId)
  if (!umpires[key]) umpires[key] = { id: r.umpId, name: r.umpName, games: [] }
  else umpires[key].name = r.umpName // keep the freshest spelling
  const before = umpires[key].games.length
  umpires[key].games = upsertGame(umpires[key].games, {
    gamePk: r.gamePk,
    date: r.date,
    level: r.level,
    gameType: r.gameType,
    ...r.acc,
  })
  if (umpires[key].games.length > before) added++
}

// Recompute each umpire's aggregates from his (merged) rows, split two ways.
//   • By LEVEL (MLB vs AAA) — the two run different regimes and rank against
//     different pools, so they never blend. A row predating the `level` tag is
//     treated as MLB (the file was MLB-only before AAA was added).
//   • By game CONTEXT — only REGULAR-SEASON (gameType R) rows feed the ranked
//     `season`/`seasonAAA` aggregates. Postseason (F/D/L/W) rolls up into a
//     separate, unranked `seasonPost`; the All-Star Game (A) is a low-stakes
//     exhibition and counts toward no aggregate at all (it still appears in
//     `games` for its per-game figure). A row predating the `gameType` tag is
//     treated as regular season. See docs/adr for the exclude-from-rank rationale.
const gameLevel = (g) => g.level ?? 'MLB'
const gameCtx = (g) => g.gameType ?? 'R'
const POSTSEASON = new Set(['F', 'D', 'L', 'W'])
const result = {}
for (const [id, u] of Object.entries(umpires)) {
  const mlbReg = u.games.filter((g) => gameLevel(g) === 'MLB' && gameCtx(g) === 'R')
  const aaaReg = u.games.filter((g) => gameLevel(g) === 'AAA' && gameCtx(g) === 'R')
  const postGames = u.games.filter((g) => POSTSEASON.has(gameCtx(g)))
  result[id] = {
    id: u.id,
    name: u.name,
    season: aggregate(mlbReg),
    seasonAAA: aaaReg.length ? aggregate(aaaReg) : null,
    seasonPost: postGames.length ? aggregate(postGames) : null,
    games: u.games,
  }
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), season, umpires: result }))
const gamesTotal = Object.values(result).reduce((n, u) => n + u.games.length, 0)
console.log(
  `wrote ${out} — ${Object.keys(result).length} umpires, ${gamesTotal} games on file ` +
    `(+${added} new from ${startDate}..${endDate}, ${targets.length} finals swept)`,
)
