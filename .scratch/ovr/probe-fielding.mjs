// Compare MLB's sabermetrics `fielding` (war.json `fld`) with Savant outs above
// average (OAA) and fielding_runs_prevented (FRP), 2026 season.
// Usage: node .scratch/ovr/probe-fielding.mjs [oaa.csv path]
import { readFileSync } from 'node:fs'
import { parseCsv } from '../../scripts/lib/savant.mjs'
const war = JSON.parse(readFileSync(new URL('../../public/data/war.json', import.meta.url)))
const res = await fetch('https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&year=' + war.season + '&min=1&csv=true')
console.log('OAA http', res.status, 'CORS', res.headers.get('access-control-allow-origin'))
const rows = parseCsv((await res.text()).replace(/^﻿/, ''))
const [h, ...body] = rows
const ix = Object.fromEntries(h.map((n, i) => [n, i]))
console.log('columns', h.join(' | '))
const pairs = []
const pos = {}
for (const r of body) {
  const id = r[ix.player_id]
  pos[r[ix.primary_pos_formatted]] = (pos[r[ix.primary_pos_formatted]] ?? 0) + 1
  if (war.fld[id] != null) pairs.push([war.fld[id], Number(r[ix.outs_above_average]), Number(r[ix.fielding_runs_prevented]), id])
}
console.log('OAA rows', body.length, 'also in war.json fld', pairs.length, 'of fld', Object.keys(war.fld).length)
console.log('OAA rows by primary position', pos)
const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 } return sab / Math.sqrt(saa * sbb) }
console.log('r(fld, OAA)', corr(pairs.map((p) => p[0]), pairs.map((p) => p[1])).toFixed(3))
console.log('r(fld, FRP)', corr(pairs.map((p) => p[0]), pairs.map((p) => p[2])).toFixed(3))
const ids = new Set(body.map((r) => r[ix.player_id]))
console.log('fld ids NOT in OAA:', Object.keys(war.fld).filter((i) => !ids.has(i)).length)
const sample = pairs.sort((a, b) => b[0] - a[0])
console.log('top fld vs OAA', sample.slice(0, 3), 'bottom', sample.slice(-3))
