// The invariant the merge needs: the same club-day, grouped from a SEASON-long
// pull (what the nightly generator does) and from a five-day pull (what the
// club page's live overlay does), must produce identical stories.
import fs from 'node:fs'
import {
  bucketToOrg, dedupeTransactions, filterStoryworthy, groupIntoStories,
} from '../../src/api/teamTransactions.js'
import { feedWindow } from '../../src/api/transactions/leagueFeed.js'

const endDate = process.argv[2] ?? new Date().toISOString().slice(0, 10)
const w = feedWindow(endDate)
const affil = JSON.parse(fs.readFileSync('public/data/affiliates.json', 'utf8'))
const affilToOrg = new Map()
for (const [org, clubs] of Object.entries(affil.byOrgId ?? {})) {
  for (const c of clubs ?? []) if (c?.id != null) affilToOrg.set(c.id, Number(org))
}
const get = async (start, end) => (await (await fetch(
  `https://statsapi.mlb.com/api/v1/transactions?startDate=${start}&endDate=${end}`)).json()).transactions ?? []

const seasonRows = await get(`${endDate.slice(0, 4)}-03-01`, endDate)
const windowRows = await get(w.fetchStart, w.endDate)

const ids = [...new Set(seasonRows.map((t) => t.person?.id).filter((x) => x != null))]
const positions = {}; const debutedIds = new Set()
for (let i = 0; i < ids.length; i += 100) {
  const d = await (await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.slice(i, i + 100).join(',')}`)).json()
  for (const p of d.people ?? []) { positions[p.id] = p.primaryPosition?.abbreviation || ''; if (p.mlbDebutDate) debutedIds.add(p.id) }
}
const run = (rows, orgId) => groupIntoStories(
  filterStoryworthy(dedupeTransactions(bucketToOrg(rows, orgId, affilToOrg)), { orgId, debutedIds }),
  { positions, orgId, debutedIds },
)

const orgIds = Object.keys(affil.byOrgId ?? {}).map(Number)
let same = 0, diff = 0
for (const orgId of orgIds) {
  const season = run(seasonRows, orgId)
  const live = run(windowRows, orgId).filter((d) => d.date >= w.windowStart && d.date <= w.endDate)
  for (const day of live) {
    const ref = season.find((d) => d.date === day.date)
    if (!ref) { console.log(`live-only ${orgId} ${day.date}`); continue }
    if (JSON.stringify(ref.stories) === JSON.stringify(day.stories)) same += 1
    else {
      diff += 1
      console.log(`DIFF org ${orgId} ${day.date}`)
      console.log('  season:', ref.stories.map((s) => s.id).join(', '))
      console.log('  window:', day.stories.map((s) => s.id).join(', '))
    }
  }
}
console.log(`\nclub-days compared: ${same + diff} — identical ${same}, different ${diff}`)
