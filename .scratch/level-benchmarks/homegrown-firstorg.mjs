// Step 1 of the homegrown-dependence spike (docs/homegrown-dependence.md).
//
// Resolves the HOMEGROWN rule for every player in the 2005-2023 debut cohort:
//
//   player P is homegrown to org X iff X is the parent org of P's FIRST
//   professional minor-league season.
//
// Why this rule and not "drafted by": it handles international signees the same
// way it handles draftees. A quarter of the cohort has no draft record at all
// (docs/level-tenure-benchmark.md), so a draft-based definition would silently
// score every one of those players as belonging to nobody.
//
// The rule and the sweep behind it live in homegrown-lib.mjs, shared with the
// full-population pull -- including why the sweep covers all six MiLB sportIds
// under BOTH stat groups (entry level, and the position-conversion trap) and
// why sportId 17 is excluded.
//
// This script's own job is the two things that validate the rule:
//
//  1. COVERAGE -- how much of the cohort resolves, how the residue breaks down,
//     and whether any org ends up too thin to model.
//  2. THE DRAFT CROSS-CHECK -- the drafted subset's first-pro-org against the
//     club that actually drafted him, using src/api/person/identity.js's
//     draftInfo() rule. A high agreement rate is the evidence that "first pro
//     org" measures what "drafted by" measures, on the subset where both
//     exist, while also covering the quarter of the cohort where only one does.
//
// Writes homegrown-cohort.json (+ caches orgmap-ext.json, milb-cohort-cache.json,
// draft-cache.json).
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { mapConcurrent } from '../../scripts/lib/concurrency.mjs'
import {
  here,
  cached,
  buildOrgMap,
  sweepMilbSeasons,
  firstProOrg,
  draftInfo,
  COMMISSIONER_ORG_ID,
  LEVEL_NAME,
} from './homegrown-lib.mjs'

const ORGMAP_SEASON_MIN = 1997 // earliest plausible first-pro season for a 2005 debut
const ORGMAP_SEASON_MAX = 2023

const orgMap = await buildOrgMap({ seasonMin: ORGMAP_SEASON_MIN, seasonMax: ORGMAP_SEASON_MAX })
console.log(`org map loaded: ${orgMap.size} (team,season) entries`)

const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const cohortIds = Object.keys(raw.players).map(Number)
console.log(`cohort: ${cohortIds.length} players`)

const milbCache = await cached('milb-cohort-cache.json', async () => {
  console.log(`sweeping all six MiLB levels x both groups for ${cohortIds.length} players (6 calls each)...`)
  const out = {}
  let done = 0
  await mapConcurrent(cohortIds, 10, async (id) => {
    out[id] = await sweepMilbSeasons(id)
    if (++done % 250 === 0) console.log(`  ${done}/${cohortIds.length}`)
  })
  return out
})
console.log(`minor-league rows cached for ${Object.keys(milbCache).length} players`)

// --- resolve --------------------------------------------------------------
const resolved = {}
const unresolved = []
const entryLevelCounts = {}
let commissionerHits = 0
for (const id of cohortIds) {
  const p = raw.players[id]
  const got = firstProOrg(milbCache[id], (k) => orgMap.get(k))
  if (!got) {
    unresolved.push({ id, name: p.ped?.name ?? '', reason: milbCache[id]?.length ? 'no org for entry club' : 'no minor-league record' })
    continue
  }
  if (got.orgId === COMMISSIONER_ORG_ID) {
    commissionerHits++
    unresolved.push({ id, name: p.ped?.name ?? '', reason: 'Office of the Commissioner' })
    continue
  }
  resolved[id] = got
  entryLevelCounts[LEVEL_NAME[got.sportId]] = (entryLevelCounts[LEVEL_NAME[got.sportId]] || 0) + 1
}
const nResolved = Object.keys(resolved).length
console.log(`\nfirst-pro-org resolved: ${nResolved} of ${cohortIds.length} (${((nResolved / cohortIds.length) * 100).toFixed(1)}%)`)
console.log(`unresolved: ${unresolved.length}, of which ${commissionerHits} resolved to Office of the Commissioner and were dropped`)
console.log('entry level distribution:', JSON.stringify(entryLevelCounts))

