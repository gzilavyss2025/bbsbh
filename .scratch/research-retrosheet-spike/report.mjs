// #2234 Retrosheet spike, step 3: per-decade tables and every failure, from the
// files join.mjs wrote. Usage: node report.mjs <dlDir>
import { readFileSync } from 'node:fs'

const dl = process.argv[2]
const years = JSON.parse(readFileSync(`${dl}/join-years.json`, 'utf8'))
const games = JSON.parse(readFileSync(`${dl}/join-games.json`, 'utf8'))
const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : 'n/a')

const dec = new Map()
for (const r of years) {
  const d = Math.floor(r.year / 10) * 10
  const a = dec.get(d) ?? dec.set(d, { y0: r.year, y1: r.year, rs: 0, fed: 0, joined: 0, pair: 0, scoreChecked: 0, scoreOk: 0, pas: 0, paBoth: 0, ids: new Set(), idsOk: 0, sR: 0, sRun: 0, ded: 0 }).get(d)
  a.y1 = r.year; a.rs += r.rsGames; a.fed += r.rsFederal; a.joined += r.joined; a.pair += r.joinedPair; a.scoreChecked += r.scoreChecked; a.scoreOk += r.scoreOk
  a.pas += r.pas; a.paBoth += r.paBoth; a.sR += r.sFinalR; a.sRun += r.sFinalUnjoined.filter(s => s.gameType === 'R').length
}
// Distinct people per decade, from the game rows (a person counts once a decade).
const ppl = new Map()
for (const g of games) {
  const d = Math.floor(g.year / 10) * 10
  const m = ppl.get(d) ?? ppl.set(d, new Map()).get(d)
  for (const [, rid, mlbam] of g.people) m.set(rid, mlbam)
  if (g.ext.startsWith('ED')) dec.get(d).ded++
}
console.log('| Decade | Seasons | Retrosheet games | Exact key | Second pass | Not joined | Score equals statsapi | statsapi R finals not joined | PAs | PAs with batter and pitcher bridged | Distinct people | People bridged | Deduced games |')
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const [d, a] of [...dec].sort((x, y) => x[0] - y[0])) {
  const m = ppl.get(d); const ok = [...m.values()].filter(Boolean).length
  console.log(`| ${d}s | ${a.y0}-${a.y1} | ${a.rs} | ${a.joined} (${pct(a.joined, a.rs)}) | ${a.pair} | ${a.rs - a.joined - a.pair} | ${a.scoreOk}/${a.scoreChecked} (${pct(a.scoreOk, a.scoreChecked)}) | ${a.sRun} of ${a.sR} | ${a.pas} | ${a.paBoth} (${pct(a.paBoth, a.pas)}) | ${m.size} | ${ok} (${pct(ok, m.size)}) | ${a.ded} |`)
}
const tot = k => years.reduce((s, r) => s + r[k], 0)
console.log(`\nAll: Retrosheet games ${tot('rsGames')}, joined ${tot('joined')} (${pct(tot('joined'), tot('rsGames'))}); Federal League games kept out ${tot('rsFederal')}`)

console.log('\n## Retrosheet games not joined (exact key), with the diagnosis')
for (const g of games.filter(g => g.how !== 'exact')) console.log(g.id, g.date, g.how, JSON.stringify(g.diag ?? null))
console.log('\n## Score differences on joined games')
for (const g of games.filter(g => g.scoreDiff)) console.log(g.id, g.gamePk, JSON.stringify(g.scoreDiff))
console.log('\n## Unbridged Retrosheet ids')
for (const r of years.filter(r => r.unbridged.length)) console.log(r.year, r.unbridged.join(' '))
console.log('\n## statsapi regular-season finals with no Retrosheet game, by season (names of clubs, top 6)')
for (const r of years) {
  const un = r.sFinalUnjoined.filter(s => s.gameType === 'R'); if (!un.length) continue
  const clubs = {}; for (const s of un) for (const c of [s.home, s.away]) clubs[c] = (clubs[c] ?? 0) + 1
  console.log(r.year, un.length, JSON.stringify(Object.entries(clubs).sort((a, b) => b[1] - a[1]).slice(0, 6)), un.length <= 3 ? JSON.stringify(un) : '')
}
console.log('\n## Team map (Retrosheet code -> statsapi id) with the weakest vote margins')
const tm = []
for (const r of years) for (const [code, t] of Object.entries(r.teamMap)) tm.push({ year: r.year, code, ...t, margin: t.votes - t.runnerUp })
for (const t of tm.sort((a, b) => a.margin - b.margin).slice(0, 8)) console.log(JSON.stringify(t))
const codes = new Map(); for (const t of tm) { const k = `${t.code}->${t.id}`; const c = codes.get(k) ?? codes.set(k, { code: t.code, id: t.id, names: new Set(), y0: t.year, y1: t.year }).get(k); c.names.add(t.name); c.y0 = Math.min(c.y0, t.year); c.y1 = Math.max(c.y1, t.year) }
console.log('\n## Every code -> id pair, first and last season, statsapi names')
for (const c of [...codes.values()].sort((a, b) => a.id - b.id || a.y0 - b.y0)) console.log(`${c.code} -> ${c.id} ${c.y0}-${c.y1} ${[...c.names].join(' / ')}`)

// The range #2234 asks about first: 1961-2014 (before Savant tracking).
const core = years.filter(r => r.year >= 1961 && r.year <= 2014)
const cs = k => core.reduce((s, r) => s + r[k], 0)
const corePeople = new Map(); for (const g of games) if (g.year >= 1961 && g.year <= 2014) for (const [, rid, m] of g.people) corePeople.set(rid, m)
console.log(`\n## 1961-2014: seasons ${core.length}, Retrosheet games ${cs('rsGames')}, exact key ${cs('joined')}, second pass ${cs('joinedPair')}, not joined ${cs('rsGames') - cs('joined') - cs('joinedPair')}, score equal ${cs('scoreOk')}/${cs('scoreChecked')}, PAs ${cs('pas')}, PAs with both ids ${cs('paBoth')}, distinct people ${corePeople.size}, bridged ${[...corePeople.values()].filter(Boolean).length}`)
console.log(`All seasons: exact key ${tot('joined')}, second pass ${tot('joinedPair')}, not joined ${tot('rsGames') - tot('joined') - tot('joinedPair')}, score equal ${tot('scoreOk')}/${tot('scoreChecked')}`)
