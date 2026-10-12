// Builds test/fixtures/overlay-alignment-2026.json for
// test/overlay-alignment.test.js (#1859): every home run and every caught fly
// ball or line drive with a landing coordinate, from three June 2026 home games
// at each of eight parks. Rows are [gamePk, venueId, officialDate, coordX,
// coordY]: only what the overlay test reads.
//
// Run by hand from the repo root: node .scratch/overlay-alignment/build.mjs
// Reads the Stats API through the shared client, like every script here.
import { writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const VENUES = [3, 19, 3313, 2681, 32, 2392, 680, 4169] // Fenway, Coors, Yankee, CBP, AmFam, Daikin, T-Mobile, loanDepot
const FIELDS = 'gameData,venue,id,datetime,officialDate,liveData,plays,allPlays,result,eventType,playEvents,hitData,coordinates,coordX,coordY,trajectory'

const json = (path) => getJson(path)
const out = { built: new Date().toISOString().slice(0, 10), hr: [], out: [] }
for (const venueId of VENUES) {
  const sched = await json(`/api/v1/schedule?sportId=1&venueIds=${venueId}&startDate=2026-06-01&endDate=2026-06-20&gameType=R`)
  const games = sched.dates.flatMap((d) => d.games).filter((g) => g.status.abstractGameState === 'Final').slice(0, 3)
  for (const g of games) {
    const feed = await json(`/api/v1.1/game/${g.gamePk}/feed/live?fields=${FIELDS}`)
    const v = feed.gameData.venue.id
    const date = feed.gameData.datetime.officialDate
    for (const p of feed.liveData.plays.allPlays) {
      const h = [...(p.playEvents ?? [])].reverse().find((e) => e.hitData?.coordinates?.coordX != null)?.hitData
      if (!h) continue
      const row = [g.gamePk, v, date, h.coordinates.coordX, h.coordinates.coordY]
      if (p.result.eventType === 'home_run') out.hr.push(row)
      else if (p.result.eventType === 'field_out' && ['fly_ball', 'line_drive'].includes(h.trajectory)) out.out.push(row)
    }
  }
}
out.hr.sort((a, b) => a[0] - b[0] || a[3] - b[3])
out.out.sort((a, b) => a[0] - b[0] || a[3] - b[3])
writeFileSync(new URL('../../test/fixtures/overlay-alignment-2026.json', import.meta.url),
  JSON.stringify(out).replace(/\],\[/g, '],\n[') + '\n')
console.log(`${out.hr.length} home runs, ${out.out.length} caught balls`)
