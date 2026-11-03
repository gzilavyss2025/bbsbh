// Probe for .scratch/pivotal-plays/spec.md. Samples final regular-season games (every third final
// in a two-week window) and measures how often the existing "Biggest swings" ledger is thin, how
// often a game has a turning point, and how often the top-leverage play is also a top swing.
//
//   node .scratch/pivotal-plays/sample.probe.mjs
//
// Result on 2026-11-03: 62 games, 2026-09-01 to 2026-09-14. See spec.md, "Measured gap".
import { getJson } from '../../scripts/lib/statsapi.mjs'
const s = await getJson('/api/v1/schedule?sportId=1&season=2026&gameType=R&startDate=2026-09-01&endDate=2026-09-14')
const games = s.dates.flatMap((d) => d.games).filter((g) => g.status.codedGameState === 'F').map((g) => g.gamePk)
const pick = games.filter((_, i) => i % 3 === 0).slice(0, 80)
console.log('final games in window:', games.length, '| sampled:', pick.length)
let n = 0, rowsHist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, wire = 0, topLiInTop4Wpa = 0, noLi = 0, tpEarly = 0, tpLate = 0, samePotgTp = 0
const maxLis = [], tpInnings = []
for (const pk of pick) {
  let w
  try { w = await getJson(`/api/v1/game/${pk}/winProbability`) } catch { continue }
  if (!Array.isArray(w) || w.length < 10) continue
  n++
  const wpa = w.map((e) => Math.abs(e.homeTeamWinProbabilityAdded ?? 0))
  const rows = wpa.filter((v) => v >= 8).length
  rowsHist[Math.min(rows, 4)]++
  const li = w.map((e) => e.leverageIndex ?? null)
  if (li.filter((x) => x == null).length > 1) noLi++
  const liMax = Math.max(...li.map((x) => x ?? 0)); maxLis.push(liMax)
  const topLiIdx = li.indexOf(liMax)
  const top4 = [...wpa.keys()].sort((a, b) => wpa[b] - wpa[a]).slice(0, 4)
  if (top4.includes(topLiIdx)) topLiInTop4Wpa++
  const last = w.at(-1).result, homeWon = last.homeScore > last.awayScore
  const win = w.map((e) => (homeWon ? e.homeTeamWinProbability : 100 - e.homeTeamWinProbability))
  let tp = -1
  for (let k = 0; k < win.length; k++) if (win[k] <= 50) tp = k
  const tpIdx = tp + 1
  if (tpIdx <= 1) wire++
  else { tpInnings.push(w[tpIdx].about.inning); if (w[tpIdx].about.inning >= 7) tpLate++; else tpEarly++ }
}
const pc = (x) => `${Math.round((x / n) * 100)}%`
console.log(`games analysed: ${n}`)
console.log('plays with |WPA| >= 8 (ledger rows, capped at 4):', JSON.stringify(rowsHist), `-> fewer than 3 rows in ${pc(rowsHist[0] + rowsHist[1] + rowsHist[2])}, none in ${pc(rowsHist[0])}`)
console.log(`winner never at/below 50% after play 1 (wire-to-wire, no turning point): ${pc(wire)}`)
console.log(`turning point in inning >= 7: ${pc(tpLate)} | earlier: ${pc(tpEarly)}`)
console.log(`game's top-leverage play is also in the top 4 by |WPA|: ${pc(topLiInTop4Wpa)}`)
maxLis.sort((a, b) => a - b)
console.log(`max leverage in a game: median ${maxLis[Math.floor(n / 2)].toFixed(1)}, 10th pct ${maxLis[Math.floor(n * 0.1)].toFixed(1)}, 90th pct ${maxLis[Math.floor(n * 0.9)].toFixed(1)}`)
console.log(`games missing leverageIndex on >1 play: ${noLi}`)
