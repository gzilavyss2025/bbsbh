// Regenerates public/data/lineup-values.json — per-player runs-per-game value and
// positional eligibility for every MLB club's active-roster hitters, the nightly
// input to the Lineup Strength grade (metric engine L2; see
// .scratch/metric-engines/lineup-strength.md and src/api/lineupStrength.js).
//
// Full rebuild, MLB only (sportId 1). For each of the 30 clubs it reads the
// ACTIVE roster, keeps the non-pitchers (a two-way player's position type isn't
// 'Pitcher', so he rides along as a hitter automatically), and per player pulls:
//   - wRC+ and season Fielding runs from the LOCAL public/data/war.json (never
//     refetch FanGraphs — that's gen-war.mjs's job; this reads its committed
//     output, `.wrc` and `.fld`)
//   - season PA via /people/{id}/stats?stats=season&group=hitting
//   - season + year-by-year fielding innings by position (one combined call) →
//     the `positions` set he can currently cover (the "Andrew Vaughn at 3B"
//     guard: a handful of innings at a spot is not an option there, and the
//     "Ryan Braun at 3B" guard: innings from six years ago are not either).
//
// THE VALUE MODEL (all constants below, echoed into the file's `constants` block
// for the receipt's transparency). Each hitter gets two independent numbers:
//
//   rpg    — his BAT. wRC+ (park- and league-adjusted offense, 100 = average)
//            regressed toward 100 by PA, then expressed as runs/game above
//            average for one lineup slot.
//   fldRpg — his GLOVE. FanGraphs season Fielding runs, regressed toward 0 by
//            defensive innings, then per defensive game.
//
// The consumer adds them together at a fielding slot and uses the bat ALONE at
// DH, because a designated hitter's fielding contribution is definitionally
// zero (src/lib/lineupSolver.js `slotValue`). That is also what makes parking a
// poor defender at DH correctly cost nothing, and what keeps a glove-first
// regular — a 75 wRC+ third baseman with +6.4 fielding runs — in the lineup.
//
// WHY NOT WAR (the original model, and why it broke). WAR bundles bat, glove and
// a positional adjustment into one number, so the grade had to reconstruct the
// pieces: it subtracted a FULL-SEASON positional constant to recover a "bat".
// Two things make that unrecoverable. FanGraphs' `Positional` is prorated by a
// player's ACTUAL playing time (a catcher 60% of the way through a season has
// earned ~+4.7 runs, not the full +12.5), and the Marcel PA shrink had already
// scaled the embedded adjustment before the constant was removed at full
// strength. Both errors point the same way: a phantom penalty at premium
// positions and a phantom BONUS at DH. It ranked a 132 wRC+ catcher last among
// a club's bats and a 97 wRC+ DH first — the exact inversion that surfaced this.
// Read the components; never re-derive one from the total.
//
// The positional adjustment is now absent from the model entirely. Every lineup
// fills the same nine slots, so its sum is a constant that cancels; with fielding
// carried explicitly there is nothing left for it to proxy. Same for the old
// familiarity discount. Both removals are argued in full, with the evidence that
// forced them, in docs/lineup-strength.md — READ THAT BEFORE CHANGING THIS FILE.
//
// Verified against a live 2026 Brewers roster before the nightly cron was wired.
// Run by hand: node scripts/gen-lineup-values.mjs

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// The canonical slot order, so `positions` arrays read in a stable order.
import { SLOTS } from '../src/lib/lineupSolver.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'lineup-values.json')
const warPath = join(here, '..', 'public', 'data', 'war.json')
const season = new Date().getFullYear()

// --- value-model tunables (documented in the module header) -----------------
const GAMES = 162 // full season length, for per-game proration
// Bat. wRC+ is a rate relative to a 100 league average, so it regresses toward
// 100 (a thin sample means "probably average", NOT "probably replacement" — the
// old model's shrink toward 0 is what let a 27-PA callup read as a weakness).
const REGRESSION_PA = 250 // shrink: (wRC+ - 100) *= PA / (PA + this)
const LEAGUE_R_PER_PA = 0.118 // league runs scored per plate appearance
const PA_PER_SLOT = 4.2 // plate appearances one lineup slot gets per game
// Glove. Fielding runs are far noisier per unit of sample than offense and
// stabilize slowly, so they shrink on a much longer scale, toward 0 (average).
const REGRESSION_INN = 600 // shrink: fielding runs *= innings / (innings + this)
const DEF_INN_PER_GAME = 9 // fielding innings in one full defensive game

