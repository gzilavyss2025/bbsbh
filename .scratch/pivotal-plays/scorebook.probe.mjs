// Probe for .scratch/pivotal-plays/spec.md, "Gary's scrapbook". Reads the scorebook dashboard's
// game list (a JSON file with one row per scored game: id = gamePk, decisive = the go-ahead play
// text) and, for each Brewers game, compares that go-ahead play with the win-probability turning
// point and the top plays by swing and by leverage.
//
//   node .scratch/pivotal-plays/scorebook.probe.mjs <path to gamelog.json>
//
// Source: /api/v1/game/{gamePk}/winProbability, checked 2026-11-03. Read-only.
import { readFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const rows = JSON.parse(readFileSync(process.argv[2], 'utf8')).filter((r) => r.brewers === 'Brewers')
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
let n = 0, hit = 0, sameAsWp = 0, wireToWire = 0, goAheadInTop3Wpa = 0, goAheadInTop3Li = 0, tpInTop3Wpa = 0, tpInTop3Li = 0
let earlierBy = [], laterBy = []
const diffs = []
for (const r of rows) {
  let w
  try { w = await getJson(`/api/v1/game/${r.id}/winProbability`) } catch { continue }
  if (!Array.isArray(w) || w.length < 10) continue
  n++
  const desc = w.map((e) => norm(e.result?.description))
  // The scrapbook text is "Top 2: <description> (1-0)". Find the play whose description it contains.
  const body = norm(String(r.decisive).replace(/^(top|bottom) \d+:\s*/i, '').replace(/\s*\(\d+-\d+\)\s*$/, ''))
  const gi = desc.findIndex((d) => d && (body.startsWith(d.slice(0, 40)) || d.startsWith(body.slice(0, 40))))
  const last = w.at(-1).result, homeWon = last.homeScore > last.awayScore
  const win = w.map((e) => (homeWon ? e.homeTeamWinProbability : 100 - e.homeTeamWinProbability))
  let tp = -1
  for (let k = 0; k < win.length; k++) if (win[k] <= 50) tp = k
  const tpi = tp + 1
  if (tpi <= 1) wireToWire++
  const wpa = w.map((e) => Math.abs(e.homeTeamWinProbabilityAdded ?? 0)), li = w.map((e) => e.leverageIndex ?? 0)
  const top3 = (a) => [...a.keys()].sort((x, y) => a[y] - a[x]).slice(0, 3)
  const t3w = top3(wpa), t3l = top3(li)
  if (gi >= 0) {
    hit++
    if (gi === tpi) sameAsWp++
    else diffs.push({ date: r.date, game: r.game, goAhead: gi, wpTurn: tpi, plays: w.length })
    if (t3w.includes(gi)) goAheadInTop3Wpa++
    if (t3l.includes(gi)) goAheadInTop3Li++
  }
  if (t3w.includes(tpi)) tpInTop3Wpa++
  if (t3l.includes(tpi)) tpInTop3Li++
}
const p = (x, d = hit) => `${x} of ${d} (${Math.round((x / d) * 100)}%)`
console.log(`Brewers games read: ${n}; scrapbook go-ahead play matched to a play: ${hit}`)
console.log(`go-ahead play IS the win-probability turning point: ${p(sameAsWp)}`)
console.log(`go-ahead play is in the game's top 3 by swing: ${p(goAheadInTop3Wpa)}; by leverage: ${p(goAheadInTop3Li)}`)
console.log(`turning point is in the top 3 by swing: ${p(tpInTop3Wpa, n)}; by leverage: ${p(tpInTop3Li, n)}`)
console.log(`wire to wire (no turning point): ${p(wireToWire, n)}`)
console.log('examples where they differ (play index in the game):')
diffs.slice(0, 6).forEach((d) => console.log(`  ${d.date} ${d.game}: go-ahead #${d.goAhead}, win-prob turn #${d.wpTurn} of ${d.plays}`))