const orgCounts = new Map()
for (const r of Object.values(resolved)) orgCounts.set(r.orgId, (orgCounts.get(r.orgId) || 0) + 1)
const orgNames = new Map(Object.values(resolved).map((r) => [r.orgId, r.orgName]))
const perOrg = [...orgCounts.entries()]
  .map(([orgId, n]) => ({ orgId, name: orgNames.get(orgId), n }))
  .sort((a, b) => b.n - a.n)
console.log(`distinct orgs: ${orgCounts.size}`)
console.log(`cohort players per org: ${perOrg[perOrg.length - 1].n} (${perOrg[perOrg.length - 1].name}) to ${perOrg[0].n} (${perOrg[0].name})`)

// --- draft cross-check ------------------------------------------------------
const draftCache = await cached('draft-cache.json', async () => {
  console.log('\npulling /people?hydrate=draft for the cohort...')
  const out = {}
  const chunks = []
  for (let i = 0; i < cohortIds.length; i += 100) chunks.push(cohortIds.slice(i, i + 100))
  for (const chunk of chunks) {
    const data = await getJson(`/api/v1/people?personIds=${chunk.join(',')}&hydrate=draft`)
    for (const p of data.people ?? []) {
      out[p.id] = {
        draftYear: p.draftYear ?? null,
        drafts: (p.drafts ?? []).map((d) => ({ year: d.year, pickRound: d.pickRound, teamId: d.team?.id ?? null, teamName: d.team?.name ?? '' })),
      }
    }
  }
  return out
})

let drafted = 0
let agree = 0
let drafts0Differs = 0
const disagreements = []
for (const [idStr, r] of Object.entries(resolved)) {
  const id = Number(idStr)
  const person = draftCache[id]
  if (!person) continue
  const di = draftInfo(person)
  if (!di?.teamId) continue
  drafted++
  if (di.teamId === r.orgId) agree++
  else {
    disagreements.push({
      id,
      name: raw.players[id].ped?.name ?? '',
      draftTeam: di.teamName,
      draftYear: di.year,
      draftRound: di.round,
      firstProOrg: r.orgName,
      firstProSeason: r.season,
      entryLevel: LEVEL_NAME[r.sportId],
      // a first pro season BEFORE the draft year means the draft record is a
      // re-draft of an already-professional player, not his signing draft
      preDraftEntry: Number(r.season) < Number(di.year),
    })
  }
  const d0 = person.drafts?.[0]
  if (d0 && String(d0.year) !== String(di.year)) drafts0Differs++
}
const preDraft = disagreements.filter((d) => d.preDraftEntry).length
console.log(`\ndraft cross-check: ${drafted} resolved cohort players have a signing draft`)
console.log(`  first-pro-org == drafting club: ${agree} (${((agree / drafted) * 100).toFixed(1)}%)`)
console.log(`  disagree: ${disagreements.length} (${((disagreements.length / drafted) * 100).toFixed(1)}%)`)
console.log(`    of which the first pro season PRECEDES the draft year (a re-draft of an`)
console.log(`    already-professional player, so statsapi's draft row is not his entry): ${preDraft}`)
console.log(`  players where drafts[0] is NOT the signing draft (raw.json's ped bug): ${drafts0Differs}`)
console.log('  sample disagreements:')
for (const d of disagreements.slice(0, 10)) {
  console.log(`    ${d.name}: drafted ${d.draftYear} rd ${d.draftRound} by ${d.draftTeam}; entered ${d.firstProSeason} at ${d.entryLevel} for ${d.firstProOrg}`)
}

await writeFile(
  join(here, 'homegrown-cohort.json'),
  JSON.stringify(
    {
      meta: { cohort: cohortIds.length, resolved: nResolved, unresolved: unresolved.length, commissionerHits, distinctOrgs: orgCounts.size, entryLevelCounts },
      perOrg,
      resolved,
      unresolved,
      draftCheck: { drafted, agree, agreePct: agree / drafted, disagree: disagreements.length, preDraftEntry: preDraft, drafts0Differs, disagreements },
    },
    null,
    2,
  ),
)
console.log('\nwrote homegrown-cohort.json')
