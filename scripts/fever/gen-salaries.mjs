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
// roster supplies it (statsapi, 30 requests, hydrated with season pitching
// stats so a pitcher can be told apart as a starter or a reliever — the feed
// only ever says "P"). A player in the contract feed with no 40-man place is
// not dropped: he is money the club still owes with nobody to show for it,
// which is exactly what the ledger's "Off roster" group is for.
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
import { rollUpSalaries } from '../lib/salaries.mjs'

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

// teamId -> { playerId -> { pos, age } }. A pitcher comes back as "P";
// his own season line decides whether he reads as SP or RP, since a club ledger
// that lumps a closer in with the rotation is telling the reader the wrong
// thing about how the club spends. No line yet (a September call-up, an arm who
// has not appeared) leaves him "P" rather than guessing.
async function fetchPlaces(teamIds, season) {
  const byTeam = new Map()
  for (const teamId of teamIds) {
    const data = await getJson(
      `/api/v1/teams/${teamId}/roster?rosterType=40Man` +
        `&hydrate=person(stats(type=season,group=[pitching],season=${season}))`,
    )
    const map = new Map()
    for (const entry of data.roster ?? []) {
      const id = entry.person?.id
      if (id == null) continue
      map.set(id, { pos: resolvePosition(entry), age: entry.person?.currentAge ?? null })
    }
    byTeam.set(teamId, map)
  }
  return byTeam
}

function resolvePosition(entry) {
  const abbrev = entry.position?.abbreviation ?? null
  if (abbrev !== 'P') return abbrev
  const splits = entry.person?.stats?.[0]?.splits ?? []
  const stat = splits[0]?.stat ?? {}
  const games = Number(stat.gamesPlayed ?? stat.gamesPitched ?? 0)
  const started = Number(stat.gamesStarted ?? 0)
  if (!games) return 'P'
  return started * 2 >= games ? 'SP' : 'RP'
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
