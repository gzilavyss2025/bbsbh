// Builds, for every team-season 2000-2025, how much PRIOR postseason
// experience its roster carried INTO that season — spike #4 in
// docs/team-success-research.md's factor catalog.
//
// THE MEASURE IS DELIBERATELY A PRE-OCTOBER PROPERTY. A player's experience
// is counted only from postseasons STRICTLY BEFORE the season being scored,
// so nothing a team does in the current October can leak into its own
// predictor. Experience is career-wide, not club-wide: a veteran who played
// in the 2015 World Series for another club still counts as experienced when
// he signs somewhere new for 2016.
//
// SOURCE, in two halves:
//   1. GET /api/v1/schedule?sportId=1&season=YYYY&gameType=F,D,L,W for the
//      game list of EVERY postseason 1969-2025, then
//      GET /api/v1/game/{gamePk}/boxscore per distinct game for who played.
//      `gameType` codes are F=Wild Card, D=Division, L=Championship,
//      W=World Series. NOT `P` — `gameType=P` returns zero games in every
//      year tested, including ones with a known bracket (verified live).
//   2. The 2000-2025 half is already on disk from spike #2's pull
//      (postseason-boxscore-cache.json, 939 games) and is reused by gamePk,
//      so this script only actually fetches the 1969-1999 backfill.
//
// WHY 1969. The window being scored starts in 2000, and a 2000 roster's
// oldest player debuted in the mid-1970s, so his own prior postseasons all
// sit inside a 1969 floor. 1969 is also when divisional play (and therefore
// a multi-round bracket) began, so it is a real structural boundary rather
// than an arbitrary cutoff. Boxscores this old are complete for the two
// fields read here — verified live against the 1975 World Series (Luis Tiant
// IP=9.0, Carl Yastrzemski PA=5).
//
// Regular-season playing-time weights come from spike #1's
// roster-age-cache.json (per-player PA for hitters, IP for pitchers, keyed
// `{group}-{teamId}-{year}`), which is a committed data source, not a rerun
// optimization — no new regular-season pull is needed.
//
// Run: node .scratch/team-success/build-postseason-experience.mjs
// Writes: .scratch/team-success/postseason-experience.json
// Caches the 1969-1999 backfill in: prior-postseason-cache.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKFILL_CACHE = join(__dirname, 'prior-postseason-cache.json')
const SPIKE2_CACHE = join(__dirname, 'postseason-boxscore-cache.json')
const ROSTER_CACHE = join(__dirname, 'roster-age-cache.json')
const OUT_PATH = join(__dirname, 'postseason-experience.json')

const HISTORY_FLOOR = 1969 // divisional play; see header
const SCORE_FROM = 2000 // outcome-ladder.json's own window
const SCORE_TO = 2025

// gameType -> how deep in the bracket that game sits. Used for the
// "been there in the late rounds" variant of the measure.
const ROUND_DEPTH = { F: 1, D: 2, L: 3, W: 4 }

const RELATIVE_FIELDS = ['expShare', 'deepShare', 'wsShare', 'expYears', 'expDepth']

function loadJson(p, fallback) {
  if (!existsSync(p)) return fallback
  return JSON.parse(readFileSync(p, 'utf8'))
}

