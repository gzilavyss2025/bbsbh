// Writes public/data/league-pennants.json: every league pennant (a World Series
// berth) by club, 1903 to the current season, with the name, club label,
// abbreviation and league the club carried that year.
//
// Source: GET /api/v1/schedule/postseason/series?season=Y&sportId=1&hydrate=team,
// one call a season (~123). A relocated club keeps its team id there (the 1955
// Brooklyn Dodgers are 119), so a club's pennants all land under one id. The feed
// holds no World Series for 1904 and 1994, so the file has none. The feed lists a
// season's World Series as soon as both LCS are decided, before a game is played, so
// the current season's two pennants appear then (and nothing before). Seasons before 1903
// (the 1901-02 AL, the NL back to 1876) are NOT in it. Pure half:
// scripts/lib/club/league-pennants.mjs. Reader: src/api/history/leaguePennants.js.
//
// HAND-RUN, immutable: `node scripts/gen-league-pennants.mjs [--through 2025]`.
// Re-run once the LCS end each year. The file carries no clock, so a
// re-run with no new season writes the same bytes. Any failed call aborts the run
// (strict), so a hole cannot ship. The world champion's row carries `ws: true`.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_MLB_TEAM_IDS } from '../src/lib/teams.js'
import { writeJsonAtomic } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { groupByTeam, pennantsOfSeason } from './lib/club/league-pennants.mjs'

const out = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public', 'data', 'league-pennants.json')
const FIRST = 1903
const flag = process.argv.indexOf('--through')
const through = flag > 0 ? Number(process.argv[flag + 1]) : new Date().getUTCFullYear()

if (!Number.isInteger(through) || through < FIRST) throw new Error(`bad --through: ${through}`)
const seasons = Array.from({ length: through - FIRST + 1 }, (_, i) => FIRST + i)
const answers = await mapConcurrent(
  seasons,
  6,
  async (season) => ({
    season,
    series: (await getJson(`/api/v1/schedule/postseason/series?season=${season}&sportId=1&hydrate=team`)).series ?? [],
  }),
  { strict: true },
)

const rows = answers.flatMap(({ season, series }) => pennantsOfSeason(season, series))
const teams = groupByTeam(rows)
for (const id of Object.keys(teams)) {
  if (!ALL_MLB_TEAM_IDS.includes(Number(id))) throw new Error(`pennant for club ${id}, which is not a current MLB club`)
}
await writeJsonAtomic(out, { through, teams })
console.log(`${rows.length} pennants, ${Object.keys(teams).length} clubs, ${FIRST}-${through}`)
