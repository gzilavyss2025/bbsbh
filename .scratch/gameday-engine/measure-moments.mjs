// Measures the league distributions the Gameday moments engine's thresholds
// come from (#2608; the "Worthiness" rule in docs/callouts.md: set each
// threshold from the league distribution, not from a guess).
//
//   node .scratch/gameday-engine/measure-moments.mjs [dates…]
//
// For every Final regular-season MLB game on the sampled dates it reads the live
// feed and the winProbability endpoint, and prints percentiles of:
//   - exit velocity (hitData.launchSpeed) over every tracked batted ball;
//   - distance (hitData.totalDistance) over every tracked batted ball;
//   - pitch speed (pitchData.startSpeed) over every tracked pitch;
//   - the win-odds swing per play: |home win % after the play − before it|.
import { getJson } from '../../scripts/lib/statsapi.mjs'

const DATES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['2026-04-11', '2026-04-29', '2026-05-16', '2026-06-03', '2026-06-20', '2026-07-12', '2026-08-08', '2026-08-26', '2026-09-12']

const ev = [], dist = [], velo = [], swing = []
let games = 0
for (const date of DATES) {
  const sched = await getJson(`/api/v1/schedule?sportId=1&gameType=R&date=${date}`)
  for (const g of sched.dates?.[0]?.games ?? []) {
    if (g.status?.abstractGameState !== 'Final') continue
    const feed = await getJson(`/api/v1.1/game/${g.gamePk}/feed/live`)
    for (const p of feed.liveData?.plays?.allPlays ?? []) {
      for (const e of p.playEvents ?? []) {
        if (typeof e.pitchData?.startSpeed === 'number') velo.push(e.pitchData.startSpeed)
        if (typeof e.hitData?.launchSpeed === 'number') ev.push(e.hitData.launchSpeed)
        if (typeof e.hitData?.totalDistance === 'number') dist.push(e.hitData.totalDistance)
      }
    }
    const wp = await getJson(`/api/v1/game/${g.gamePk}/winProbability`).catch(() => null)
    let prev = 50
    for (const e of Array.isArray(wp) ? wp : []) {
      if (typeof e.homeTeamWinProbability !== 'number') continue
      swing.push(Math.abs(e.homeTeamWinProbability - prev))
      prev = e.homeTeamWinProbability
    }
    games += 1
  }
}
const pct = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}
const row = (name, xs) =>
  console.log(name.padEnd(10), 'n', String(xs.length).padStart(6), ...[0.5, 0.9, 0.95, 0.99, 0.995, 0.999].map((q) => `p${q * 100}=${pct(xs, q).toFixed(1)}`))
console.log(`${games} Final MLB games on ${DATES.join(', ')}`)
row('exitVelo', ev)
row('distance', dist)
row('pitchVelo', velo)
row('wpSwing', swing)
