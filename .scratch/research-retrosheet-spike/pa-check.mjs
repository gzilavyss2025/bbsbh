// #2234 Retrosheet spike, step 6: PA-level check against Savant (which has rows from
// 2008). For one day, match each Savant plate appearance (last pitch of an at-bat)
// to a Retrosheet PA in the same gamePk, inning and half, by batter, then compare
// the pitcher two ways: cwevent's pitcher at the play (field 14) and its
// "responsible" pitcher (field 16, the scoring rule for a mid-count change).
//
//   node pa-check.mjs <dlDir> <cweventBinary> 2008-06-10 2011-06-10 ...
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { csvObjects } from '../../src/lib/csv/parse.js'
import { buildRetroBridge } from '../../scripts/lib/open-data/retro-bridge.mjs'

const [dl, cwevent, ...days] = process.argv.slice(2)
const bridge = buildRetroBridge(readdirSync(`${dl}/chad`).filter(f => f.startsWith('people-'))
  .flatMap(f => csvObjects(readFileSync(`${dl}/chad/${f}`, 'utf8').replace(/^﻿/, ''))))
const gamePk = new Map(JSON.parse(readFileSync(`${dl}/join-games.json`, 'utf8')).map(g => [g.id, g.gamePk]))
mkdirSync(`${dl}/sv`, { recursive: true })

for (const day of days) {
  const y = day.slice(0, 4), ymd = day.replace(/-/g, '')
  const f = `${dl}/sv/${day}.csv`
  if (!existsSync(f)) {
    const p = new URLSearchParams({ all: 'true', type: 'details', hfGT: 'R|', hfSea: `${y}|`, game_date_gt: day, game_date_lt: day })
    writeFileSync(f, await (await fetch(`https://baseballsavant.mlb.com/statcast_search/csv?${p}`)).text())
  }
  const last = new Map()
  for (const r of csvObjects(readFileSync(f, 'utf8').replace(/^﻿/, ''))) {
    const k = `${r.game_pk}-${r.at_bat_number}`
    if (!last.has(k) || +r.pitch_number > +last.get(k).pitch_number) last.set(k, r)
  }
  // Retrosheet PAs for that day.
  const files = readdirSync(`${dl}/ev/${y}`).filter(f => /\.EV[AN]$/i.test(f))
  const csv = execFileSync(cwevent, ['-q', '-y', y, '-f', '0,2,3,10,12,14,16,35', ...files], { cwd: `${dl}/ev/${y}`, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] }).toString('latin1')
  const rs = new Map()
  for (const line of csv.split(/\r?\n/)) {
    const v = line.replace(/"/g, '').split(',')
    if (v[7] !== 'T' || v[0].slice(3, 11) !== ymd) continue
    const pk = gamePk.get(v[0]); if (!pk) continue
    const k = `${pk}|${v[1]}|${v[2] === '0' ? 'Top' : 'Bot'}`
    ;(rs.get(k) ?? rs.set(k, []).get(k)).push({ bat: bridge.retroToMlbam.get(v[4]), pitAt: bridge.retroToMlbam.get(v[5]), pitResp: bridge.retroToMlbam.get(v[6]), used: false })
  }
  let n = 0, batFound = 0, pitAtOk = 0, pitRespOk = 0, truncated = 0
  const games = new Set()
  const respMiss = []
  for (const r of [...last.values()].sort((a, b) => +a.game_pk - +b.game_pk || +a.at_bat_number - +b.at_bat_number)) {
    if (r.events === 'truncated_pa' || !r.events) { truncated++; continue }
    n++; games.add(r.game_pk)
    const cand = (rs.get(`${r.game_pk}|${r.inning}|${r.inning_topbot}`) ?? []).find(p => !p.used && p.bat === r.batter)
    if (!cand) continue
    cand.used = true; batFound++
    if (cand.pitAt === r.pitcher) pitAtOk++
    if (cand.pitResp === r.pitcher) pitRespOk++; else respMiss.push([r.game_pk, r.inning, r.events, r.balls + '-' + r.strikes])
  }
  console.log(`${day}: games ${games.size}, Savant PAs ${n} (+${truncated} with no PA event, skipped); batter found ${batFound} (${(100 * batFound / n).toFixed(2)}%); pitcher-at-play equal ${pitAtOk} (${(100 * pitAtOk / batFound).toFixed(2)}%); responsible pitcher equal ${pitRespOk} (${(100 * pitRespOk / batFound).toFixed(2)}%)`)
  if (respMiss.length) console.log('  responsible-pitcher misses', JSON.stringify(respMiss.slice(0, 8)))
}
