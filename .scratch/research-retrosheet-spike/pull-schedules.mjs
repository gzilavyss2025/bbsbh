// #2234 Retrosheet spike, step 1: one statsapi schedule per season, with the
// linescore, saved OUTSIDE the repo so the join runs offline and re-runs read the
// same bytes. Usage: node pull-schedules.mjs <outDir> [firstYear] [lastYear]
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const [outDir, first = '1901', last = '2025'] = process.argv.slice(2)
if (!outDir) throw new Error('usage: node pull-schedules.mjs <outDir> [firstYear] [lastYear]')
mkdirSync(outDir, { recursive: true })
for (let y = +first; y <= +last; y++) {
  const file = `${outDir}/${y}.json`
  if (existsSync(file)) continue
  // No gameType filter: the join step reports which game types matched.
  const s = await getJson(`/api/v1/schedule?sportId=1&season=${y}&startDate=${y}-01-01&endDate=${y}-12-31&hydrate=linescore`)
  const games = s.dates.flatMap(d => d.games.map(g => ({
    gamePk: g.gamePk, date: d.date, officialDate: g.officialDate, gameType: g.gameType,
    state: g.status.detailedState, home: g.teams.home.team.id, away: g.teams.away.team.id,
    homeName: g.teams.home.team.name, awayName: g.teams.away.team.name,
    doubleHeader: g.doubleHeader, gameNumber: g.gameNumber,
    resumeDate: g.resumeDate ?? null, rescheduleDate: g.rescheduleDate ?? null,
    homeRuns: g.linescore?.teams?.home?.runs ?? null, awayRuns: g.linescore?.teams?.away?.runs ?? null,
  })))
  writeFileSync(file, JSON.stringify(games))
  console.log(y, games.length)
}