// --- eligibility tunables ----------------------------------------------------
// Eligibility is a BOOLEAN — can this player cover this position tonight — and
// it gates PROPOSALS only; a posted lineup is never gated (see lineupSolver.js).
// There is no familiarity weight any more; docs/lineup-strength.md explains why.
//
// The window is the load-bearing part. Career innings alone made a player
// eligible somewhere forever: Bryce Harper still "qualified" in right field on
// 7,785 career innings and zero in three years, and a third of every eligibility
// in the file was stale like that. Recent regular work is the only evidence that
// a manager would actually put him there tonight.
const FIELD_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
const ELIG_WINDOW = 3 // seasons counted as "recent", including the current one
const ELIG_SEASON_INN = 20 // eligible on this season's work alone ...
const ELIG_RECENT_INN = 100 // ... or on sustained work across the window

const CONCURRENCY = 6

const constants = {
  games: GAMES,
  regressionPa: REGRESSION_PA,
  leagueRPerPa: LEAGUE_R_PER_PA,
  paPerSlot: PA_PER_SLOT,
  regressionInn: REGRESSION_INN,
  defInnPerGame: DEF_INN_PER_GAME,
  eligWindow: ELIG_WINDOW,
  eligSeasonInn: ELIG_SEASON_INN,
  eligRecentInn: ELIG_RECENT_INN,
}

const API = 'https://statsapi.mlb.com/api/v1'

async function getJson(url, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Origin: 'https://bbsbh.vercel.app' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === tries) throw err
      await new Promise((r) => setTimeout(r, 300 * attempt))
    }
  }
}

// Run an async mapper over items with a fixed concurrency ceiling (politeness).
async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

const round3 = (n) => Math.round(n * 1000) / 1000

// Innings come as strings in baseball's thirds notation ("286.0", "1050.2").
// parseFloat is close enough for the coarse eligibility thresholds here.
const inns = (s) => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

// BAT: wRC+ regressed toward the 100 league average by PA, then runs/game above
// average for one lineup slot. No wRC+ (or no PA) → 0, i.e. exactly average, the
// honest read on a player we have no offensive line for.
function computeRpg(wrcPlus, pa) {
  if (!Number.isFinite(wrcPlus) || !Number.isFinite(pa) || pa <= 0) return 0
  const regressed = 100 + (wrcPlus - 100) * (pa / (pa + REGRESSION_PA))
  return ((regressed - 100) / 100) * LEAGUE_R_PER_PA * PA_PER_SLOT
}

// GLOVE: season fielding runs (above average, all positions pooled) regressed
// toward 0 by defensive innings, then per defensive game. Returns 0 when we have
// no fielding line or he has not taken the field — average, never a penalty.
// Pooling across positions is a known approximation, and a load-bearing one:
// FanGraphs reports one season Fielding figure per player, not one per position,
// so this reads as "his glove, wherever he plays". Because it is position-
// agnostic, the model deliberately makes NO claim about which fielding position
// a player should occupy — see docs/lineup-strength.md.
function computeFldRpg(fldRuns, innings) {
  if (!Number.isFinite(fldRuns) || !Number.isFinite(innings) || innings <= 0) return 0
  const regressed = fldRuns * (innings / (innings + REGRESSION_INN))
  return regressed / (innings / DEF_INN_PER_GAME)
}

// The set of positions a player can cover tonight, as a plain array of slot
// names. Boolean, not weighted — a position is in or out.
function buildPositions(seasonByPos, recentByPos) {
  const base = new Set()
  for (const pos of FIELD_POS) {
    const season = seasonByPos[pos] ?? 0
    const recent = recentByPos[pos] ?? 0
    if (season >= ELIG_SEASON_INN || recent >= ELIG_RECENT_INN) base.add(pos)
  }
  // Defensive-spectrum implications: covering a harder spot implies you can
  // cover an easier one beside it. Derived from BASE only, never chained, so a
  // corner-outfield implication can't bootstrap an infield one.
  const out = new Set(base)
  if (base.has('CF')) { out.add('LF'); out.add('RF') }
  if (base.has('LF')) out.add('RF')
  if (base.has('RF')) out.add('LF')
  if (base.has('SS')) { out.add('2B'); out.add('3B') }
  out.add('DH') // every hitter can DH
  return SLOTS.filter((s) => out.has(s))
}

// Innings by position from the season block: this season only.
function splitsByPos(statsBlocks, typeName) {
  const block = (statsBlocks ?? []).find((s) => s.type?.displayName === typeName)
  const map = {}
  for (const sp of block?.splits ?? []) {
    const pos = sp.position?.abbreviation
    if (pos) map[pos] = inns(sp.stat?.innings)
  }
  return map
}

