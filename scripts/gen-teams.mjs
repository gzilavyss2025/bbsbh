// Regenerates public/data/teams.json — every active club's identity metadata
// (name, abbreviation, league/division ids+names, MiLB parent org) at each
// searchable level. Team/org structure (realignment, expansion, affiliate
// shuffles) changes roughly once a decade, so this is pulled from statsapi
// weekly (.github/workflows/update-teams.yml) rather than fetched live on
// every LogoSheet level switch or team-directory search.
//
// One call per sportId to /api/v1/teams already returns everything BOTH
// fetchTeams() (src/api/schedule.js) and fetchTeam() (src/api/team.js) need,
// so this single file backs both — no per-team /teams/{id} calls at runtime.
//
// The sportId list below must stay in sync with SEARCHABLE_SPORT_IDS in
// src/lib/teams.js (inlined here rather than imported — that module lives in
// browser-facing src/, and a plain Node script pulling from it isn't worth
// the added coupling for one array literal).
// Run by hand: node scripts/gen-teams.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'teams.json')

const SEARCHABLE_SPORT_IDS = [1, 11, 12, 13, 14]

async function fetchLevel(sportId) {
  const url = `https://statsapi.mlb.com/api/v1/teams?sportId=${sportId}&activeStatus=Y`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`teams sportId=${sportId}: HTTP ${res.status}`)
  const json = await res.json()
  return (json.teams ?? [])
    .filter((t) => t.active)
    .map((t) => ({
      id: t.id,
      name: t.name,
      teamName: t.teamName,
      abbreviation: t.abbreviation,
      leagueId: t.league?.id ?? null,
      leagueName: t.league?.name ?? null,
      divisionId: t.division?.id ?? null,
      divisionName: t.division?.name ?? null,
      parentOrgId: t.parentOrgId ?? null,
      parentOrgName: t.parentOrgName ?? null,
    }))
}

const bySportId = {}
for (const sportId of SEARCHABLE_SPORT_IDS) {
  bySportId[sportId] = await fetchLevel(sportId)
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), bySportId }))
console.log(
  `wrote ${out} (${SEARCHABLE_SPORT_IDS.map((id) => `${id}:${bySportId[id].length}`).join(', ')})`,
)
