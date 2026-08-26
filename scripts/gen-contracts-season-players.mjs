// Caches, per MLB season, every player who appeared that year -- the
// candidate pool the contract-identity matching pipeline
// (scripts/gen-contracts-identity.mjs) matches historical contract-CSV rows
// against.
//
// One call per season to statsapi's `sports/1/players?season=YYYY` returns
// ~1,300 people, each carrying `lastFirstName` in the exact "Last, First"
// format the source spreadsheets use, plus `currentTeam.id` -- verified LIVE
// to reflect the player's team AS OF the queried season, not their
// present-day team (querying season=2015 correctly returns Manny Machado's
// Orioles, not the Padres he plays for now). That means this single cheap
// call (36 total, one per season 1991-2026) is enough to scope a name match
// to a team+season roster, AND -- since salaries.csv carries no team column
// at all -- to fall back to a full season-wide candidate pool when no team is
// known.
//
// Two copies are written:
//   .scratch/contracts/season-players-raw/{year}.json  - full API response,
//     gitignored, cheap to rebuild
//   public/data/contracts-history/season-players/{year}.json - trimmed to the
//     five fields the matcher and the (later) admin review picker need
//
// Run by hand: node scripts/gen-contracts-season-players.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from './lib/statsapi.mjs'
import { writeJsonAtomic } from './lib/io.js'
import { mapConcurrent } from './lib/concurrency.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const rawDir = join(here, '..', '.scratch', 'contracts', 'season-players-raw')
const shippedDir = join(here, '..', 'public', 'data', 'contracts-history', 'season-players')

const START_SEASON = 1991
const END_SEASON = 2026
const CONCURRENCY = 6

function trim(person) {
  return {
    id: person.id,
    lastFirstName: person.lastFirstName ?? null,
    teamId: person.currentTeam?.id ?? null,
    position: person.primaryPosition?.abbreviation ?? null,
    debutYear: person.mlbDebutDate ? Number(person.mlbDebutDate.slice(0, 4)) : null,
  }
}

async function fetchSeason(season) {
  const json = await getJson(`/api/v1/sports/1/players?season=${season}`)
  const people = json.people ?? []
  await writeJsonAtomic(join(rawDir, `${season}.json`), json)
  await writeJsonAtomic(
    join(shippedDir, `${season}.json`),
    people.map(trim),
  )
  return { season, count: people.length }
}

async function main() {
  const seasons = []
  for (let s = START_SEASON; s <= END_SEASON; s++) seasons.push(s)

  const results = await mapConcurrent(seasons, CONCURRENCY, fetchSeason)

  let total = 0
  for (const r of results) {
    if (!r) continue
    total += r.count
  }
  const failed = seasons.filter((_, i) => !results[i])

  console.log(`Fetched ${results.filter(Boolean).length}/${seasons.length} seasons, ${total} player-season rows.`)
  if (failed.length) {
    console.error(`FAILED seasons (retry by re-running, mapConcurrent is best-effort): ${failed.join(', ')}`)
    process.exitCode = 1
  }
}

await main()
