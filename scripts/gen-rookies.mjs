// Regenerates public/data/rookies.json — every player's rookie window (debut
// date + the date, if any, his career crossed the rookie limit: 130 at-bats OR
// 50 innings pitched, cumulative, MLB only). Feeds RookiePill (a "still
// rookie-eligible" pill on the roster/lineup surfaces) and the player page's
// Transactions timeline ("Lost Rookie Status" once closed) — see
// src/api/rookies.js.
//
// rookies.json is the MASTER record and is not fetched by the app. After every
// write this script derives public/data/rookies/ from it — a compact
// whole-league status map for the pills, plus id-sharded full records for the
// player page. See scripts/lib/rookie-shards.mjs for why the split is by role
// rather than by id.
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
import { writeRookieShards } from './lib/rookie-shards.mjs'
import { fileURLToPath } from 'node:url'
import { ALL_MLB_TEAM_IDS } from '../src/lib/teams.js'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { findCrossingSeason, crossingDateFromGameLog } from './lib/rookie-crossing.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'rookies.json')

// Run an async mapper across items with a small concurrency cap (be polite to
// statsapi). Mirrors gen-milestones.mjs's helper.
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

// Pin the exact date within the crossing season by walking that one season's
// game log ascending, running-summing from priorTotal.
async function findCrossingDate(personId, group, season, priorTotal) {
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=gameLog&group=${group}&season=${season}`,
  )
  const games = (data.stats?.[0]?.splits ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  return crossingDateFromGameLog(games, group, priorTotal)
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
// The master file above is the append-only record; the app reads the derived
// shards under public/data/rookies/ instead (see scripts/lib/rookie-shards.mjs).
const shards = await writeRookieShards(dirname(out), existing)
console.log(
  `wrote ${out} (${Object.keys(existing.players).length} players total, checked ${toCheck.length} open candidates, ${added} newly added, ${closed} newly closed)`,
)
console.log(`wrote public/data/rookies/ (status + ${shards.shards} record shards)`)