// Innings by position summed over the recency window, from the yearByYear block
// (one split per season per position). This replaces the old career total: see
// the ELIG_* comment above for why a career figure can't gate eligibility.
function recentSplitsByPos(statsBlocks, currentSeason, window) {
  const block = (statsBlocks ?? []).find((s) => s.type?.displayName === 'yearByYear')
  const map = {}
  for (const sp of block?.splits ?? []) {
    const pos = sp.position?.abbreviation
    if (!pos) continue
    if (Number(sp.season) <= currentSeason - window) continue
    map[pos] = (map[pos] ?? 0) + inns(sp.stat?.innings)
  }
  return map
}

async function processPlayer(entry, fg) {
  const id = entry.person.id
  const name = entry.person.fullName
  const primaryPos = entry.position?.abbreviation
  const teamId = entry.__teamId
  try {
    const [hitting, fielding] = await Promise.all([
      getJson(`${API}/people/${id}/stats?stats=season&group=hitting&season=${season}`),
      // yearByYear rather than career: same one call, but it carries the SEASON
      // each block of innings belongs to, which is what the recency gate needs.
      getJson(`${API}/people/${id}/stats?stats=season,yearByYear&group=fielding&season=${season}`),
    ])
    const pa = hitting?.stats?.[0]?.splits?.[0]?.stat?.plateAppearances ?? 0
    const wrcPlus = fg.wrc[id]
    const hasWrc = wrcPlus != null
    const rpg = computeRpg(hasWrc ? wrcPlus : NaN, pa)
    const seasonByPos = splitsByPos(fielding?.stats, 'season')
    const recentByPos = recentSplitsByPos(fielding?.stats, season, ELIG_WINDOW)
    const positions = buildPositions(seasonByPos, recentByPos)
    // FanGraphs reports one season Fielding figure per player, so the innings it
    // spans are this season's fielding innings POOLED over every position he
    // manned — sum them to match the numerator's scope.
    const seasonInn = Object.values(seasonByPos).reduce((a, b) => a + b, 0)
    const fldRpg = computeFldRpg(fg.fld[id], seasonInn)
    const player = {
      name,
      teamId,
      primaryPos,
      rpg: round3(rpg),
      fldRpg: round3(fldRpg),
      pa,
      positions,
    }
    // Flags a player carrying no FanGraphs offensive line at all (so he is
    // sitting at exactly league average by default rather than by measurement).
    if (!hasWrc) player.noBat = true
    return [String(id), player]
  } catch (err) {
    console.warn(`  skip ${name} (${id}): ${err.message}`)
    return null
  }
}

async function main() {
  const warRaw = JSON.parse(await readFile(warPath, 'utf8'))
  // The bat/glove split, not the WAR total — see the module header.
  const fg = { wrc: warRaw.wrc ?? {}, fld: warRaw.fld ?? {} }
  console.log(
    `war.json: season ${warRaw.season}, ${Object.keys(fg.wrc).length} wRC+, ${Object.keys(fg.fld).length} Fld`,
  )
  if (Object.keys(fg.wrc).length === 0) {
    throw new Error('war.json carries no `wrc` map — regenerate it with gen-war.mjs first')
  }

  const teamsJson = await getJson(`${API}/teams?sportId=1&season=${season}`)
  const teams = (teamsJson.teams ?? []).filter((t) => t.sport?.id === 1 || t.id)
  console.log(`teams: ${teams.length}`)

  // Gather every hitter across all clubs first, then process with one shared pool.
  const hitters = []
  for (const team of teams) {
    let roster
    try {
      roster = await getJson(`${API}/teams/${team.id}/roster/Active`)
    } catch (err) {
      console.warn(`roster ${team.id} failed: ${err.message}`)
      continue
    }
    for (const entry of roster.roster ?? []) {
      if (entry.position?.type === 'Pitcher') continue // two-way players are not 'Pitcher'
      hitters.push({ ...entry, __teamId: team.id })
    }
  }
  console.log(`hitters: ${hitters.length}`)

  const results = await pool(hitters, CONCURRENCY, (h) => processPlayer(h, fg))
  const players = {}
  for (const r of results) {
    if (r) players[r[0]] = r[1]
  }

  const payload = {
    season,
    asOf: new Date().toISOString(),
    players,
    constants,
  }
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(payload))
  const bytes = Buffer.byteLength(JSON.stringify(payload))
  console.log(`wrote ${out} (${Object.keys(players).length} players, ${(bytes / 1024).toFixed(1)}KB)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
