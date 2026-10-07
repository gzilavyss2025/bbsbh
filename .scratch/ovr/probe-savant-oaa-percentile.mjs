// Coverage of the `oaa` and `arm_strength` percentile columns on the
// percentile-rankings board gen-savant-percentiles.mjs ALREADY fetches, and how
// the OAA percentile lines up with the raw OAA board. 2026 season.
import { parseCsv } from '../../src/lib/csv/parse.js'
import { readFileSync } from 'node:fs'
const get = async (u) => parseCsv((await (await fetch(u)).text()).replace(/^﻿/, ''))
const [h, ...b] = await get('https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=batter&year=2026&csv=true')
const ix = Object.fromEntries(h.map((n, i) => [n, i]))
const have = (c) => b.filter((r) => r[ix[c]] !== '' && r[ix[c]] != null).length
console.log('batter rows', b.length, '| oaa filled', have('oaa'), '| arm_strength filled', have('arm_strength'), '| xwoba filled', have('xwoba'))
const [h2, ...b2] = await get('https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&year=2026&min=1&csv=true')
const i2 = Object.fromEntries(h2.map((n, i) => [n, i]))
const raw = new Map(b2.map((r) => [r[i2.player_id], Number(r[i2.outs_above_average])]))
const pairs = b.filter((r) => r[ix.oaa] !== '' && raw.has(r[ix.player_id])).map((r) => [Number(r[ix.oaa]), raw.get(r[ix.player_id])]).sort((x, y) => x[0] - y[0])
console.log('oaa percentile vs raw OAA (min / mid / max):', pairs[0], pairs[Math.floor(pairs.length / 2)], pairs.at(-1))
const ours = JSON.parse(readFileSync(new URL('../../public/data/savant-percentiles.json', import.meta.url)))
console.log('savant-percentiles.json', ours.season, 'bat ids', Object.keys(ours.bat).length, 'pit ids', Object.keys(ours.pit).length)
const missing = b.filter((r) => r[ix.oaa] === '' && r[ix.xwoba] !== '').length
console.log('hitters with xwOBA but no OAA percentile (catchers, DH, low sample):', missing)
