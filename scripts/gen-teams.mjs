// Regenerates public/data/teams.json — every active club's identity metadata
// (name, abbreviation, league/division ids+names, MiLB parent org, home venue)
// at each searchable level. Team/org structure (realignment, expansion,
// affiliate shuffles) changes roughly once a decade, so this is pulled from
// statsapi weekly — the Monday block of .github/workflows/update-nightly-data.yml
// (its own update-teams.yml cron until 2026-08-28) — rather than fetched live on
// every LogoSheet level switch or team-directory search.
//
// `venue` needs no hydrate param — verified live against sportId 1 and 11
// (2026-08-07): every team in both responses already carries
// `venue: { id, name, link }` on the plain /teams call.
//
// One call per sportId to /api/v1/teams already returns everything BOTH
// fetchTeams() (src/api/schedule.js) and fetchTeam() (src/api/team.js) need,
// so this single file backs both — no per-team /teams/{id} calls at runtime.
//
// The sportId list below must stay in sync with SEARCHABLE_SPORT_IDS in
// src/lib/teams.js (inlined here rather than imported — that module lives in
// browser-facing src/, and a plain Node script pulling from it isn't worth
// the added coupling for one array literal). One of four copies of this exact
// value; scripts/check-searchable-sport-ids.mjs fails `npm run lint` if this
// one drifts from src/lib/teams.js's (issue #852).
// Run by hand: node scripts/gen-teams.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'

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
      venueId: t.venue?.id ?? null,
      venueName: t.venue?.name ?? null,
    }))
}

const bySportId = {}
for (const sportId of SEARCHABLE_SPORT_IDS) {
  bySportId[sportId] = await fetchLevel(sportId)
}

await writeJsonAtomic(out, { generatedAt: new Date().toISOString(), bySportId })
console.log(
  `wrote ${out} (${SEARCHABLE_SPORT_IDS.map((id) => `${id}:${bySportId[id].length}`).join(', ')})`,
)
