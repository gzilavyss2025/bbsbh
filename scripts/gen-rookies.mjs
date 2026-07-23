// Regenerates public/data/rookies.json — every player's rookie window (debut
// date + the date, if any, his career crossed the rookie limit: 130 at-bats OR
// 50 innings pitched, cumulative, MLB only). Feeds RookiePill (a "still
// rookie-eligible" pill on the roster/lineup surfaces) and the player page's
// Transactions timeline ("Lost Rookie Status" once closed) — see
// src/api/rookies.js.
//
// CRITICAL: this job is APPEND-ONLY/incremental (like gen-game-notes.mjs /
// gen-umpire-accuracy.mjs), NOT a full rebuild (like gen-milestones.mjs). Once
// a player's rookieUntil is set, that's a frozen historical fact — the
// Transactions timeline already shows it, so it must never be recomputed or
// dropped. This script only ever ADDS a new player or CLOSES an already-open
// one; it never touches an existing closed record, and never touches a player
// who isn't on this run's roster scan at all (a released/retired/traded-away
// player's existing record — open or closed — is left completely alone, even
// though he won't show up in fetchFullRoster below). The one-time historical
// backfill (scripts/gen-rookies-backfill.mjs, NOT on this cron) is what
// establishes those older closed records in the first place.
//
// Scans every MLB org's FULL roster (rosterType=fullRoster, so IL/optioned
// players are included, same as gen-milestones.mjs) and keeps only debuted
// players (gated on the roster's hydrated mlbDebutDate). For each one not
// already closed, recomputes his FULL career crossing (same technique as the
// backfill script — season-by-season career totals, then a game-log walk to
// pin the exact date within the crossing season) rather than trying to track
// an incremental delta since the last run: the set of still-open rookie
// candidates on any given night is small (a few hundred at most), so the
// extra correctness/simplicity is worth the one extra yearByYear call per
// candidate.
//
// Runs on a cron via .github/workflows/update-nightly-data.yml. Also by hand:
//   node scripts/gen-rookies.mjs
import { dirname, join } from 'node:path'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { fileURLToPath } from 'node:url'
import { ALL_MLB_TEAM_IDS } from '../src/lib/teams.js'
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

// fullRoster (not active) so IL and optioned/minor-league players are
// included — a rookie call-up who gets optioned back down mid-season is
// still a rookie candidate. Hydrate person for mlbDebutDate.
async function fetchFullRoster(teamId) {
  const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=fullRoster&hydrate=person`)
  return data.roster ?? []
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
// whole career never crosses. Mirrors gen-rookies-backfill.mjs.
//
// Uses levelSeasonStat (not a raw aggregateSplits over the season's rows) —
// yearByYear can include a synthetic team-less row summing a same-season
// trade's per-team rows, and aggregateSplits doesn't recognize it as a
// duplicate, so summing every row double-counts the season. That inflation
// was pinning a false, too-early crossing season for anyone traded during
// his rookie window (verified live: Mauricio Dubón, traded mid-2019 — the
// inflated 2019 total falsely crossed 130 AB, but his real 2019 AB total was
// 106, so findCrossingDate's game-log walk never confirmed it and his record
// stuck open forever instead of closing on his real crossing date).
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
// game log ascending, running-summing from priorTotal.
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
      const splits = await getJson(`/api/v1/people/${personId}/stats?stats=yearByYear&group=${group}`)
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
// ENOENT → first run; gen-rookies-backfill.mjs should normally run first, but
// this degrades to building the file from scratch if not. A corrupt committed
// file must abort rather than silently rebuild and drop closed records.
const existing = await readJsonOr(out, { generatedAt: null, players: {} })

// mapConcurrent returns null for a team whose roster fetch failed; keep the run
// alive by dropping those rows. The optional chain must guard `r` itself (not
// just `r.person`), or a null row throws here on one transient per-team failure.
const rosterEntries = (await mapConcurrent(ALL_MLB_TEAM_IDS, 8, (teamId) => fetchFullRoster(teamId)))
  .flat()
  .filter((r) => r?.person?.mlbDebutDate)

// Only players not already CLOSED — a new debut, or one still open as of the
// last run. Never re-touch a closed record.
const toCheck = rosterEntries.filter((r) => {
  const rec = existing.players[r.person.id]
  return !rec || rec.rookieUntil === null
})

const updates = await mapConcurrent(toCheck, 10, async (r) => {
  const rec = await rookieRecordFor(r.person.id, r.person.mlbDebutDate, groupsFor(r.position))
  return rec ? [r.person.id, rec] : null
})

let added = 0
let closed = 0
for (const u of updates) {
  if (!u) continue
  const [id, rec] = u
  const prev = existing.players[id]
  if (!prev) added++
  else if (prev.rookieUntil === null && rec.rookieUntil !== null) closed++
  existing.players[id] = rec
}

existing.generatedAt = new Date().toISOString()
await writeJsonAtomic(out, existing)
console.log(
  `wrote ${out} (${Object.keys(existing.players).length} players total, checked ${toCheck.length} open candidates, ${added} newly added, ${closed} newly closed)`,
)
