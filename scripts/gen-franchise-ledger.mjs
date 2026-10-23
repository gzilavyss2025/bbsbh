// Writes public/data/franchise-ledger/{teamId}.json: one row per season for each of the 30 MLB
// clubs, 1901 to the last complete season (#2595). A row holds the club's name and league that
// year, W-L, games back, division and league rank, runs for and against, the managers, the
// postseason result and a note for an odd season (1981, 1994, 2020). Keyed by the CURRENT team
// id, which a club keeps across a move (158 is the Pilots and the Brewers). Reader:
// src/api/history/franchiseLedger.js. The pure half: scripts/lib/franchise/ledger.mjs.
//
// Sources (all but the last are read off disk):
//   standings?leagueId=103,104&season=Y&standingsTypes=regularSeason  one call a season
//   schedule/postseason?season=Y                                       one call a season
//   public/data/franchise-history/{id}.json                            name and league by season
//   public/data/manager-history/{NN}.json                              managers, 1969 on only
//   people?personIds=...                                               the managers' names
//
// HAND-RUN, immutable: `node scripts/gen-franchise-ledger.mjs [--through 2025]`. Re-run only to
// fold in a new season. The files carry no clock, so a re-run with no new season writes the same
// bytes. Any failed call aborts the run (strict), so a hole cannot ship.
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_MLB_TEAM_IDS } from '../src/lib/teams.js'
import { writeShards } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { buildLedger, managersFor, postseasonFor, standingsFor } from './lib/franchise/ledger.mjs'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const outDir = join(root, 'public', 'data', 'franchise-ledger')
const FIRST = 1901
const flag = process.argv.indexOf('--through')
const through = flag > 0 ? Number(process.argv[flag + 1]) : new Date().getUTCFullYear() - 1
if (!Number.isInteger(through) || through < FIRST) throw new Error(`bad --through: ${through}`)
const seasons = Array.from({ length: through - FIRST + 1 }, (_, i) => FIRST + i)

const standings = new Map()
const postseason = new Map()
const answers = await mapConcurrent(
  seasons,
  6,
  async (season) => ({
    season,
    standings: await getJson(`/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`),
    postseason: await getJson(`/api/v1/schedule/postseason?season=${season}`),
  }),
  { strict: true },
)
for (const a of answers) {
  standings.set(a.season, standingsFor(a.standings.records))
  postseason.set(a.season, postseasonFor(a.postseason.dates))
}

const managerDir = join(root, 'public', 'data', 'manager-history')
const shards = await Promise.all(
  (await readdir(managerDir)).filter((f) => f.endsWith('.json')).sort().map(async (f) => JSON.parse(await readFile(join(managerDir, f), 'utf8'))),
)
const managers = managersFor(shards)

const spansOf = async (id) => JSON.parse(await readFile(join(root, 'public', 'data', 'franchise-history', `${id}.json`), 'utf8')).spans
const clubSpans = new Map()
for (const id of ALL_MLB_TEAM_IDS) clubSpans.set(id, await spansOf(id))

// Names for just the managers a row uses, a hundred to a call.
const need = new Set()
for (const id of ALL_MLB_TEAM_IDS) {
  for (const span of clubSpans.get(id)) {
    for (let season = span.from; season <= Math.min(span.to, through); season++) {
      for (const m of managers.get(`${id}-${season}`) ?? []) need.add(m.id)
    }
  }
}
const ids = [...need].sort((a, b) => a - b)
const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, i * 100 + 100))
const named = await mapConcurrent(batches, 4, (batch) => getJson(`/api/v1/people?personIds=${batch.join(',')}`), { strict: true })
const names = new Map(named.flatMap((r) => r.people ?? []).map((p) => [p.id, p.fullName]))
const missing = ids.filter((id) => !names.has(id))
if (missing.length) throw new Error(`no name for manager ids ${missing.join(', ')}`)

await writeShards(
  outDir,
  ALL_MLB_TEAM_IDS.map((id) => [
    id,
    { teamId: id, through, rows: buildLedger({ teamId: id, spans: clubSpans.get(id), through, standings, postseason, managers, names }) },
  ]),
)
console.log(`franchise-ledger: ${ALL_MLB_TEAM_IDS.length} clubs, ${FIRST}-${through}, ${names.size} managers named`)
