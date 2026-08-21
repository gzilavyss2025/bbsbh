import fs from 'node:fs'
import {
  bucketToOrg, dedupeTransactions, filterStoryworthy, groupIntoStories,
} from '../../src/api/teamTransactions.js'
import { feedWindow } from '../../src/api/transactions/leagueFeed.js'

const orgId = Number(process.argv[2])
const date = process.argv[3]
const endDate = process.argv[4] ?? new Date().toISOString().slice(0, 10)
const w = feedWindow(endDate)
const affil = JSON.parse(fs.readFileSync('public/data/affiliates.json', 'utf8'))
const affilToOrg = new Map()
for (const [org, clubs] of Object.entries(affil.byOrgId ?? {})) {
  for (const c of clubs ?? []) if (c?.id != null) affilToOrg.set(c.id, Number(org))
}
const rows = (await (await fetch(
  `https://statsapi.mlb.com/api/v1/transactions?startDate=${w.fetchStart}&endDate=${w.endDate}`)).json()).transactions ?? []
const ids = [...new Set(rows.map((t) => t.person?.id).filter((x) => x != null))]
const positions = {}; const debutedIds = new Set()
for (let i = 0; i < ids.length; i += 100) {
  const d = await (await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.slice(i, i + 100).join(',')}`)).json()
  for (const p of d.people ?? []) { positions[p.id] = p.primaryPosition?.abbreviation || ''; if (p.mlbDebutDate) debutedIds.add(p.id) }
}
const clubRows = dedupeTransactions(bucketToOrg(rows, orgId, affilToOrg))
console.log('--- raw club rows on', date, '---')
for (const t of clubRows) {
  if ((t.effectiveDate || t.date) !== date) continue
  console.log(t.id, t.typeCode, '|', t.description)
}
const live = groupIntoStories(filterStoryworthy(clubRows, { orgId, debutedIds }), { positions, orgId, debutedIds })
  .find((d) => d.date === date)
const file = (JSON.parse(fs.readFileSync(`public/data/team-transactions/${endDate.slice(0,4)}/${orgId}.json`, 'utf8')).days ?? [])
  .find((d) => d.date === date)
console.log('\n--- FILE ---'); console.log(JSON.stringify(file?.stories, null, 1))
console.log('\n--- LIVE ---'); console.log(JSON.stringify(live?.stories, null, 1))
