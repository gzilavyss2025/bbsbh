// Size the "two prior seasons of Savant percentiles" option against the sizing
// rule in src/api/CLAUDE.md (a static file is sized against the ONE surface that
// opens it). Fetches Savant's percentile-rankings board for each year with the
// same METRICS map gen-savant-percentiles.mjs uses, then measures:
//   - one flat file per season (what the generator writes today), and
//   - the same data sharded on personId % 100 (war-history's shape).
// Usage: node .scratch/ovr/probe-prior-seasons.mjs 2025 2024
import { gzipSync } from 'node:zlib'
import { parseCsv } from '../../src/lib/csv/parse.js'
const METRICS = {
  batter: { xwoba: 'xwoba', exit_velocity: 'ev', hard_hit_percent: 'hardHit', brl_percent: 'brl', chase_percent: 'chase', sprint_speed: 'sprintSpeed', bat_speed: 'batSpeed', squared_up_rate: 'squaredUp', swing_length: 'swingLength' },
  pitcher: { xera: 'xera', k_percent: 'k', bb_percent: 'bb', whiff_percent: 'whiff', chase_percent: 'chase', fb_velocity: 'fbVelo', hard_hit_percent: 'hardHit' },
}
const years = process.argv.slice(2).map(Number)
const kb = (n) => (n / 1024).toFixed(1) + ' KB'
async function season(year) {
  const out = { bat: {}, pit: {} }
  for (const [type, key] of [['batter', 'bat'], ['pitcher', 'pit']]) {
    const res = await fetch(`https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=${type}&year=${year}&csv=true`)
    if (!res.ok) throw new Error(`${year} ${type} http ${res.status}`)
    const [h, ...rows] = parseCsv((await res.text()).replace(/^﻿/, ''))
    const ix = Object.fromEntries(h.map((n, i) => [n, i]))
    for (const r of rows) {
      const e = {}; let any = false
      for (const [src, dst] of Object.entries(METRICS[type])) {
        const raw = r[ix[src]]; const n = raw === '' || raw == null ? null : Number(raw)
        e[dst] = Number.isFinite(n) ? n : null; if (e[dst] != null) any = true
      }
      if (any) out[key][r[ix.player_id]] = e
    }
  }
  return out
}
const data = {}
for (const y of years) data[y] = await season(y)
for (const y of years) {
  const j = JSON.stringify(data[y])
  console.log(y, 'hitters', Object.keys(data[y].bat).length, 'pitchers', Object.keys(data[y].pit).length, '| flat', kb(j.length), 'gzip', kb(gzipSync(j).length))
}
// merged two-season flat file and 100-way shards keyed by player
const shards = Array.from({ length: 100 }, () => ({ bat: {}, pit: {} }))
const flat = { seasons: years, bat: {}, pit: {} }
for (const y of years) for (const k of ['bat', 'pit']) for (const [id, e] of Object.entries(data[y][k])) {
  ;(flat[k][id] ??= {})[y] = e
  ;(shards[id % 100][k][id] ??= {})[y] = e
}
const fj = JSON.stringify(flat)
console.log('two seasons merged flat', kb(fj.length), 'gzip', kb(gzipSync(fj).length))
const sizes = shards.map((s) => JSON.stringify(s).length)
console.log('100 shards: avg', kb(sizes.reduce((a, b) => a + b) / 100), 'max', kb(Math.max(...sizes)), 'gzip of max', kb(gzipSync(JSON.stringify(shards[sizes.indexOf(Math.max(...sizes))])).length))
console.log('total of all shards', kb(sizes.reduce((a, b) => a + b)))
