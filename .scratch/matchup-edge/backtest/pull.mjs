// Backtest data (#1688): every 2026 regular-season pitch from Savant, one request a day,
// slimmed to the columns the model reads. Usage: node pull.mjs <outDir>
// Output: <outDir>/{date}.json, an array of rows (see COLS). Re-runs skip days on disk.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const out = process.argv[2]
if (!out) throw new Error('usage: node pull.mjs <outDir>')
mkdirSync(out, { recursive: true })

const COLS = ['game_date', 'game_pk', 'at_bat_number', 'pitcher', 'batter', 'stand', 'p_throws', 'pitch_type',
  'plate_x', 'plate_z', 'sz_top', 'sz_bot', 'description', 'events', 'woba_value', 'woba_denom',
  'estimated_woba_using_speedangle', 'launch_speed']

// Savant quotes fields that hold commas; this splits one CSV line.
function splitCsv(line) {
  const f = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { f.push(cur); cur = '' } else cur += ch
  }
  f.push(cur)
  return f
}

const day = new Date('2026-03-20T12:00:00Z')
const end = new Date('2026-10-01T12:00:00Z')
for (; day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
  const d = day.toISOString().slice(0, 10)
  const file = `${out}/${d}.json`
  if (existsSync(file)) continue
  const p = new URLSearchParams({ all: 'true', type: 'details', hfGT: 'R|', hfSea: '2026|', game_date_gt: d, game_date_lt: d })
  let text
  for (let t = 0; t < 4; t++) {
    const r = await fetch(`https://baseballsavant.mlb.com/statcast_search/csv?${p}`).catch(() => null)
    if (r?.ok) { text = await r.text(); break }
    await new Promise((res) => setTimeout(res, 2000 * 2 ** t))
  }
  if (text == null) { console.log(d, 'FAILED'); continue }
  const lines = text.replace(/^﻿/, '').split('\n').filter(Boolean)
  const head = splitCsv(lines[0])
  const at = COLS.map((c) => head.indexOf(c))
  if (at.some((i) => i < 0)) { console.log(d, 'missing columns', COLS.filter((c, i) => at[i] < 0)); continue }
  const rows = lines.slice(1).map((l) => { const f = splitCsv(l); return at.map((i) => f[i]) })
  writeFileSync(file, JSON.stringify(rows))
  console.log(d, rows.length, rows.length >= 25000 ? 'CAP!' : '')
  await new Promise((res) => setTimeout(res, 400))
}
