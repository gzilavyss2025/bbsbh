// Writes public/data/franchise-history/{teamId}.json: each current MLB club's
// name, league and ballpark for every season, 1901 to the last complete one,
// collapsed into spans (scripts/lib/franchise-history.mjs).
//
// Source: GET /api/v1/teams?sportId=1&season={Y}&hydrate=venue, one call a season
// (~125). A relocated club keeps its team id there (the Brewers' 1969 row is the
// Seattle Pilots), so no id mapping is needed. Reader: src/api/franchiseHistory.js.
//
// HAND-RUN, immutable: `node scripts/gen-franchise-history.mjs [--through 2025]`.
// Re-run only to fold in a new season. The files carry no clock, so a re-run with
// no new season writes the same bytes. Any failed call aborts the run (strict),
// so a hole cannot ship.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_MLB_TEAM_IDS } from '../src/lib/teams.js'
import { writeShards } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { collapseSeasons, venueMates } from './lib/franchise-history.mjs'

const outDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public', 'data', 'franchise-history')
const FIRST = 1901
const flag = process.argv.indexOf('--through')
const through = flag > 0 ? Number(process.argv[flag + 1]) : new Date().getUTCFullYear() - 1

if (!Number.isInteger(through) || through < FIRST) throw new Error(`bad --through: ${through}`)
const seasons = Array.from({ length: through - FIRST + 1 }, (_, i) => FIRST + i)
const answers = await mapConcurrent(
  seasons,
  6,
  async (season) => ({
    season,
    teams: (await getJson(`/api/v1/teams?sportId=1&season=${season}&hydrate=venue`)).teams ?? [],
  }),
  { strict: true },
)

// Every club in the feed, defunct ones too (Federal League, Negro leagues): they
// share parks with the current clubs, so they feed `mates`. Only the 30 get a file.
const byTeam = {}
for (const { season, teams } of answers) {
  for (const t of teams) {
    // The feed lists an expansion club a season or two before its first game (the
    // 1968 Pilots, the 1996 Diamondbacks) with no league. Measured 2026-10-06:
    // those seven rows are the only ones without one. A club in no league did
    // not play, so the row is not a season.
    if (!t.league?.name) continue
    ;(byTeam[t.id] ??= []).push({
      season,
      name: t.name,
      league: t.league.name,
      venueId: t.venue?.id ?? null,
      venueName: t.venue?.name ?? '',
    })
  }
}

for (const id of ALL_MLB_TEAM_IDS) if (!byTeam[id]) throw new Error(`no rows for club ${id}`)

await writeShards(
  outDir,
  ALL_MLB_TEAM_IDS.map((id) => [
    id,
    { teamId: id, through, spans: collapseSeasons(byTeam[id]), mates: venueMates(id, byTeam) },
  ]),
)
console.log(`franchise-history: ${ALL_MLB_TEAM_IDS.length} clubs, 1901-${through}`)
