// Regenerates public/data/affiliates.json — every MLB org's full farm system
// (AAA/AA/A+/A affiliates), keyed by parent org id. Pulled from statsapi's
// /teams/affiliates endpoint, which accepts a comma-separated teamIds list and
// returns the merged affiliate trees for all of them in ONE request (verified
// 2026-07-08: teamIds=112,110 returned both orgs' full trees, each affiliate
// row carrying its own parentOrgId — same field present in the single-org
// case fetchAffiliates() already used, still there in this bulk-request
// context).
//
// An org's farm system changes at most once a year (the PDC realignment,
// each offseason) and essentially never mid-season, so this runs weekly
// (.github/workflows/update-affiliates.yml) rather than fetched live on every
// team-page visit AND every prospect resolved on the Prospects page (the
// latter used to fan out one live request per distinct org — up to ~30 on a
// single page load). src/api/team.js reads this file first and only falls
// back to the live per-org call when the file is missing, stale for the
// requested season, or doesn't cover the org.
// Run by hand: node scripts/gen-affiliates.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'affiliates.json')
const season = new Date().getFullYear()

// Same four full-season farm levels fetchAffiliates() (src/api/team.js)
// filters to — the endpoint also returns complex-league/DSL/alternate-site/
// "Prospects" entries that aren't proper affiliate clubs the rest of the app
// tracks.
const AFFILIATE_SPORT_IDS = [11, 12, 13, 14]

async function fetchOrgIds() {
  const url = `https://statsapi.mlb.com/api/v1/teams?sportId=1&activeStatus=Y`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`teams sportId=1: HTTP ${res.status}`)
  const json = await res.json()
  return (json.teams ?? []).filter((t) => t.active === true).map((t) => t.id)
}

async function fetchAffiliateRows(orgIds) {
  const url =
    `https://statsapi.mlb.com/api/v1/teams/affiliates` +
    `?teamIds=${orgIds.join(',')}&season=${season}&hydrate=venue(location)`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`teams/affiliates: HTTP ${res.status}`)
  const json = await res.json()
  return json.teams ?? []
}

const orgIds = await fetchOrgIds()
const rows = await fetchAffiliateRows(orgIds)

// Group by parentOrgId, keeping only the four full-season farm levels, shaped
// exactly like fetchAffiliates()'s existing return value, sorted AAA→AA→A+→A.
const byOrgId = {}
for (const t of rows) {
  const orgId = t.parentOrgId
  if (!orgId || !AFFILIATE_SPORT_IDS.includes(t.sport?.id)) continue
  const list = (byOrgId[orgId] ??= [])
  list.push({
    id: t.id,
    name: t.name,
    sportId: t.sport?.id,
    city: t.venue?.location?.city || t.locationName || '',
    state: t.venue?.location?.stateAbbrev || t.venue?.location?.state || '',
  })
}
for (const list of Object.values(byOrgId)) {
  list.sort((a, b) => AFFILIATE_SPORT_IDS.indexOf(a.sportId) - AFFILIATE_SPORT_IDS.indexOf(b.sportId))
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), season, byOrgId }))
console.log(`wrote ${out} (${Object.keys(byOrgId).length} orgs)`)
