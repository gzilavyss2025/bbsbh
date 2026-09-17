// Regenerates public/data/teams.json — every active club's identity metadata
// (name, abbreviation, league/division ids+names, MiLB parent org, home venue)
// at each searchable level. Team/org structure (realignment, expansion,
// affiliate shuffles) changes roughly once a decade, so this is pulled from
// statsapi nightly — the structural data block of
// .github/workflows/update-nightly-data.yml (its own weekly update-teams.yml
// cron until 2026-08-28) — rather than fetched live on
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

// THE WINTER LEAGUES ARE IN THE SNAPSHOT BUT NOT IN THE SEARCH (issue #1055).
// They are two separate lists on purpose:
//
//   SEARCHABLE_SPORT_IDS is the set the team-name search and resolveGame scan.
//   It stays at five. A reader typing "Toros" is looking for a club they can
//   find on a rail tab that exists all year, and adding sportId 17 would make
//   every deep-link resolution scan four more leagues for eleven months of
//   nothing.
//
//   The winter leagues are still WRITTEN here, because the slate's club strip
//   reads this file (fetchTeams in src/api/schedule.js), and a live call for
//   them cannot be scoped the way the others can: a bare sportId=17 call
//   answers with all 46 clubs behind that door, four leagues Tally ships and
//   three it deliberately does not. Fetching per leagueId at BUILD time is how
//   that list stays exactly the 30 clubs we mean.
//
// This list must match WINTER_LEAGUES in src/lib/winter/leagues.js, which
// states the rule that decides what is in it: ship no league whose data would
// make the app state something false.
const WINTER_SPORT_ID = 17
const WINTER_LEAGUE_IDS = [119, 132, 135, 131]

async function fetchLevel(sportId, leagueId = null) {
  const league = leagueId ? `&leagueId=${leagueId}` : ''
  const url = `https://statsapi.mlb.com/api/v1/teams?sportId=${sportId}${league}&activeStatus=Y`
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

// One bucket for the four winter leagues, each club carrying its own leagueId
// (fetchLevel already records it), which is what lets the club strip scope
// itself to one league without a fetch.
const winter = []
for (const leagueId of WINTER_LEAGUE_IDS) {
  winter.push(...(await fetchLevel(WINTER_SPORT_ID, leagueId)))
}
bySportId[WINTER_SPORT_ID] = winter

const levels = [...SEARCHABLE_SPORT_IDS, WINTER_SPORT_ID]
await writeJsonAtomic(out, { generatedAt: new Date().toISOString(), bySportId })
console.log(`wrote ${out} (${levels.map((id) => `${id}:${bySportId[id].length}`).join(', ')})`)
