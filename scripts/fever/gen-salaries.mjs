// Regenerates public/data/team-contracts/{teamId}.json (one club ledger each)
// and public/data/salaries.json (the league rollup) — the two files behind
// /team/{id}/contracts and /salaries.
//
// DERIVED, NOT RE-FETCHED. The contract facts come from the shards
// gen-player-contracts.mjs already wrote, not from a second call to Fever's
// feed. Two reasons: a club ledger and a player card must never disagree about
// the same contract, and one nightly source call is enough. That makes the
// ordering a hard requirement rather than a preference — this MUST run after
// scripts/fever/gen-player-contracts.mjs in the nightly workflow, or it rolls
// up yesterday's contracts under today's timestamp.
//
// The one thing the contract feed does not carry is a POSITION, so the 40-man
// roster supplies it (statsapi, 30 requests through the shared pool in
// scripts/lib/concurrency.mjs, hydrated with BOTH the season and the career
// pitching line so a pitcher can be told apart as a starter or a reliever — the
// feed only ever says "P", and an arm with no season line is usually injured
// rather than unknown).
// A player in the contract feed with no 40-man place is not dropped: he is
// money the club still owes with nobody to show for it, which is exactly what
// the ledger's "Off roster" group is for.
//
// Attribution rides through unchanged in `meta` — Fever Baseball and, under
// them, Cot's Baseball Contracts. Every surface that renders these files must
// keep showing it (see src/components/salaries/SourceLine.jsx).
//
// Run by hand: node scripts/fever/gen-salaries.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, readFile } from 'node:fs/promises'
import { writeJsonAtomic, writeShards } from '../lib/io.js'
import { mapConcurrent } from '../lib/concurrency.mjs'
import { resolvePosition, rollUpSalaries } from '../lib/salaries.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const contractsDir = join(here, '..', '..', 'public', 'data', 'player-contracts')
const teamDir = join(here, '..', '..', 'public', 'data', 'team-contracts')
const leagueOut = join(here, '..', '..', 'public', 'data', 'salaries.json')
const STATSAPI = 'https://statsapi.mlb.com'

async function getJson(path) {
  const res = await fetch(`${STATSAPI}${path}`)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json()
}

// Every contract record the nightly shards hold, plus the meta they share.
async function readContractShards() {
  const files = (await readdir(contractsDir)).filter((f) => f.endsWith('.json')).sort()
  if (files.length === 0) throw new Error('no player-contract shards — run gen-player-contracts.mjs first')
  const players = []
  let meta = null
  for (const file of files) {
    const shard = JSON.parse(await readFile(join(contractsDir, file), 'utf8'))
    meta ??= shard.meta
    players.push(...Object.values(shard.players ?? {}))
  }
  return { meta, players }
}

// The 30 current clubs, ids and abbreviations straight from statsapi. Verified
// 2026-08-18: every abbreviation it returns matches the one Cot's writes on the
// contract record, all thirty, so the two join on the abbreviation with no alias
// table to drift. A club that ever stops matching shows up as an empty ledger
// rather than as wrong money, which is the failure worth having.
async function fetchTeams() {
  const data = await getJson('/api/v1/teams?sportId=1&activeStatus=Y&fields=teams,id,abbreviation,name')
  return (data.teams ?? [])
    .map((team) => ({ id: team.id, abbrev: team.abbreviation, name: team.name }))
    .sort((a, b) => a.abbrev.localeCompare(b.abbrev))
}

// teamId -> { playerId -> { pos, age } }. A pitcher comes back as "P"; his own
// stat lines decide whether he reads as SP or RP. Both the season line and the
// career line are hydrated on this one request, because an arm with no season
// line is usually an INJURED starter rather than an unknown one — resolvePosition
// in scripts/lib/salaries.mjs has the rule and the reason.
//
// Thirty requests through the shared pool at the house limit of 8, the same
// shape every other roster fan-out in scripts/ uses. FAILS LOUD, which is the
// part worth keeping: mapConcurrent is best-effort and hands back `null` for a
// call that threw, and a null here would not empty the page — it would move a
// whole club's players into the "Off roster" band, reading as money owed to
// nobody rather than as a club whose roster did not load. A wrong ledger is
// worse than no ledger, so a missing club aborts the run.
async function fetchPlaces(teamIds, season) {
  const rosters = await mapConcurrent(teamIds, 8, async (teamId) => {
    const data = await getJson(
      `/api/v1/teams/${teamId}/roster?rosterType=40Man` +
        `&hydrate=person(stats(type=[season,career],group=[pitching],season=${season}))`,
    )
    const map = new Map()
    for (const entry of data.roster ?? []) {
      const id = entry.person?.id
      if (id == null) continue
      map.set(id, { pos: resolvePosition(entry), age: entry.person?.currentAge ?? null })
    }
    return map
  })
  const missing = teamIds.filter((_, i) => rosters[i] == null)
  if (missing.length) throw new Error(`40-man roster failed for team ${missing.join(', ')}`)
  return new Map(teamIds.map((teamId, i) => [teamId, rosters[i]]))
}

async function main() {
  const { meta, players } = await readContractShards()
  const season = meta.season
  const teams = await fetchTeams()
  const places = await fetchPlaces(teams.map((team) => team.id), season)

  const { clubs, league } = rollUpSalaries({ meta, players, places, teams, season })

  const { written, swept } = await writeShards(
    teamDir,
    clubs.map((club) => [String(club.teamId), club]),
  )
  await writeJsonAtomic(leagueOut, league)
  console.log(
    `wrote ${written} club ledgers (swept ${swept}) and salaries.json — ` +
      `${league.players.length} salaried players, ${league.clubs.length} clubs, season ${season}`,
  )
}

main()
