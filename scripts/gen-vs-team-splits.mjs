// Regenerates public/data/vs-team-splits.json — for every player on an MLB
// active roster, his CAREER regular-season stats against each opposing club plus
// the stat line of the LAST game he played against them. Feeds the player page's
// SPLITS VS TEAM card (src/api/vsTeamSplits.js just reads this file).
//
// This runs on a cron via .github/workflows/update-vs-team-splits.yml, NOT at
// request time. Building it is expensive: the API's vs-team split types return
// season/pitcher aggregates with no game granularity, so the only way to get
// BOTH the career-vs-club totals AND the most-recent meeting's line is to sweep
// a player's full MLB game log season by season and fold each game into a
// per-opponent bucket. That's one request per MLB season the player has ever
// played — dozens per veteran, ~hundreds of players — far too heavy for a page
// load. Past-season game logs are immutable, so a nightly job that writes a
// small static file keeps the live page to a single same-origin read. Mirrors
// scripts/gen-former-teammates.mjs's build-time-fetch pattern (see
// docs/data-enrichment.md §5).
//
// Scoped deliberately to MLB only (the card never shows for MiLB players): the
// 30 MLB active rosters, career stats vs the other 29 MLB clubs. A player's own
// club is never an opponent, and clubs he's never faced are simply omitted (the
// card shows "no career meetings" for those).
//
// Run by hand: node scripts/gen-vs-team-splits.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'vs-team-splits.json')
const BASE = 'https://statsapi.mlb.com'

// How far ahead to look for each club's next game (to pre-select the opponent).
const NEXT_GAME_WINDOW_DAYS = 14

