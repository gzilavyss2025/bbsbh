// Does the live club overlay reproduce the nightly file, story for story, on
// the days both of them cover?  If it does not, the merge in
// api/transactions/clubFeed.js is unsafe and the card would print two
// groupings of the same day.
//
// Run: node .scratch/club-live-overlay/probe-overlay.mjs
import fs from 'node:fs'
import {
  bucketToOrg, dedupeTransactions, filterStoryworthy, groupIntoStories,
} from '../../src/api/teamTransactions.js'
import { feedWindow } from '../../src/api/transactions/leagueFeed.js'
import { mergeLiveDays } from '../../src/api/transactions/clubFeed.js'

const endDate = process.argv[2] ?? new Date().toISOString().slice(0, 10)
const window = feedWindow(endDate)
const season = endDate.slice(0, 4)

const affil = JSON.parse(fs.readFileSync('public/data/affiliates.json', 'utf8'))
const affilToOrg = new Map()
for (const [orgId, clubs] of Object.entries(affil.byOrgId ?? {})) {
  for (const club of clubs ?? []) if (club?.id != null) affilToOrg.set(club.id, Number(orgId))
}

const rows = (await (await fetch(
  `https://statsapi.mlb.com/api/v1/transactions?startDate=${window.fetchStart}&endDate=${window.endDate}`,
)).json()).transactions ?? []

const ids = [...new Set(rows.map((t) => t.person?.id).filter((id) => id != null))]
const positions = {}
const debutedIds = new Set()
for (let i = 0; i < ids.length; i += 100) {
  const data = await (await fetch(
    `https://statsapi.mlb.com/api/v1/people?personIds=${ids.slice(i, i + 100).join(',')}`,
  )).json()
  for (const p of data.people ?? []) {
    positions[p.id] = p.primaryPosition?.abbreviation || ''
    if (p.mlbDebutDate) debutedIds.add(p.id)
  }
}

const dir = `public/data/team-transactions/${season}`
let compared = 0, sameDays = 0, mismatched = 0, liveOnly = 0, fileOnly = 0
for (const file of fs.readdirSync(dir)) {
  if (file === 'index.json') continue
  const orgId = Number(file.replace('.json', ''))
  const fileDays = JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8')).days ?? []

  const clubRows = dedupeTransactions(bucketToOrg(rows, orgId, affilToOrg))
  const kept = filterStoryworthy(clubRows, { orgId, debutedIds })
  const live = groupIntoStories(kept, { positions, orgId, debutedIds })
    .filter((d) => d.date >= window.windowStart && d.date <= window.endDate)

  for (const day of live) {
    const onFile = fileDays.find((d) => d.date === day.date)
    if (!onFile) { liveOnly += day.stories.length; continue }
    compared += 1
    const a = JSON.stringify(onFile.stories)
    const b = JSON.stringify(day.stories)
    if (a === b) sameDays += 1
    else {
      mismatched += 1
      console.log(`MISMATCH org ${orgId} ${day.date}`)
      console.log('  file:', onFile.stories.map((s) => s.id).join(', '))
      console.log('  live:', day.stories.map((s) => s.id).join(', '))
    }
  }
  for (const day of fileDays) {
    if (day.date < window.windowStart || day.date > window.endDate) continue
    if (!live.some((d) => d.date === day.date)) fileOnly += day.stories.length
  }

  // The merge itself must never tell one day twice.
  const merged = mergeLiveDays(fileDays, live, window.windowStart)
  const seen = new Set()
  for (const day of merged) {
    if (seen.has(day.date)) throw new Error(`merge told ${orgId} ${day.date} twice`)
    seen.add(day.date)
  }
  const desc = merged.every((d, i) => i === 0 || merged[i - 1].date > d.date)
  if (!desc) throw new Error(`merge left ${orgId} out of order`)
}

console.log(`\nwindow ${window.windowStart}..${window.endDate} (fetch from ${window.fetchStart})`)
console.log(`club-days both sources hold: ${compared} — identical ${sameDays}, mismatched ${mismatched}`)
console.log(`stories only live (the freshness win): ${liveOnly}`)
console.log(`stories only on file (kept by the merge): ${fileOnly}`)
