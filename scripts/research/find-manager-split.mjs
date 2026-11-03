// Hand-run research helper for #2761 (a mid-season manager change). Not a
// generator, writes nothing:
//
//   node scripts/research/find-manager-split.mjs <teamId> <season> <outgoing name> <outW-outL> <inW-inL>
//
// Give it the OUTGOING manager's name (a last name is enough) and both
// managers' W-L from a cited source (Baseball-Reference's "Managers" line). It
// walks the club's regular-season schedule and prints the complete seed entry
// for scripts/manager-transitions-seed.json, or a status saying why not. Only
// an `ok` result goes in the seed; anything else is a [DECISION: ...].
import { readFile } from 'node:fs/promises'
import { getJson } from '../lib/statsapi.mjs'
import { findSplit, parseRecord, teamSeasonGames, pickManagers } from '../lib/records/manager-split.mjs'

const [teamId, season] = process.argv.slice(2, 4).map(Number)
const outgoingName = process.argv[4]
const out = parseRecord(process.argv[5])
const inc = parseRecord(process.argv[6])
if (!teamId || !season || !outgoingName || !out || !inc) {
  console.error('usage: node scripts/research/find-manager-split.mjs <teamId> <season> <outgoing name> <outW-outL> <inW-inL>')
  process.exit(2)
}

const queue = JSON.parse(await readFile(new URL('../manager-transitions-needs-research.json', import.meta.url), 'utf8'))
const entry = queue.find((q) => q.teamId === teamId && q.season === season)
const [schedule, ...people] = await Promise.all([
  getJson(`/api/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R`),
  ...(entry?.managerIds ?? []).map((id) => getJson(`/api/v1/people/${id}`)),
])
const games = teamSeasonGames(schedule, teamId)
const managers = (entry?.managerIds ?? []).map((id, i) => ({ id, name: people[i].people?.[0]?.fullName ?? '?' }))

let result = findSplit(games, out, inc)
const ids = pickManagers(managers, outgoingName)
if (!entry) result = { ...result, status: 'not-queued' }
else if (managers.length > 2) result = { ...result, status: 'more-than-two-managers' }
else if (result.status === 'ok' && !ids) result = { ...result, status: 'name-not-matched' }

console.log(JSON.stringify({ teamId, season, games: games.length, ...result, managers }, null, 2))
if (result.status === 'ok') {
  console.log('Seed entry:')
  console.log(JSON.stringify({ teamId, season, transitionDate: result.transitionDate, ...ids }))
}
// exitCode, not exit(): exiting with fetch sockets still closing crashes libuv on Windows.
process.exitCode = result.status === 'ok' ? 0 : 1
