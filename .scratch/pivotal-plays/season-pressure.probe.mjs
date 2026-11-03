// Collects the leverage index of EVERY play of the 2026 season (regular season and postseason).
// One winProbability call per final game, 8 at a time. Takes about 10 minutes for 2,470 games.
//
//   node .scratch/pivotal-plays/season-pressure.probe.mjs <out season-li.json>
//
// Output rows: [gamePk, play index, inning, isTop (1/0), leverageIndex, postseason (1/0)].
// Result on 2026-11-03: 184,872 plays, 0 failed calls. Source: statsapi.mlb.com, checked that day.
import { writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'
const OUT = process.argv[2] // where to write season-li.json
const sched = await getJson('/api/v1/schedule?sportId=1&season=2026&gameType=R,F,D,L,W&startDate=2026-03-01&endDate=2026-11-01')
const games = sched.dates.flatMap((d) => d.games).filter((g) => g.status.codedGameState === 'F').map((g) => ({ pk: g.gamePk, date: g.officialDate, type: g.gameType }))
console.log('final games:', games.length)
const out = []
let done = 0, failed = 0
const queue = [...games]
async function worker() {
  while (queue.length) {
    const g = queue.shift()
    try {
      const w = await getJson(`/api/v1/game/${g.pk}/winProbability`)
      if (!Array.isArray(w)) { failed++; continue }
      for (let i = 0; i < w.length; i++) {
        const e = w[i]
        if (e.leverageIndex == null) continue
        out.push([g.pk, i, e.about.inning, e.about.isTopInning ? 1 : 0, Number(e.leverageIndex.toFixed(2)), g.type === 'R' ? 0 : 1])
      }
    } catch { failed++ }
    done++
    if (done % 250 === 0) console.log('done', done, 'plays', out.length)
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
writeFileSync(OUT, JSON.stringify({ games: games.length, failed, plays: out }))
console.log('FINISHED games', done, 'failed', failed, 'plays', out.length)
