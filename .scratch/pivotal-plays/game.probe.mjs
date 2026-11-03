// Probe for .scratch/pivotal-plays/spec.md. Ranks one game's plays three ways (|WPA|, leverage
// index, MLB's captivatingIndex) and finds the "turning point": the first play after which the
// eventual winner's win probability never again dropped to 50% or lower.
//
//   node .scratch/pivotal-plays/game.probe.mjs 849799 849803
//
// Source: /api/v1/game/{gamePk}/winProbability, checked 2026-11-03 (World Series 2026 games 5 and 4).
import { getJson } from '../../scripts/lib/statsapi.mjs'
const games = process.argv.slice(2).map((pk) => [Number(pk), 'gamePk ' + pk])
const pct = (x) => (x == null ? '   ?' : x.toFixed(1).padStart(5))
for (const [pk, label] of games) {
  const w = await getJson(`/api/v1/game/${pk}/winProbability`)
  console.log(`\n=== ${label}  gamePk ${pk}  (${w.length} plays)`)
  console.log('contextMetrics sample:', JSON.stringify(w[10].contextMetrics), '| top-level leverageIndex sample:', w[10].leverageIndex, '| captivating:', w[10].about.captivatingIndex)
  const rows = w.map((e, i) => ({
    i, inn: `${e.about.isTopInning ? 'T' : 'B'}${e.about.inning}`,
    wpa: Math.abs(e.homeTeamWinProbabilityAdded ?? 0), wpaSigned: e.homeTeamWinProbabilityAdded ?? 0,
    li: e.leverageIndex ?? e.contextMetrics?.leverageIndex ?? null, cap: e.about.captivatingIndex ?? null,
    hwp: e.homeTeamWinProbability, desc: e.result.description.slice(0, 70), score: `${e.result.awayScore}-${e.result.homeScore}`,
  }))
  const top = (key, n = 5) => [...rows].filter((r) => r[key] != null).sort((a, b) => b[key] - a[key]).slice(0, n)
  for (const [name, key] of [['by |WPA|', 'wpa'], ['by leverage index', 'li'], ['by captivatingIndex', 'cap']]) {
    console.log(`-- top 5 ${name}`)
    top(key).forEach((r) => console.log(`  #${String(r.i).padStart(2)} ${r.inn.padEnd(3)} wpa ${pct(r.wpaSigned)} li ${r.li == null ? '  ?' : r.li.toFixed(2)} cap ${r.cap ?? '?'}  ${r.score}  ${r.desc}`))
  }
  // turning point: last play after which the eventual winner's win prob was <= 50 before it and > 50 after, never back
  const homeWon = rows.at(-1).hwp > 50
  const win = (r) => (homeWon ? r.hwp : 100 - r.hwp)
  let tp = -1
  for (let k = 0; k < rows.length; k++) if (win(rows[k]) <= 50) tp = k
  console.log(`-- turning point (winner never at or below 50% after): play #${tp + 1 < rows.length ? tp + 1 : 'none'}`, tp + 1 < rows.length ? `${rows[tp + 1].inn} ${rows[tp + 1].desc} (winner WP ${win(rows[tp + 1]).toFixed(0)}%)` : '')
  const sum = rows.reduce((t, r) => t + r.wpa, 0)
  console.log(`-- sum of |WPA| ${sum.toFixed(0)}; top 3 plays by |WPA| hold ${(top('wpa',3).reduce((t,r)=>t+r.wpa,0)/sum*100).toFixed(0)}% of it`)
}
