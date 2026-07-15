// Regenerates public/data/team-transactions/{season}.json — the Team
// Transactions card's per-org, day-grouped, fully-shaped story feed. Runs
// nightly (update-nightly-data.yml) but only ever rebuilds the CURRENT
// season's file from scratch; a completed season's file, once written with
// final:true, is never touched again (the guard below refuses to overwrite
// one without --force).
//
// ONE league-wide /api/v1/transactions fetch per run (like gen-rehab.mjs),
// season-start-to-today — verified live that teamId= is club-scoped and
// silently misses affiliate-only rows, so this buckets to each org itself
// (bucketToOrg, src/api/teamTransactions.js) rather than looping a per-team
// query. The de-dupe/noise-filter/story-grouping/cutline logic lives in that
// same module as pure, exported shapers this script imports — the
// gen-callouts.mjs "import the app's own shaper so the two can't drift"
// convention — so this file is just the fetch + per-org loop + write.
// Full design: .scratch/team-transactions/data-layer-scope.md.
//
// Run by hand: node scripts/gen-team-transactions.mjs [season] [--force]
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../src/api/statsapi.js'
import { dedupeTransactions, filterStoryworthy, groupIntoStories, bucketToOrg } from '../src/api/teamTransactions.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'team-transactions')

const isoToday = () => new Date().toISOString().slice(0, 10)

async function fetchMlbTeamIds() {
  const data = await getJson('/api/v1/teams?sportId=1')
  return (data.teams ?? []).map((t) => t.id)
}

// Affiliate teamId -> parent org id, for every MLB org's full farm system, in
// ONE bulk request (same endpoint/shape gen-affiliates.mjs already relies on;
// verified live: each affiliate row carries its own parentOrgId). Lets a
// call-up/option row logged only against the affiliate (fromTeam/toTeam is
// the Triple-A club, not the MLB club) still bucket to the right org.
async function fetchAffiliateParentMap(orgIds, season) {
  const data = await getJson(`/api/v1/teams/affiliates?teamIds=${orgIds.join(',')}&season=${season}`)
  const map = new Map()
  for (const t of data.teams ?? []) {
    if (t.id != null && t.parentOrgId != null) map.set(t.id, t.parentOrgId)
  }
  return map
}

// Batched position fallback for players whose position can't be parsed out of
// their own transaction description (see teamTransactions.js's
// extractPosFromDescription) — cheap, and avoids a per-player fetch.
async function fetchPositions(personIds) {
  const list = [...new Set(personIds.filter(Boolean))]
  const out = {}
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100)
    if (!batch.length) continue
    const data = await getJson(`/api/v1/people?personIds=${batch.join(',')}`)
    for (const p of data.people ?? []) out[p.id] = p.primaryPosition?.abbreviation || ''
  }
  return out
}

const arg = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const force = process.argv.includes('--force')
const season = arg ? Number(arg) : new Date().getUTCFullYear()

const outFile = join(outDir, `${season}.json`)

// A completed season's file is frozen once written — refuse to silently
// re-run over it (see the `final` note in data-layer-scope.md §1).
let existing = null
try {
  existing = JSON.parse(await readFile(outFile, 'utf8'))
} catch {
  existing = null
}
if (existing?.final && !force) {
  console.log(`${outFile} is already final — skipping (pass --force to override)`)
  process.exit(0)
}

const seasonMeta = (await getJson(`/api/v1/seasons/${season}?sportId=1`)).seasons?.[0] ?? {}
const seasonStart = seasonMeta.regularSeasonStartDate
const final = Boolean(seasonMeta.seasonEndDate) && isoToday() > seasonMeta.seasonEndDate

const orgIds = await fetchMlbTeamIds()
const affilToOrg = await fetchAffiliateParentMap(orgIds, season)

const raw = (
  await getJson(`/api/v1/transactions?startDate=${seasonStart}&endDate=${isoToday()}`)
).transactions ?? []

const positions = await fetchPositions(raw.map((t) => t.person?.id))

const byTeamId = {}
for (const orgId of orgIds) {
  const bucketed = bucketToOrg(raw, orgId, affilToOrg)
  const deduped = dedupeTransactions(bucketed)
  const kept = filterStoryworthy(deduped, { orgId })
  const days = groupIntoStories(kept, { positions, orgId })
  if (days.length) byTeamId[orgId] = { days }
}

const out = {
  version: 1,
  season,
  generatedAt: new Date().toISOString(),
  seasonStart,
  final,
  byTeamId,
}

await mkdir(outDir, { recursive: true })
await writeFile(outFile, JSON.stringify(out))
console.log(`wrote ${outFile} (${Object.keys(byTeamId).length} orgs, final=${final})`)
