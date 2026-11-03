// Hand-run research helper for #2761 (a mid-season manager change). Not a
// generator, writes nothing:
//
//   node scripts/research/find-manager-split.mjs <teamId> <season> <Name1> <W-L> <Name2> <W-L> [<Name3> <W-L> [<Name4> <W-L>]]
//   node scripts/research/find-manager-split.mjs <teamId> <season> <outgoing name> <outW-outL> <inW-inL>   (two managers, older form)
//
// Give every manager in order (a last name is enough) with W-L from a cited
// source (Baseball-Reference's "Managers" line). It walks the club's
// regular-season schedule and prints the complete seed entry for
// scripts/manager-transitions-seed.json, or a status saying why not. Only an
// `ok` result goes in the seed; anything else is a [DECISION: ...].
import { readFile } from 'node:fs/promises'
import { getJson } from '../lib/statsapi.mjs'
import { findSplit, findSplits, parseRecord, teamSeasonGames, pickManagers, pickOrder } from '../lib/records/manager-split.mjs'

const [teamId, season] = process.argv.slice(2, 4).map(Number)
const rest = process.argv.slice(4)
const older = rest.length === 3 && parseRecord(rest[2])
const names = older ? [rest[0], null] : rest.filter((_, i) => i % 2 === 0)
const records = older ? [rest[1], rest[2]].map(parseRecord) : rest.filter((_, i) => i % 2).map(parseRecord)
if (!teamId || !season || rest.length < 3 || rest.length > 8 || (!older && rest.length % 2) || records.includes(null)) {
  console.error('usage: node scripts/research/find-manager-split.mjs <teamId> <season> <Name1> <W-L> <Name2> <W-L> [<Name3> <W-L> [<Name4> <W-L>]]')
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

let result
let seed
if (!entry) result = { status: 'not-queued' }
else if (managers.length !== records.length) result = { status: 'count-mismatch', given: records.length }
else if (records.length === 2) {
  result = findSplit(games, records[0], records[1])
  const ids = pickManagers(managers, names[0])
  if (result.status === 'ok' && !ids) result = { ...result, status: 'name-not-matched' }
  else if (result.status === 'ok') seed = { transitionDate: result.transitionDate, ...ids }
} else {
  const picked = pickOrder(managers, names)
  result = picked.ids ? findSplits(games, records) : picked
  if (result.status === 'ok') {
    seed = { transitions: result.dates.map((date, i) => ({ date, outgoingManagerId: picked.ids[i], incomingManagerId: picked.ids[i + 1] })) }
  }
}

console.log(JSON.stringify({ teamId, season, games: games.length, ...result, managers }, null, 2))
if (seed) {
  console.log('Seed entry:')
  console.log(JSON.stringify({ teamId, season, ...seed }))
}
// exitCode, not exit(): exiting with fetch sockets still closing crashes libuv on Windows.
process.exitCode = result.status === 'ok' ? 0 : 1
