// Organization-season exit-reason mix vs the team-success outcome ladder.
// Joins docs/price-the-blockage.md's per-stay exit classification
// (.scratch/blockage/exits.json) to team-season identity by parsing the
// ACTING team out of each transaction's own free-text description (the
// team named as subject of "recalled"/"selected"/"optioned"/etc, which is
// by construction the parent club whose Triple-A affiliate the prospect
// played for) — no new statsapi pull, this is text already fetched and
// cached by the blockage spike's own txn-season pull.
//
// IMPORTANT: naive substring match on a team nickname is wrong — an
// affiliate's OWN name can contain another club's nickname (e.g.
// "Pittsburgh Pirates recalled ... from Indianapolis INDIANS" falsely
// matches Cleveland). Only the text before the verb is the acting team.
import { readFileSync, writeFileSync } from 'node:fs'

const exits = JSON.parse(readFileSync('.scratch/blockage/exits.json', 'utf8'))

const VERBS = [
  'recalled', 'selected the contract of', 'selected',
  'purchased the contract of', 'purchased contract of', 'purchased',
  'claimed', 'optioned', 'outrighted', 'designated', 'traded',
  'assigned', 'released', 'activated',
]

function actingTeamPrefix(desc) {
  if (!desc) return null
  let bestIdx = -1
  for (const v of VERBS) {
    const idx = desc.indexOf(' ' + v + ' ')
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx
  }
  if (bestIdx === -1) return null
  return desc.slice(0, bestIdx)
}

// Full official name -> current-id, valid across 2009-2023 (the only two
// renames in-window: Cleveland 2022+, Miami since 2012 — no Florida Marlins
// stays present in this cohort at all, checked).
const NAME_TO_ID = {
  'Arizona Diamondbacks': 109, 'Atlanta Braves': 144, 'Baltimore Orioles': 110,
  'Boston Red Sox': 111, 'Chicago Cubs': 112, 'Chicago White Sox': 145,
  'Cincinnati Reds': 113, 'Cleveland Guardians': 114, 'Cleveland Indians': 114,
  'Colorado Rockies': 115, 'Detroit Tigers': 116, 'Houston Astros': 117,
  'Kansas City Royals': 118, 'Los Angeles Angels': 108, 'Los Angeles Dodgers': 119,
  'Miami Marlins': 146, 'Florida Marlins': 146, 'Milwaukee Brewers': 158,
  'Minnesota Twins': 142, 'New York Mets': 121, 'New York Yankees': 147,
  'Oakland Athletics': 133, 'Philadelphia Phillies': 143, 'Pittsburgh Pirates': 134,
  'San Diego Padres': 135, 'San Francisco Giants': 137, 'Seattle Mariners': 136,
  'St. Louis Cardinals': 138, 'Tampa Bay Rays': 139, 'Tampa Bay Devil Rays': 139,
  'Texas Rangers': 140, 'Toronto Blue Jays': 141, 'Washington Nationals': 120,
}

const CORE_REASONS = new Set(['merit', 'rosterRule', 'injury', 'traded'])

const rows = []
let unmatched = 0
let notCore = 0
for (const [key, rec] of Object.entries(exits)) {
  const [playerId, seasonStr, endDate] = key.split(':')
  const season = Number(seasonStr)
  const prefix = actingTeamPrefix(rec.prospectEventDesc)
  const teamId = prefix ? NAME_TO_ID[prefix] : null
  if (!teamId) { unmatched += 1; continue }
  if (!CORE_REASONS.has(rec.exitReason)) { notCore += 1; continue }
  rows.push({ playerId, season, endDate, teamId, teamName: prefix, exitReason: rec.exitReason })
}

console.log(`${Object.keys(exits).length} stays total`)
console.log(`${unmatched} could not be matched to an acting team (expect 16, the "unresolved" no-transaction stays)`)
console.log(`${notCore} matched a team but are not one of the four core reasons (demoted/settledEarlier)`)
console.log(`${rows.length} rows carry a team + core exit reason`)

// Org-season aggregation
const bySeasonOrg = new Map()
for (const r of rows) {
  const k = `${r.season}:${r.teamId}`
  if (!bySeasonOrg.has(k)) bySeasonOrg.set(k, { season: r.season, teamId: r.teamId, merit: 0, rosterRule: 0, injury: 0, traded: 0 })
  bySeasonOrg.get(k)[r.exitReason] += 1
}
const orgSeasons = [...bySeasonOrg.values()].map((o) => {
  const other = o.rosterRule + o.injury + o.traded
  const total = o.merit + other
  return { ...o, other, total, meritShare: total > 0 ? o.merit / total : null }
})

console.log(`\n${orgSeasons.length} distinct organization-seasons carry at least one classified exit`)
const counts = orgSeasons.map((o) => o.total)
counts.sort((a, b) => a - b)
console.log('total-exits-per-org-season distribution:', {
  min: counts[0], median: counts[Math.floor(counts.length / 2)], max: counts[counts.length - 1],
  mean: (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(2),
})
const n1 = orgSeasons.filter((o) => o.total === 1).length
const n2 = orgSeasons.filter((o) => o.total === 2).length
const n3p = orgSeasons.filter((o) => o.total >= 3).length
console.log(`org-seasons with exactly 1 exit: ${n1}, exactly 2: ${n2}, 3+: ${n3p}`)

// Organization-level aggregation (pooled across all seasons 2009-2023),
// the sturdier grain given how thin org-season cells are.
const byOrg = new Map()
for (const r of rows) {
  if (!byOrg.has(r.teamId)) byOrg.set(r.teamId, { teamId: r.teamId, merit: 0, rosterRule: 0, injury: 0, traded: 0, teamName: r.teamName.replace(/^Cleveland Indians$/, 'Cleveland Guardians') })
  byOrg.get(r.teamId)[r.exitReason] += 1
}
const orgs = [...byOrg.values()].map((o) => {
  const other = o.rosterRule + o.injury + o.traded
  const total = o.merit + other
  return { ...o, other, total, meritShare: total > 0 ? o.merit / total : null }
})
console.log(`\n${orgs.length} distinct organizations`)

writeFileSync('.scratch/team-success/exit-reason-mix.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'blockage exits.json, acting-team parsed from transaction description text; no new statsapi pull',
  rows, orgSeasons, orgs,
}, null, 2))
console.log('\nWrote .scratch/team-success/exit-reason-mix.json')