const isoDay = (offset = 0) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// Run an async mapper across items with a small concurrency cap, results in
// order (be polite to statsapi). Mirrors gen-former-teammates.mjs's helper.
async function mapConcurrent(items, limit, mapper) {
  const out = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        out[i] = await mapper(items[i], i)
      } catch {
        out[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)

// Innings pitched ("104.1" = 104 ⅓) <-> outs, so multi-game IP sums correctly.
const ipToOuts = (ip) => {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}
const outsToIp = (outs) => `${Math.floor(outs / 3)}.${outs % 3}`

// --- stat-line formatting (self-contained copy of src/api/person.js's shape) --
const tag = (n, label) => {
  const v = num(n)
  if (!v) return null
  return v === 1 ? label : `${v} ${label}`
}
// A hitter's one-game line, TV-lower-third style: "2-4, HR, 2 RBI, K".
function hitterLine(st) {
  const parts = [`${num(st.hits)}-${num(st.atBats)}`]
  for (const t of [
    tag(st.doubles, '2B'),
    tag(st.triples, '3B'),
    tag(st.homeRuns, 'HR'),
    tag(st.rbi, 'RBI'),
    tag(st.baseOnBalls, 'BB'),
    tag(st.stolenBases, 'SB'),
    tag(st.strikeOuts, 'K'),
  ]) {
    if (t) parts.push(t)
  }
  return parts.join(', ')
}
// A pitcher's one-game line: "3.1 IP, 2 H, 1 R, 1 ER, 0 BB, 4 K" — the box-score
// order, counting stats always shown (zeros included). No "GS" prefix here (the
// card's meta row already carries the date/opponent context).
function pitcherLine(st) {
  return [
    `${st.inningsPitched ?? '0.0'} IP`,
    `${num(st.hits)} H`,
    `${num(st.runs)} R`,
    `${num(st.earnedRuns)} ER`,
    `${num(st.baseOnBalls)} BB`,
    `${num(st.strikeOuts)} K`,
  ].join(', ')
}

// --- rate stats from summed components ---------------------------------------
const avgOf = (h, ab) => (ab > 0 ? (h / ab).toFixed(3).replace(/^0/, '') : '.000')
function opsOf(b) {
  const obDen = b.ab + b.bb + b.hbp + b.sf
  const obp = obDen > 0 ? (b.h + b.bb + b.hbp) / obDen : 0
  const slg = b.ab > 0 ? b.tb / b.ab : 0
  return (obp + slg).toFixed(3).replace(/^0/, '')
}
const eraOf = (er, outs) => (outs > 0 ? ((er * 27) / outs).toFixed(2) : '0.00')

// --- MLB team catalog + next opponent ----------------------------------------
async function fetchMlbTeams() {
  const data = await getJson('/api/v1/teams?sportId=1&activeStatus=Y')
  return (data.teams ?? [])
    .filter((t) => t.active && t.id)
    .map((t) => ({
      id: t.id,
      abbr: t.abbreviation ?? t.teamCode?.toUpperCase() ?? '',
      name: t.name ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Each club's next scheduled game's opponent (soonest game with date >= today),
// so the card can pre-select it. Regular season isn't forced — any game counts.
async function fetchNextOpponents(teamIds) {
  const nextByTeam = {} // teamId -> { date, oppId }
  let data
  try {
    data = await getJson(
      `/api/v1/schedule?sportId=1&startDate=${isoDay(0)}&endDate=${isoDay(NEXT_GAME_WINDOW_DAYS)}&hydrate=team`,
    )
  } catch {
    return {}
  }
  for (const date of data.dates ?? []) {
    for (const g of date.games ?? []) {
      const a = g.teams?.away?.team?.id
      const h = g.teams?.home?.team?.id
      const day = g.officialDate ?? (g.gameDate ?? '').slice(0, 10)
      if (!a || !h || !day) continue
      for (const [self, opp] of [[a, h], [h, a]]) {
        if (!nextByTeam[self] || day < nextByTeam[self].date) {
          nextByTeam[self] = { date: day, oppId: opp }
        }
      }
    }
  }
  const out = {}
  for (const id of teamIds) if (nextByTeam[id]) out[id] = nextByTeam[id].oppId
  return out
}

// --- rosters ------------------------------------------------------------------
// A club's active roster, each entry reduced to { id, group }. `group` is the
// stat group the card shows for that player — pitching for a pitcher, hitting
// for everyone else (a two-way player gets his hitting splits, matching the
// player page's primary-group choice).
async function fetchActiveRoster(teamId) {
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=active`)
    return (data.roster ?? [])
      .filter((r) => r.person?.id)
      .map((r) => ({
        id: r.person.id,
        name: r.person.fullName ?? '',
        group: r.position?.type === 'Pitcher' ? 'pitching' : 'hitting',
      }))
  } catch {
    return []
  }
}

// --- per-player career vs each club ------------------------------------------
// The MLB seasons a player appeared in for this group, from year-by-year (skips
// years spent entirely in the minors, so no empty game-log fetch).
async function fetchMlbSeasons(personId, group) {
  try {
    const data = await getJson(
      `/api/v1/people/${personId}/stats?stats=yearByYear&group=${group}&sportId=1`,
    )
    const splits = data.stats?.[0]?.splits ?? []
    return [...new Set(splits.map((s) => Number(s.season)).filter(Boolean))].sort()
  } catch {
    return []
  }
}

async function fetchGameLog(personId, group, season) {
  try {
    const data = await getJson(
      `/api/v1/people/${personId}/stats?stats=gameLog&group=${group}&season=${season}&sportId=1`,
    )
    return data.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

// Sweep a player's whole MLB career (regular season) and fold every game into a
// per-opponent bucket: running component sums for the career line, plus the
// most-recent meeting for the last-game line. Returns { [oppTeamId]: entry }.
async function buildPlayerVs(personId, group, teamAbbr) {
  const seasons = await fetchMlbSeasons(personId, group)
  if (!seasons.length) return {}
  const logs = await mapConcurrent(seasons, 4, (yr) => fetchGameLog(personId, group, yr))

  const isPitcher = group === 'pitching'
  const buckets = new Map() // oppId -> { sums, last }
  for (const splits of logs) {
    for (const s of splits ?? []) {
      // Regular season only, and games with a real opponent + date.
      if (s.gameType !== 'R') continue
      const oppId = s.opponent?.id
      const date = s.date
      if (!oppId || !date) continue
      const st = s.stat ?? {}
      let b = buckets.get(oppId)
      if (!b) {
        b = { last: null, sums: isPitcher
          ? { g: 0, outs: 0, er: 0, k: 0, bb: 0 }
          : { g: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, sf: 0, tb: 0 } }
        buckets.set(oppId, b)
      }
      if (isPitcher) {
        b.sums.g += num(st.gamesPlayed)
        b.sums.outs += ipToOuts(st.inningsPitched)
        b.sums.er += num(st.earnedRuns)
        b.sums.k += num(st.strikeOuts)
        b.sums.bb += num(st.baseOnBalls)
      } else {
        b.sums.g += num(st.gamesPlayed)
        b.sums.ab += num(st.atBats)
        b.sums.h += num(st.hits)
        b.sums.hr += num(st.homeRuns)
        b.sums.rbi += num(st.rbi)
        b.sums.bb += num(st.baseOnBalls)
        b.sums.hbp += num(st.hitByPitch)
        b.sums.sf += num(st.sacFlies)
        b.sums.tb += num(st.totalBases)
      }
      // Track the latest meeting for the last-game line.
      if (!b.last || date > b.last.date) {
        b.last = {
          date,
          home: Boolean(s.isHome),
          opp: teamAbbr.get(oppId) ?? '',
          line: isPitcher ? pitcherLine(st) : hitterLine(st),
        }
      }
    }
  }

  const vs = {}
  for (const [oppId, b] of buckets) {
    const s = b.sums
    const car = isPitcher
      ? { g: s.g, ip: outsToIp(s.outs), era: eraOf(s.er, s.outs), k: s.k, bb: s.bb }
      : { g: s.g, ab: s.ab, avg: avgOf(s.h, s.ab), hr: s.hr, rbi: s.rbi, ops: opsOf(s) }
    vs[oppId] = { car, last: b.last }
  }
  return vs
}

// --- main ---------------------------------------------------------------------
const teams = await fetchMlbTeams()
const teamAbbr = new Map(teams.map((t) => [t.id, t.abbr]))
const teamIds = teams.map((t) => t.id)

const nextOpponent = await fetchNextOpponents(teamIds)

// Every active-roster player, deduped (a player traded mid-day could in
// principle appear twice; keep the first club seen).
const rosters = await mapConcurrent(teamIds, 6, (id) =>
  fetchActiveRoster(id).then((roster) => ({ teamId: id, roster })),
)
const playerMeta = new Map() // personId -> { teamId, group, name }
for (const r of rosters) {
  if (!r) continue
  for (const p of r.roster) {
    if (!playerMeta.has(p.id)) {
      playerMeta.set(p.id, { teamId: r.teamId, group: p.group, name: p.name })
    }
  }
}

const ids = [...playerMeta.keys()]
const vsList = await mapConcurrent(ids, 6, (id) =>
  buildPlayerVs(id, playerMeta.get(id).group, teamAbbr),
)

const players = {}
let connections = 0
ids.forEach((id, i) => {
  const vs = vsList[i]
  if (!vs || Object.keys(vs).length === 0) return
  const meta = playerMeta.get(id)
  players[id] = { teamId: meta.teamId, group: meta.group, vs }
  connections += Object.keys(vs).length
})

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    season: new Date().getUTCFullYear(),
    teams,
    nextOpponent,
    players,
  }),
)
console.log(
  `wrote ${out} (${teams.length} teams, ${Object.keys(players).length} players, ${connections} player-opponent splits)`,
)
