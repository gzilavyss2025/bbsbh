// Regenerates public/data/umpire-accuracy-summary.json + umpire-accuracy/{id}.json
// (see the two outputs below) — for every home-plate umpire,
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
//
// ABS CHALLENGES + HANDEDNESS (see .scratch/umpire-tendencies/PRD.md §2, and
// issues/03 for the migration). Two more per-game figures off the same walk,
// both feeding the Umpire Tendencies card:
//   - `challenges`/`challengesOverturned` — how many Automated Ball-Strike
//     challenges this game drew and how many overturned the plate umpire's
//     call. Attributing them to him is the point: a challenge overturns HIS
//     call. Resolved by challengeForPlay (src/api/challenges.js) rather than
//     re-implemented, the same don't-let-them-drift import this file already
//     makes for euz.js/runExpectancy.js — that module knows a review can sit
//     at EITHER the play or the pitch-event level (sometimes mirrored at
//     both, which it dedupes) and that MLB's older manager's-replay reviews
//     also set `challengeTeamId` and must be excluded on `reviewType`.
//     A count-only re-implementation here got that wrong twice in review.
//   - `missL`/`missR` — the same four-region miss tallies as `high/low/
//     inside/outside`, split by the BATTER's side. missRegion already
//     orients horizontally to the batter, so this is the same attribution
//     read two ways, never a second definition of a region.
// Both are absent (not zero) on rows swept before this schema — a pre-schema
// row and a game with genuinely no challenges must stay distinguishable, so
// aggregate() counts contributing games rather than summing blindly.
import { readFile, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { fileURLToPath } from 'node:url'
import { challengeForPlay } from '../src/api/challenges.js'
import { leanInputFromRows } from '../src/api/umpires.js'
import { estimateGameConsistency } from '../src/lib/euz.js'
import { pitchFavor } from '../src/lib/runExpectancy.js'
import { getJson } from './lib/statsapi.mjs'
import { parseArgs, dateRange } from './lib/args.mjs'
import { mergeAccuracyRows } from './lib/umpire-accuracy-merge.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// TWO OUTPUTS, and between them they ARE the archive — split by who asks.
// Every umpire's season aggregates in one file (~0.12 MB: the ranking pool the
// lineup page, the box score, and the rankings table read), and one file per
// umpire holding just his scored game rows (~13 KB: his game log). Written from
// the same `result` in the same run, so they cannot disagree.
//
// There is no league-wide archive file any more. It was ~2 MB by August, it was
// the merge base AND a served file, and once the lean's ingredient moved into
// the aggregate (see leanInputFromRows) nothing read it. The row shards are the
// merge base now — one copy of the accumulated history, not two.
const outSummary = join(here, '..', 'public', 'data', 'umpire-accuracy-summary.json')
const outRows = join(here, '..', 'public', 'data', 'umpire-accuracy')
const reTablePath = join(here, '..', 'public', 'data', 'run-expectancy.json')
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

// --- date range from CLI ------------------------------------------------------
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
  // The same misses, split by the batter's side. missRegion already orients
  // horizontally to the batter, so these are one attribution read two ways —
  // regionL.inside + regionR.inside === region.inside, always.
  const regionL = { high: 0, low: 0, inside: 0, outside: 0 }
  const regionR = { high: 0, low: 0, inside: 0, outside: 0 }
  // ABS challenges drawn by this game's plate umpire, and how many overturned
  // him. Counted per PLAY (challengeForPlay resolves at most one per play).
  let challenges = 0
  let challengesOverturned = 0
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
      const missedIn = missRegion(c.pX, c.pZ, top, bot, batSide)
      region[missedIn]++
      ;(batSide === 'L' ? regionL : regionR)[missedIn]++
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

    // At most one ABS challenge per play, resolved by the app's own
    // challengeForPlay so this count and the box score's can't disagree (see
    // the header). It returns null for a play with no ABS review, for the
    // older manager's-replay reviews, and for a review whose challengeTeamId
    // matches neither club.
    const abs = challengeForPlay(feed, p)
    if (abs) {
      challenges++
      if (abs.outcome === 'success') challengesOverturned++
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
    missL: regionL,
    missR: regionR,
    challenges,
    challengesOverturned,
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
  // Same degrade for the two Umpire Tendencies schemas. `challengeGames` is
  // what keeps "swept before challenges were counted" distinct from "played a
  // game nobody challenged" — a zero would collapse the two and quietly drag
  // every challenges-per-game figure toward zero mid-migration.
  const regionL = { high: 0, low: 0, inside: 0, outside: 0 }
  const regionR = { high: 0, low: 0, inside: 0, outside: 0 }
  let handedGames = 0
  let challengeSum = 0
  let challengeOverturnedSum = 0
  let challengeGames = 0
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
    if (g.missL && g.missR) {
      for (const k of ['high', 'low', 'inside', 'outside']) {
        regionL[k] += g.missL[k] ?? 0
        regionR[k] += g.missR[k] ?? 0
      }
      handedGames++
    }
    if (g.challenges != null) {
      challengeSum += g.challenges
      challengeOverturnedSum += g.challengesOverturned ?? 0
      challengeGames++
    }
  }
  sum.accuracy = sum.called ? sum.correct / sum.called : null
  sum.cellCalled = cellCalled
  sum.cellStrikeCall = cellStrikeCall
  sum.cellMiss = cellMiss
  sum.consistency = consistentCalledSum ? consistentSum / consistentCalledSum : null
  sum.favorMagnitude = favorGames ? favorMagnitudeSum : null
  sum.favorPerGame = favorGames ? favorMagnitudeSum / favorGames : null
  // The SIGNED companion — the pitcher/hitter lean's ingredient, summed here so
  // the app can rank an umpire on it without downloading the league's game rows.
  // leanInputFromRows is imported from the reader (src/api/umpires.js) rather
  // than re-implemented, so build time and read time cannot drift; umpireLeanFor
  // beside it does the division. `level` is passed even though `games` is
  // already one level's rows — the filter is the guarantee, not the caller.
  Object.assign(sum, leanInputFromRows(games, games[0]?.level ?? 'MLB'))
  sum.missL = handedGames ? regionL : null
  sum.missR = handedGames ? regionR : null
  // `challengeGames` is carried, not just used: it is the denominator behind
  // challengesPerGame, and it is NOT sum.games until every row has been
  // re-swept. A reader that divides by sum.games instead understates the rate.
  sum.challenges = challengeGames ? challengeSum : null
  sum.challengesOverturned = challengeGames ? challengeOverturnedSum : null
  sum.challengeGames = challengeGames || null
  sum.challengesPerGame = challengeGames ? challengeSum / challengeGames : null
  sum.overturnRate = challengeSum ? challengeOverturnedSum / challengeSum : null
  return sum
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
const { startDate, endDate } = dateRange(args, DEFAULT_DAYS)
const season = Number(endDate.slice(0, 4))

// The MERGE BASE is the per-umpire row shards this job wrote last night — the
// same files the app reads. There is no separate league-wide archive to keep in
// step with them (there was; it was 2 MB, nothing read it, and a second copy of
// an append-only history is a second thing that can go stale).
//
// ENOENT → genuine first run; a corrupt committed shard must abort rather than
// silently rebuild the aggregate from only the last few days' finals and drop
// the season's accumulated history, which is what readJsonOr guarantees.
const prev = { umpires: {} }
for (const f of await readdir(outRows).catch(() => [])) {
  if (!f.endsWith('.json')) continue
  const shard = await readJsonOr(join(outRows, f), null)
  if (shard?.id != null) {
    // `name` rides on the shard for exactly this reason: an umpire who worked in
    // April and not in this run's window would otherwise come back nameless.
    prev.umpires[shard.id] = { id: shard.id, name: shard.name, games: shard.games ?? [] }
  }
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

// Merge every fresh row into the umpire it belongs to (mergeAccuracyRows'
// header explains the crew-reassignment case this guards against).
const priorGamePks = new Set(
  Object.values(prev.umpires ?? {}).flatMap((u) => (u.games ?? []).map((g) => g.gamePk)),
)
const umpires = mergeAccuracyRows(prev.umpires, rows)
const added = rows.filter((r) => r && !priorGamePks.has(r.gamePk)).length

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

const generatedAt = new Date().toISOString()
await writeJsonAtomic(outSummary, {
  generatedAt,
  season,
  umpires: Object.fromEntries(
    Object.entries(result).map(([id, { games, ...aggregates }]) => [id, aggregates]),
  ),
})
// …and the other half of that split, one file per umpire: his scored game rows
// alone. The umpire page and the lineup page's accuracy modal each draw ONE
// man's rows, and these files are also this job's merge base next run, so the
// accumulated history has exactly one copy.
for (const [id, u] of Object.entries(result)) {
  await writeJsonAtomic(join(outRows, `${id}.json`), { id: u.id, name: u.name, games: u.games })
}
// A row shard this run's merge purged (a game reassigned away, see
// mergeAccuracyRows) must not survive on disk — it's this job's own merge
// base next run, so a stale file left behind would reseed the ghost umpire
// right back into `prev.umpires` once the reassigned game ages out of the
// trailing --since window and can no longer trigger a fresh purge.
let swept = 0
for (const f of await readdir(outRows).catch(() => [])) {
  if (!f.endsWith('.json') || result[f.replace('.json', '')]) continue
  await rm(join(outRows, f))
  swept++
}
const gamesTotal = Object.values(result).reduce((n, u) => n + u.games.length, 0)
console.log(
  `wrote ${outSummary} + ${Object.keys(result).length} row shards — ${gamesTotal} games on file ` +
    `(+${added} new from ${startDate}..${endDate}, ${targets.length} finals swept)` +
    (swept ? `, swept ${swept} stale row shard(s)` : ''),
)
