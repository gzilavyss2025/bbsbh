// Hand-run research helper for #2761 (a mid-season manager change). Not a
// generator, writes nothing:
//
//   node scripts/research/find-manager-split.mjs <teamId> <season> <outW-outL> [<inW-inL>]
//
// Give it the OUTGOING manager's W-L from a cited source (Baseball-Reference's
// "Managers" line); it walks the club's regular-season schedule and prints the
// seed entry for scripts/manager-transitions-seed.json, or a status saying why
// not. Only an `ok` result goes in the seed; anything else is a [DECISION: ...].
// The two manager ids come from the needs-research queue, named so you can
// match them to the source (the queue's order is not the order they managed).
import { readFile } from 'node:fs/promises'
import { getJson } from '../lib/statsapi.mjs'
import { findSplit, parseRecord } from '../lib/records/manager-split.mjs'

const [teamId, season] = process.argv.slice(2, 4).map(Number)
const out = parseRecord(process.argv[4])
const inc = process.argv[5] ? parseRecord(process.argv[5]) : null
if (!teamId || !season || !out || (process.argv[5] && !inc)) {
  console.error('usage: node scripts/research/find-manager-split.mjs <teamId> <season> <outW-outL> [<inW-inL>]')
  process.exit(2)
}

const data = await getJson(`/api/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R`)
// Same filter as gen-manager-history.mjs's fetchTeamSeasonGames: Final games
// with a winner, so a tie is not a game here (the source lists ties apart).
const games = []
for (const d of data.dates ?? []) {
  for (const gm of d.games ?? []) {
    if (gm.status?.abstractGameState !== 'Final') continue
    const side = gm.teams?.home?.team?.id === teamId ? gm.teams?.home : gm.teams?.away
    if (typeof side?.isWinner !== 'boolean') continue
    games.push({ date: gm.officialDate ?? (gm.gameDate ?? '').slice(0, 10), won: side.isWinner })
  }
}

const result = findSplit(games, out, inc)
const queue = JSON.parse(await readFile(new URL('../manager-transitions-needs-research.json', import.meta.url), 'utf8'))
const entry = queue.find((q) => q.teamId === teamId && q.season === season)
const managers = []
for (const id of entry?.managerIds ?? []) {
  const p = await getJson(`/api/v1/people/${id}`)
  managers.push({ id, name: p.people?.[0]?.fullName ?? '?' })
}

console.log(JSON.stringify({ teamId, season, games: games.length, ...result, managers }, null, 2))
if (!entry) console.log('NOTE: not in the needs-research queue.')
if (managers.length > 2) console.log('NOTE: more than two managers; this is an M chunk season, not H.')
if (result.status === 'ok') {
  console.log('Seed entry (set the two ids from the names above):')
  console.log(JSON.stringify({ teamId, season, transitionDate: result.transitionDate, outgoingManagerId: 0, incomingManagerId: 0 }))
}
process.exitCode = result.status === 'ok' ? 0 : 1
