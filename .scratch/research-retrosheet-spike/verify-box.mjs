// #2234 Retrosheet spike, step 4: an independent check of both joins. For a fixed
// sample of joined games, compare the MLBAM ids the register gives for the
// Retrosheet start/sub lines with the players in that gamePk's statsapi boxscore,
// side by side. A wrong gamePk or a wrong id bridge shows as a set difference.
//
//   node verify-box.mjs <dlDir> [perSeason=2] [perSeason1961to2014=4]
//   PAIR=1 node verify-box.mjs <dlDir>   (every game joined by the second pass)
import { readFileSync, writeFileSync } from 'node:fs'
import { cachedGetJson } from '../../scripts/lib/statsapi.mjs'

const [dl, kOther = '2', kCore = '4'] = process.argv.slice(2)
const games = JSON.parse(readFileSync(`${dl}/join-games.json`, 'utf8')).filter(g => g.gamePk)
const years = JSON.parse(readFileSync(`${dl}/join-years.json`, 'utf8'))
const teamOf = new Map(years.map(r => [r.year, r.teamMap]))

// A fixed, even spread: the games of a season sorted by id, then every Nth.
const bySeason = Map.groupBy(games, g => g.year)
const sample = process.env.PAIR ? games.filter(g => g.how !== 'exact') : []
for (const [y, gs] of process.env.PAIR ? [] : bySeason) {
  const k = y >= 1961 && y <= 2014 ? +kCore : +kOther
  gs.sort((a, b) => a.id.localeCompare(b.id))
  for (let i = 0; i < k; i++) sample.push(gs[Math.floor((i + 0.5) * gs.length / k)])
}

const res = []
for (const g of sample) {
  const box = await cachedGetJson(`/api/v1/game/${g.gamePk}/boxscore`)
  const homeId = teamOf.get(g.year)[g.home].id
  const swapped = box.teams.home.team.id !== homeId
  const side = s => { const t = box.teams[s]; return new Set([...t.batters, ...t.pitchers].map(String)) }
  const sa = { 0: side(swapped ? 'home' : 'away'), 1: side(swapped ? 'away' : 'home') }
  const rs = { 0: new Set(), 1: new Set() }
  let unbridged = 0
  for (const [s, , mlbam] of g.people) { if (mlbam) rs[s].add(mlbam); else unbridged++ }
  const onlyRs = [], onlySa = []
  for (const s of [0, 1]) {
    for (const id of rs[s]) if (!sa[s].has(id)) onlyRs.push(id)
    for (const id of sa[s]) if (!rs[s].has(id)) onlySa.push(id)
  }
  const boxEmpty = sa[0].size + sa[1].size === 0
  res.push({ id: g.id, year: g.year, gamePk: g.gamePk, how: g.how, rs: rs[0].size + rs[1].size, sa: sa[0].size + sa[1].size, onlyRs, onlySa, unbridged, boxEmpty })
}
writeFileSync(`${dl}/box-check${process.env.PAIR ? '-pair' : ''}.json`, JSON.stringify(res, null, 1))
const dec = Map.groupBy(res, r => Math.floor(r.year / 10) * 10)
console.log('| Decade | Games checked | Box score empty | Same players, both sides | Retrosheet ids not in box | Box ids not in Retrosheet |')
console.log('|---|---|---|---|---|---|')
for (const [d, rs] of [...dec].sort((a, b) => a[0] - b[0])) {
  const full = rs.filter(r => !r.boxEmpty)
  console.log(`| ${d}s | ${rs.length} | ${rs.length - full.length} | ${full.filter(r => !r.onlyRs.length && !r.onlySa.length).length} of ${full.length} | ${full.reduce((s, r) => s + r.onlyRs.length, 0)} | ${full.reduce((s, r) => s + r.onlySa.length, 0)} |`)
}
for (const r of res.filter(r => r.onlyRs.length || r.onlySa.length)) console.log(r.id, r.gamePk, r.how, 'onlyRetro', r.onlyRs.join(' '), 'onlyBox', r.onlySa.join(' '))
