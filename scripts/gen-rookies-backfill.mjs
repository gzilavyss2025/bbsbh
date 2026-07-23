// One-time historical sweep for public/data/rookies.json — every player who
// has ever debuted in MLB, with the exact date (if any) his career crossed
// the rookie limit: 130 at-bats OR 50 innings pitched (cumulative, MLB only).
// NOT the full official MLB rookie rule — that also has a 45-active-roster-
// days clause, deliberately left out (would need a transaction-scan/roster-day
// reconstruction, similar effort to gen-rehab.mjs, for an edge case that
// rarely flips the answer).
//
// NOT ON THE NIGHTLY CRON (see scripts/gen-rookies.mjs for that) — same
// category as gen-war-history.mjs/gen-milb-history.mjs: a one-time backfill,
// hand-run before gen-rookies.mjs is ever live, and re-run only to widen the
// historical range. Each player computed here is written ONCE and never
// recomputed by a later run (of either script) — see gen-rookies.mjs's header
// for why a closed record must never be overwritten.
//
// Enumerates every MLB season's player pool (/api/v1/sports/1/players?season=
// YYYY carries each player's own mlbDebutDate — no separate debut lookup
// needed), deduped by personId, defaulting to the full modern-era range
// (1901–present). A real from-scratch run is a genuinely large one-time crawl;
// --since/--until let it be chunked across invocations instead of one very
// long run, and a re-run only computes personIds NOT already in the output
// file (so widening the range later doesn't recompute anyone already done).
//
// Run by hand:
//   node scripts/gen-rookies-backfill.mjs                       # full 1901–present
//   node scripts/gen-rookies-backfill.mjs --since=2015 --until=2020
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { levelSeasonStat } from '../src/api/person.js'
import { ipToOuts } from '../src/api/rehab-policy.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'rookies.json')
const BASE = 'https://statsapi.mlb.com'

const ROOKIE_AB_LIMIT = 130
const ROOKIE_IP_OUTS_LIMIT = 150 // 50 IP == 150 outs
const LIMIT = { hitting: ROOKIE_AB_LIMIT, pitching: ROOKIE_IP_OUTS_LIMIT }

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// Run an async mapper across items with a small concurrency cap (be polite to
// statsapi). Mirrors gen-milestones.mjs's helper.
async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await mapper(items[i], i)
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (m) args[m[1]] = m[2]
  }
  return args
}

// A two-way player (Ohtani) is checked in both groups; everyone else in the
// one group his primary position implies. Mirrors gen-milestones.mjs's
// groupsFor.
function groupsFor(position) {
  const abbr = position?.abbreviation
  if (abbr === 'TWP') return ['hitting', 'pitching']
  return [abbr === 'P' ? 'pitching' : 'hitting']
}

function statValue(group, agg) {
  if (!agg) return 0
  return group === 'pitching' ? ipToOuts(agg.inningsPitched) : Number(agg.atBats) || 0
}

// Walk one group's career, season by season, to find the season cumulative
// AB/outs first crosses the limit. Returns { crossingSeason, priorTotal }
// (priorTotal = cumulative total ENTERING the crossing season) or null if his
// whole career never crosses.
//
// Uses levelSeasonStat (not a raw aggregateSplits over the season's rows) —
// yearByYear can include a synthetic team-less row summing a same-season
// trade's per-team rows, and aggregateSplits doesn't recognize it as a
// duplicate, so summing every row double-counts the season. See
// gen-rookies.mjs's findCrossingSeason for the verified case this caused
// (Mauricio Dubón stuck permanently open from his mid-2019 trade).
function findCrossingSeason(yearSplits, group) {
  const bySeason = new Map()
  for (const s of yearSplits) {
    const yr = Number(s.season)
    if (!Number.isFinite(yr)) continue
    if (!bySeason.has(yr)) bySeason.set(yr, [])
    bySeason.get(yr).push(s)
  }
  const seasons = [...bySeason.keys()].sort((a, b) => a - b)
  let running = 0
  for (const yr of seasons) {
    const value = statValue(group, levelSeasonStat(bySeason.get(yr), group))
    if (running + value >= LIMIT[group]) return { crossingSeason: yr, priorTotal: running }
    running += value
  }
  return null
}

