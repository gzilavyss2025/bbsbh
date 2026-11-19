// Regenerates public/data/trade-pedigree/{orgId}.json: for every player an MLB
// organization holds (rosterType=fullRoster, every level), HOW he joined that
// organization and his draft pedigree. The trade card (/trade) reads one file
// per club it shows.
//
// Why a build-time file: the facts live in each player's transaction history,
// and hydrating that for one organization is ~1.6 MB (measured 2026-11-18 on
// the Brewers, 247 players). The answer per player is ~80 bytes.
//
// Verified 2026-11-18 against /people?personIds=...&hydrate=draft,transactions:
//   - `drafts[]` holds every draft a player was picked in: year, pickRound,
//     pickNumber (overall), roundPickNumber, team. Re-drafted players carry two.
//   - `transactions[]` typeCodes that bring a player INTO a club: TR (trade),
//     SFA (signed as free agent: international amateurs and minor-league FAs),
//     CLW (waiver claim), R5/R5M (Rule 5), PUR (purchase), SGN (signed; a
//     drafted player's signing, or a re-signing).
// A draft pick by this organization dates to July 1 of the draft year; the most
// recent event that brought him in from outside the organization wins.
//
// Nightly, in the structural data block of update-nightly-data.yml (~150
// requests). Run by hand: node scripts/trade/gen-trade-pedigree.mjs
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { writeJsonAtomic } from '../lib/io.js'
import { getJson } from '../lib/statsapi.mjs'
import { fetchSeasonInPlay } from '../lib/time/season-in-play.mjs'
import { acquisitionOf, draftOf, rule5Year } from '../../src/lib/trade/pedigree.js'

const here = import.meta.dirname
const outDir = join(here, '..', '..', 'public', 'data', 'trade-pedigree')
// Before Opening Day the calendar names a season with no rosters yet (#1465).
const season = await fetchSeasonInPlay()
const CHUNK = 60

const teams = (await getJson('/api/v1/teams?sportId=1&activeStatus=Y')).teams.filter((t) => t.active)
// Every club in each organization, complex leagues included, so a move to an
// affiliate counts as a move into the organization.
const aff = await getJson(`/api/v1/teams/affiliates?teamIds=${teams.map((t) => t.id).join(',')}&season=${season}`)
const orgOf = new Map(teams.map((t) => [t.id, t.id]))
for (const t of aff.teams ?? []) if (t.parentOrgId) orgOf.set(t.id, t.parentOrgId)

await mkdir(outDir, { recursive: true })
let total = 0
for (const team of teams) {
  const roster = (await getJson(`/api/v1/teams/${team.id}/roster?rosterType=fullRoster&season=${season}`)).roster ?? []
  const ids = roster.map((r) => r.person?.id).filter(Boolean)
  const players = {}
  for (let i = 0; i < ids.length; i += CHUNK) {
    const people = (await getJson(`/api/v1/people?personIds=${ids.slice(i, i + CHUNK).join(',')}&hydrate=draft,transactions`)).people ?? []
    for (const p of people) {
      players[p.id] = {
        how: acquisitionOf(p, team.id, { orgOf }),
        draft: draftOf(p),
        // The December he is first Rule 5 eligible off the 40-man (null when unknown).
        rule5: rule5Year(p),
      }
    }
  }
  // An empty roster (a season with no rosters posted) keeps last run's file.
  if (!ids.length) { console.log(`${team.abbreviation}: no roster, kept`); continue }
  total += Object.keys(players).length
  await writeJsonAtomic(join(outDir, `${team.id}.json`), { orgId: team.id, abbrev: team.abbreviation, season, players })
  console.log(`${team.abbreviation}: ${Object.keys(players).length} players`)
}
await writeJsonAtomic(join(outDir, 'index.json'), { generatedAt: new Date().toISOString(), season, orgs: teams.length, players: total })
console.log(`trade-pedigree: ${teams.length} orgs, ${total} players`)