async function fetchWithRetry(url, attempts = 5) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`statsapi ${res.status} ${url}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
  throw lastErr
}

function parseInnings(ip) {
  const [whole, frac] = String(ip ?? '0').split('.')
  const wholeNum = Number(whole) || 0
  const fracNum = frac === '1' ? 1 / 3 : frac === '2' ? 2 / 3 : 0
  return wholeNum + fracNum
}

function slimSide(side) {
  return Object.values(side.players ?? {}).map((p) => ({
    personId: p.person?.id ?? null,
    name: p.person?.fullName ?? null,
    pa: p.stats?.batting?.plateAppearances ?? 0,
    ip: parseInnings(p.stats?.pitching?.inningsPitched ?? '0'),
  }))
}

async function main() {
  const backfill = loadJson(BACKFILL_CACHE, { games: {} })
  if (!backfill.games) backfill.games = {}
  const spike2 = loadJson(SPIKE2_CACHE, {})
  const rosterCache = loadJson(ROSTER_CACHE, null)
  if (!rosterCache) throw new Error('roster-age-cache.json missing — run build-roster-age.mjs first')

  // ---- 1. The game list for every postseason 1969-2025 -------------------
  // The schedule pull is cheap (one call per season) and carries gameType,
  // which spike #2's boxscore cache does not.
  const gameList = []
  for (let year = HISTORY_FLOOR; year <= SCORE_TO; year++) {
    const key = `sched-${year}`
    let sched = backfill[key]
    if (!sched) {
      const json = await fetchWithRetry(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${year}&gameType=F,D,L,W`,
      )
      const seen = new Set()
      sched = []
      for (const date of json.dates ?? []) {
        for (const g of date.games ?? []) {
          // A suspended-and-resumed game can appear twice in the schedule;
          // dedupe by gamePk, the same trap gen-postseason-history.mjs notes.
          if (seen.has(g.gamePk)) continue
          seen.add(g.gamePk)
          const state = g.status?.codedGameState
          if (state === 'C' || state === 'D') continue // cancelled / postponed
          sched.push({ gamePk: g.gamePk, gameType: g.gameType })
        }
      }
      backfill[key] = sched
      writeFileSync(BACKFILL_CACHE, JSON.stringify(backfill))
    }
    for (const g of sched) gameList.push({ gamePk: g.gamePk, gameType: g.gameType, year })
  }
  console.log(`postseason game list: ${gameList.length} games, ${HISTORY_FLOOR}-${SCORE_TO}`)

  // ---- 2. Boxscores, reusing spike #2's cache for 2000-2025 --------------
  const needed = gameList.filter(
    (g) => !spike2[String(g.gamePk)] && !backfill.games[String(g.gamePk)],
  )
  console.log(
    `${needed.length} boxscores to fetch (${gameList.length - needed.length} already cached)`,
  )
  let fetched = 0
  for (const g of needed) {
    const json = await fetchWithRetry(`https://statsapi.mlb.com/api/v1/game/${g.gamePk}/boxscore`)
    backfill.games[String(g.gamePk)] = {
      home: { teamId: json.teams?.home?.team?.id ?? null, players: slimSide(json.teams?.home ?? {}) },
      away: { teamId: json.teams?.away?.team?.id ?? null, players: slimSide(json.teams?.away ?? {}) },
    }
    fetched += 1
    if (fetched % 50 === 0) {
      console.log(`  ${fetched}/${needed.length} backfill boxscores`)
      writeFileSync(BACKFILL_CACHE, JSON.stringify(backfill))
    }
  }
  writeFileSync(BACKFILL_CACHE, JSON.stringify(backfill))

  // ---- 3. Per-player career postseason ledger ----------------------------
  // ledger: personId -> year -> { pa, ip, depth }. `depth` is the deepest
  // round the player HIMSELF appeared in that year, not his team's furthest
  // round — a September call-up who sat out the LCS did not get that
  // experience.
  const ledger = new Map()
  let missingBox = 0
  for (const g of gameList) {
    const box = spike2[String(g.gamePk)] ?? backfill.games[String(g.gamePk)]
    if (!box) {
      missingBox += 1
      continue
    }
    const depth = ROUND_DEPTH[g.gameType] ?? 0
    for (const side of [box.home, box.away]) {
      for (const p of side?.players ?? []) {
        if (!p.personId) continue
        if (!(p.pa > 0) && !(p.ip > 0)) continue
        let byYear = ledger.get(p.personId)
        if (!byYear) {
          byYear = new Map()
          ledger.set(p.personId, byYear)
        }
        const cur = byYear.get(g.year) ?? { pa: 0, ip: 0, depth: 0 }
        cur.pa += p.pa || 0
        cur.ip += p.ip || 0
        cur.depth = Math.max(cur.depth, depth)
        byYear.set(g.year, cur)
      }
    }
  }
  console.log(`ledger: ${ledger.size} distinct players with postseason appearances`)
  if (missingBox) console.log(`WARNING: ${missingBox} games had no boxscore`)

  function priorFor(personId, year) {
    const byYear = ledger.get(personId)
    if (!byYear) return { pa: 0, ip: 0, years: 0, deep: false, ws: false }
    let pa = 0
    let ip = 0
    let years = 0
    let deep = false
    let ws = false
    for (const [y, v] of byYear) {
      if (y >= year) continue
      pa += v.pa
      ip += v.ip
      years += 1
      if (v.depth >= 3) deep = true
      if (v.depth >= 4) ws = true
    }
    return { pa, ip, years, deep, ws }
  }

  // ---- 4. Join to regular-season playing-time weights --------------------
  const byYearKeys = new Map() // year -> [cacheKey]
  for (const cacheKey of Object.keys(rosterCache)) {
    const m = cacheKey.match(/^(hitting|pitching)-(\d+)-(\d+)$/)
    if (!m) continue
    const year = Number(m[3])
    if (!byYearKeys.has(year)) byYearKeys.set(year, [])
    byYearKeys.get(year).push({ cacheKey, group: m[1], teamId: m[2] })
  }

  const seasons = []
  for (let year = SCORE_FROM; year <= SCORE_TO; year++) {
    const teams = {}
    for (const { cacheKey, group, teamId } of byYearKeys.get(year) ?? []) {
      const splits = rosterCache[cacheKey] ?? []
      let w = 0
      let wExp = 0
      let wDeep = 0
      let wWs = 0
      let wYears = 0
      let wDepthLog = 0
      let nPlayers = 0
      let nExp = 0
      for (const s of splits) {
        const weight = Number(s.weight)
        if (!Number.isFinite(weight) || weight <= 0) continue
        const prior = priorFor(s.personId, year)
        const units = group === 'hitting' ? prior.pa : prior.ip
        w += weight
        nPlayers += 1
        if (prior.years > 0) {
          wExp += weight
          nExp += 1
        }
        if (prior.deep) wDeep += weight
        if (prior.ws) wWs += weight
        wYears += weight * prior.years
        wDepthLog += weight * Math.log1p(units)
      }
      if (w <= 0) continue
      if (!teams[teamId]) teams[teamId] = {}
      teams[teamId][group] = {
        weight: w,
        nPlayers,
        nExperienced: nExp,
        expShare: wExp / w,
        deepShare: wDeep / w,
        wsShare: wWs / w,
        expYears: wYears / w,
        expDepth: wDepthLog / w,
      }
    }
    seasons.push({ year, teams })
  }

  // League-average-relative versions, per the framework's rule that every
  // factor needs one. This one matters more than most: the bracket has grown
  // twice inside the window, so the LEAGUE's stock of experienced players
  // rises over time for reasons that have nothing to do with any one club.
  for (const season of seasons) {
    for (const group of ['hitting', 'pitching']) {
      const totals = Object.fromEntries(RELATIVE_FIELDS.map((f) => [f, 0]))
      let wSum = 0
      for (const t of Object.values(season.teams)) {
        const g = t[group]
        if (!g) continue
        wSum += g.weight
        for (const f of RELATIVE_FIELDS) totals[f] += g[f] * g.weight
      }
      if (wSum <= 0) continue
      const leagueAvg = Object.fromEntries(RELATIVE_FIELDS.map((f) => [f, totals[f] / wSum]))
      season[`league_${group}`] = leagueAvg
      for (const t of Object.values(season.teams)) {
        const g = t[group]
        if (!g) continue
        for (const f of RELATIVE_FIELDS) g[`${f}Relative`] = g[f] - leagueAvg[f]
      }
    }
  }

  writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source:
          'schedule gameType=F,D,L,W 1969-2025 + /api/v1/game/{gamePk}/boxscore (the 2000-2025 half reused from postseason-boxscore-cache.json), weighted by regular-season PA/IP from roster-age-cache.json',
        method:
          'Per team-season, the share of regular-season playing time (PA for hitters, IP for pitchers) that went to players who had appeared in at least one postseason game in a STRICTLY EARLIER season, on any club. deepShare/wsShare restrict that to prior Championship-Series/World-Series appearances; expYears is the playing-time-weighted count of prior postseason seasons; expDepth is the weighted mean of log1p(prior postseason PA or IP). Every *Relative field subtracts that season own playing-time-weighted league average.',
        historyFloor: HISTORY_FLOOR,
        seasons,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${seasons.length} seasons to ${OUT_PATH}`)
}

main()