// Pin the exact date within the crossing season by walking that one season's
// game log ascending, running-summing from priorTotal — same technique
// gen-rehab.mjs uses (fetchGameLogDates) to compare a career log against a
// stint window, applied here to AB/outs instead of dates.
async function findCrossingDate(personId, group, season, priorTotal) {
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=gameLog&group=${group}&season=${season}`,
  )
  const games = (data.stats?.[0]?.splits ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  let running = priorTotal
  for (const g of games) {
    running += group === 'pitching' ? ipToOuts(g.stat?.inningsPitched) : Number(g.stat?.atBats) || 0
    if (running >= LIMIT[group]) return g.date
  }
  return null
}

// One player's full rookie record: debut date + the date (if any) he crossed
// the rookie limit in ANY checked group — for a two-way player, whichever
// group crosses first chronologically wins.
async function rookieRecordFor(personId, mlbDebutDate, groups) {
  const perGroup = await Promise.all(
    groups.map(async (group) => {
      const splits = await getJson(
        `/api/v1/people/${personId}/stats?stats=yearByYear&group=${group}`,
      )
      const yearSplits = splits.stats?.[0]?.splits ?? []
      const crossing = findCrossingSeason(yearSplits, group)
      if (!crossing) return null
      return { group, ...crossing }
    }),
  )
  const crossings = perGroup.filter(Boolean)
  if (!crossings.length) return { debutDate: mlbDebutDate, rookieUntil: null }
  const dates = (
    await Promise.all(
      crossings.map((c) => findCrossingDate(personId, c.group, c.crossingSeason, c.priorTotal)),
    )
  ).filter(Boolean)
  dates.sort()
  return { debutDate: mlbDebutDate, rookieUntil: dates[0] ?? null }
}

// --- main --------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2))
const startYear = Number(args.since) || 1901
const endYear = Number(args.until) || new Date().getUTCFullYear()
const seasons = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)

let existing = { generatedAt: null, players: {} }
try {
  existing = JSON.parse(await readFile(out, 'utf8'))
} catch {
  // first run — no file yet
}

// Every player who's ever appeared in an MLB season pool within range, deduped
// by id — each record already carries its own mlbDebutDate, so no separate
// debut lookup is needed (verified live against /api/v1/sports/1/players).
const playersById = new Map()
await mapConcurrent(seasons, 8, async (season) => {
  const data = await getJson(`/api/v1/sports/1/players?season=${season}`)
  for (const p of data.people ?? []) {
    if (p.mlbDebutDate && !playersById.has(p.id)) {
      playersById.set(p.id, { id: p.id, mlbDebutDate: p.mlbDebutDate, position: p.primaryPosition })
    }
  }
})

// Skip anyone already in the output file — a re-run (to widen the range)
// only fills in NEW personIds, never recomputes an existing record.
const toCompute = [...playersById.values()].filter((p) => !existing.players[p.id])

const results = await mapConcurrent(toCompute, 10, async (p) => {
  const rec = await rookieRecordFor(p.id, p.mlbDebutDate, groupsFor(p.position))
  return rec ? [p.id, rec] : null
})

for (const r of results) {
  if (!r) continue
  const [id, rec] = r
  existing.players[id] = rec
}

await mkdir(dirname(out), { recursive: true })
existing.generatedAt = new Date().toISOString()
await writeFile(out, JSON.stringify(existing))
console.log(
  `wrote ${out} (${Object.keys(existing.players).length} players total, ${toCompute.length} newly computed this run, seasons ${startYear}-${endYear})`,
)
