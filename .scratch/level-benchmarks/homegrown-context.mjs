// Step 2 of the homegrown-dependence spike: the org-season CONTEXT panel that
// every later model needs as a control, and that the cheap pre-check needs as
// the thing to test collinearity against.
//
// Two series, 30 orgs x 2004-2023:
//
//  - WIN PERCENTAGE, from /api/v1/standings. For a COMPLETED season the `date`
//    param must be OMITTED -- passing date=Dec31 returns empty records
//    (docs/team-movement-windows.md carries this trap; it cost a prior pass
//    real time).
//  - HOME ATTENDANCE AVERAGE, from /api/v1/attendance, as a MARKET-SIZE PROXY.
//    It is a proxy under protest: payroll is the confound this spike actually
//    wants controlled, and payroll is NOT available historically anywhere in
//    this repo -- public/data/salaries.json and public/data/team-contracts/ are
//    current-season-only forward-looking snapshots, and public/data/
//    attendance.json is 2026-only. Attendance is downstream of winning as well
//    as of market size, which is exactly the wrong property for a control; the
//    write-up says so rather than pretending the confound is handled.
//
// 2020 is kept, with its 60-game season. Win percentage is a ratio and survives
// the short season; every playing-time SHARE built later is a ratio too. What
// does not survive is anything counted in absolute games, so nothing here is.
//
// Writes context-panel.json.
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { mapConcurrent } from '../../scripts/lib/concurrency.mjs'
import { here, cached } from './homegrown-lib.mjs'

const SEASON_MIN = 2004
const SEASON_MAX = 2023
const seasons = Array.from({ length: SEASON_MAX - SEASON_MIN + 1 }, (_, i) => SEASON_MIN + i)

const standings = await cached('standings-cache.json', async () => {
  console.log(`pulling standings for ${seasons.length} seasons...`)
  const out = {}
  for (const season of seasons) {
    // no `date` param: a completed season returns empty records if one is passed
    const data = await getJson(`/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`)
    for (const rec of data.records ?? []) {
      for (const tr of rec.teamRecords ?? []) {
        if (!tr.team?.id) continue
        out[`${tr.team.id}:${season}`] = { wins: tr.wins, losses: tr.losses, winPct: Number(tr.winningPercentage) }
      }
    }
  }
  return out
})
const standingsRows = Object.keys(standings).length
console.log(`standings: ${standingsRows} (team,season) rows`)

const orgIds = [...new Set(Object.keys(standings).map((k) => Number(k.split(':')[0])))].sort((a, b) => a - b)
console.log(`distinct MLB clubs across the span: ${orgIds.length}`)

const attendance = await cached('attendance-cache.json', async () => {
  const jobs = []
  for (const orgId of orgIds) for (const season of seasons) jobs.push({ orgId, season })
  console.log(`pulling attendance (${jobs.length} calls)...`)
  const out = {}
  await mapConcurrent(jobs, 8, async ({ orgId, season }) => {
    try {
      const data = await getJson(`/api/v1/attendance?teamId=${orgId}&season=${season}`)
      const rec = data.records?.[0]
      if (!rec) return
      out[`${orgId}:${season}`] = {
        avgHome: rec.attendanceAverageHome ?? null,
        homeOpenings: rec.openingsTotalHome ?? null,
      }
    } catch {
      // a club that did not exist that season, or a thin record
    }
  })
  return out
})
console.log(`attendance: ${Object.keys(attendance).length} (team,season) rows`)

// coverage report -- which cells are missing, said out loud rather than
// discovered later as a silent hole in a regression
const missingStandings = []
const missingAttendance = []
for (const orgId of orgIds) {
  for (const season of seasons) {
    if (!standings[`${orgId}:${season}`]) missingStandings.push(`${orgId}:${season}`)
    if (!attendance[`${orgId}:${season}`]?.avgHome) missingAttendance.push(`${orgId}:${season}`)
  }
}
console.log(`missing standings cells: ${missingStandings.length}`)
console.log(`missing attendance cells: ${missingAttendance.length}${missingAttendance.length ? ' -> ' + missingAttendance.slice(0, 10).join(', ') : ''}`)

await writeFile(
  join(here, 'context-panel.json'),
  JSON.stringify({ meta: { seasonMin: SEASON_MIN, seasonMax: SEASON_MAX, orgs: orgIds.length, missingStandings, missingAttendance }, orgIds, seasons, standings, attendance }, null, 2),
)
console.log('wrote context-panel.json')
