import { csvObjects } from '../../src/lib/csv/parse.js'
const cols = ['hc_x', 'plate_x', 'launch_speed', 'bat_speed', 'swing_length', 'release_speed', 'estimated_woba_using_speedangle', 'arm_angle']
console.log(['year', 'rows', ...cols].join('\t'))
for (let y = 2008; y <= 2026; y++) {
  const p = new URLSearchParams({ all: 'true', type: 'details', hfGT: 'R|', hfSea: `${y}|`, game_date_gt: `${y}-06-10`, game_date_lt: `${y}-06-12` })
  let rows = []
  try { const r = await fetch(`https://baseballsavant.mlb.com/statcast_search/csv?${p}`); rows = csvObjects((await r.text()).replace(/^﻿/, '')) } catch (e) { console.log(y, 'ERR', e.message) }
  const pct = c => rows.length ? Math.round(100 * rows.filter(r => r[c] !== '' && r[c] != null).length / rows.length) + '%' : '-'
  console.log([y, rows.length, ...cols.map(pct)].join('\t'))
  await new Promise(r => setTimeout(r, 400))
}
