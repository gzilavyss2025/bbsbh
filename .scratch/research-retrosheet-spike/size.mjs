// #2234 Retrosheet spike, step 5: what a plate-appearance (PA) history store weighs.
// For each season, Chadwick's cwevent expands the event files into one row per event
// with the game state (outs, runners, score, count). This keeps the PA rows, puts
// the gamePk and MLBAM ids from join.mjs on them, and measures gzip -9 of a column
// layout (the #2311 "col" layout), one shard per calendar month (the #2311
// recommendation). Nothing is written but size-years-<first>-<last>.json. Every
// season is measured. Run year ranges in parallel; size-report.mjs reads them all.
//
//   node size.mjs <dlDir> <cweventBinary> [firstYear] [lastYear]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { csvObjects } from '../../src/lib/csv/parse.js'
import { buildRetroBridge } from '../../scripts/lib/open-data/retro-bridge.mjs'

const [dl, cwevent, first = '1908', last = '2025'] = process.argv.slice(2)
if (!cwevent) throw new Error('usage: node size.mjs <dlDir> <cweventBinary> [firstYear] [lastYear]')
const bridge = buildRetroBridge(readdirSync(`${dl}/chad`).filter(f => f.startsWith('people-'))
  .flatMap(f => csvObjects(readFileSync(`${dl}/chad/${f}`, 'utf8').replace(/^﻿/, ''))))
const gamePk = new Map(JSON.parse(readFileSync(`${dl}/join-games.json`, 'utf8')).map(g => [g.id, g.gamePk]))

// cwevent field numbers (cwevent -d): game id, inning, batting team, outs, balls,
// strikes, pitch sequence, vis score, home score, res batter, res batter hand,
// res pitcher, res pitcher hand, runners on 1st/2nd/3rd, event text, lineup
// position, event type, batter event flag, hit value, outs on play, DP, TP, RBI,
// fielded by, batted ball type, event num.
const F = [0, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 16, 17, 26, 27, 28, 29, 33, 34, 35, 37, 40, 41, 42, 43, 46, 47, 96]
const LEAN = ['gamePk', 'ab', 'd', 'batter', 'pitcher', 'stand', 'throws', 'event', 'inn', 'half', 'outs', 'bases', 'balls', 'strikes', 'bsd', 'slot', 'hit', 'outsOnPlay', 'dp', 'tp', 'rbi', 'fld', 'bb']
const VARIANTS = { lean: LEAN, 'lean+pitchSeq': [...LEAN, 'pseq'], 'lean+pitchSeq+eventText': [...LEAN, 'pseq', 'text'] }

function parseCsvLine(line) {
  const out = []; let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur); return out
}
const id = r => { const m = bridge.retroToMlbam.get(r); return m ? +m : null }

const res = []
for (let y = +first; y <= +last; y++) {
  let dir; try { dir = readdirSync(`${dl}/ev/${y}`) } catch { continue }
  const files = dir.filter(f => /\.E[VD][ANF]$/i.test(f)).sort()
  const csv = execFileSync(cwevent, ['-q', '-y', String(y), '-f', F.join(','), ...files], { cwd: `${dl}/ev/${y}`, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] }).toString('latin1')
  const rows = []
  const jan1 = Date.UTC(y, 0, 1)
  for (const line of csv.split(/\r?\n/)) {
    if (!line) continue
    const v = parseCsvLine(line)
    const [gid, inn, batTeam, outs, balls, strikes, pseq, vs, hs, bat, bh, pit, ph, r1, r2, r3, text, slot, ev, batEv, hit, oop, dp, tp, rbi, fld, bb, evn] = v
    if (batEv !== 'T') continue
    const pk = gamePk.get(gid)
    if (pk === undefined) continue // Federal League and other games kept out of the join
    const month = +gid.slice(7, 9)
    const d = Math.round((Date.UTC(y, month - 1, +gid.slice(9, 11)) - jan1) / 864e5)
    const half = +batTeam
    const row = {
      gamePk: pk, ab: +evn, d, batter: id(bat), pitcher: id(pit), stand: bh, throws: ph, event: +ev, inn: +inn, half, outs: +outs,
      bases: (r1 ? 1 : 0) | (r2 ? 2 : 0) | (r3 ? 4 : 0), balls: +balls || 0, strikes: +strikes || 0,
      bsd: half ? +hs - +vs : +vs - +hs, slot: +slot, hit: +hit, outsOnPlay: +oop, dp: dp === 'T' ? 1 : 0, tp: tp === 'T' ? 1 : 0, rbi: +rbi, fld: +fld, bb: bb || '',
      pseq, text, month,
    }
    rows.push(row)
  }
  const sizes = {}
  for (const [name, cols] of Object.entries(VARIANTS)) {
    let raw = 0, gz = 0
    for (const m of [...new Set(rows.map(r => r.month))]) {
      const rs = rows.filter(r => r.month === m)
      const s = JSON.stringify({ season: y, month: m, cols, c: cols.map(c => rs.map(r => r[c])) })
      raw += s.length; gz += gzipSync(s, { level: 9 }).length
    }
    sizes[name] = { raw, gz }
  }
  const pseqFilled = rows.filter(r => r.pseq).length
  res.push({ year: y, pas: rows.length, pseqFilled, sizes })
  console.log(y, rows.length, 'PAs', `pitchSeq ${(100 * pseqFilled / rows.length).toFixed(1)}%`, Object.entries(sizes).map(([k, s]) => `${k} ${(s.gz / 1e6).toFixed(2)} MB gz`).join(', '))
  writeFileSync(`${dl}/size-years-${first}-${last}.json`, JSON.stringify(res, null, 1)) // after each season, so a stopped run keeps its work
}
