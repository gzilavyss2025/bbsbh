// Builds the "pivotal" dataset for Gary's scorebook dashboard (see spec.md, "Gary's scrapbook").
// One row per scored game: the win-probability turning point, the tensest spots by leverage, the
// biggest swing, how low the winner's win probability fell, and three drama numbers.
//
//   node .scratch/pivotal-plays/scrapbook.build.mjs <gamelog.json> <out pivotal.json>
//
// Input: the dashboard's gamelog.json (id = gamePk, game = label). Output: a JSON array of rows.
// Source: /api/v1/game/{gamePk}/winProbability, checked 2026-11-03. Read-only except the output.
import { readFileSync, writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const [inPath, outPath] = process.argv.slice(2)
const games = JSON.parse(readFileSync(inPath, 'utf8'))

const LI_FLOOR = 2.0 // about the 10th percentile of a game's peak leverage (spec.md, "Measured gap")
const trim = (s, n = 200) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n)
  return cut.slice(0, cut.lastIndexOf(' ')) + '...'
}
const inn = (e) => `${e.about.isTopInning ? 'Top' : 'Bottom'} ${e.about.inning}`
const pts = (x) => Math.round(Math.abs(x))
const poss = (name) => (name.endsWith('s') ? `${name}'` : `${name}'s`)

// Who is home, and who won, from the dashboard's own label.
function teamsOf(r) {
  const m = /^([WL]) (\d+)-(\d+) (at|vs) (.+)$/.exec(r.game)
  if (m) {
    const won = m[1] === 'W', opp = m[5], brewersHome = m[4] === 'vs'
    return { home: brewersHome ? 'Brewers' : opp, away: brewersHome ? opp : 'Brewers', winner: won ? 'Brewers' : opp }
  }
  const o = /^(.+) (\d+), (.+) (\d+)$/.exec(r.game) // "Away n, Home n"
  if (o) return { away: o[1], home: o[3], winner: Number(o[2]) > Number(o[4]) ? o[1] : o[3] }
  return null
}

const out = []
for (const r of games) {
  const base = { id: r.id, date: r.date, game: r.game, chapter: r.chapter, available: false }
  const teams = teamsOf(r)
  let w = null
  try { w = await getJson(`/api/v1/game/${r.id}/winProbability`) } catch { /* minor-league parks have none */ }
  if (!teams || !Array.isArray(w) || w.length < 10) { out.push(base); continue }

  const homeWon = teams.winner === teams.home
  const win = w.map((e) => (homeWon ? e.homeTeamWinProbability : 100 - e.homeTeamWinProbability))
  const wpa = w.map((e) => e.homeTeamWinProbabilityAdded ?? 0)
  const li = w.map((e) => e.leverageIndex ?? 0)
  const helped = (i) => (wpa[i] >= 0 ? teams.home : teams.away)

  // Turning point: the first play after which the winner's win % never again drops to 50 or lower.
  let last = -1
  for (let k = 0; k < win.length; k++) if (win[k] <= 50) last = k
  const t = last + 1
  const wire = t <= 1
  const row = { ...base, available: true, winner: teams.winner, wireToWire: wire }
  if (wire) {
    row.turningNote = `${poss(teams.winner)} win probability never fell to 50% or lower after the first play.`
  } else {
    row.turning = `${inn(w[t])}: ${trim(w[t].result.description)}`
    row.turningNote = `${poss(teams.winner)} win probability stayed above 50% from here${Math.round(win[t]) > 50 ? ` (${Math.round(win[t])}% after this play)` : ''}.`
  }

  // How low the winner fell, after the first play (the opening plays start near even).
  const lowAt = win.reduce((lo, v, i) => (i > 0 && v < win[lo] ? i : lo), 1)
  row.lowPct = Math.round(win[lowAt])
  row.lowNote = win[lowAt] <= 25 ? `${poss(teams.winner)} win probability fell as low as ${Math.round(win[lowAt])}% (${inn(w[lowAt])}).` : ''

  // Tense spots: top 3 by leverage, floor 2.0.
  const tense = [...li.keys()].filter((i) => li[i] >= LI_FLOOR).sort((a, b) => li[b] - li[a]).slice(0, 3)
  ;[0, 1, 2].forEach((n) => {
    const i = tense[n]
    row[`tense${n + 1}`] = i == null ? '' : `${inn(w[i])}: ${trim(w[i].result.description)} Leverage ${li[i].toFixed(1)}; moved win probability ${pts(wpa[i])} points toward the ${helped(i)}.`
  })

  // Biggest swing.
  const big = [...wpa.keys()].sort((a, b) => Math.abs(wpa[b]) - Math.abs(wpa[a]))[0]
  row.swing = `${inn(w[big])}: ${trim(w[big].result.description)} (${pts(wpa[big])} points toward the ${helped(big)}).`

  // Three drama numbers, so a chapter can be ranked later.
  row.peakLeverage = Number(Math.max(...li).toFixed(1))
  row.totalSwing = Math.round(wpa.reduce((s, v) => s + Math.abs(v), 0))
  let changes = 0
  for (let k = 1; k < w.length; k++) if ((w[k - 1].homeTeamWinProbability - 50) * (w[k].homeTeamWinProbability - 50) < 0) changes++
  row.leadChanges = changes
  out.push(row)
}
writeFileSync(outPath, JSON.stringify(out))
const ok = out.filter((r) => r.available)
console.log(`rows: ${out.length}; with win-probability data: ${ok.length}; without: ${out.length - ok.length}`)
console.log(`wire to wire: ${ok.filter((r) => r.wireToWire).length}; with a low note: ${ok.filter((r) => r.lowNote).length}; with 3 tense spots: ${ok.filter((r) => r.tense3).length}; with 0: ${ok.filter((r) => !r.tense1).length}`)
