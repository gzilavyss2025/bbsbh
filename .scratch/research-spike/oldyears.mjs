import { readFileSync, readdirSync } from 'node:fs'
import { csvObjects } from '../../src/lib/csv/parse.js'
import { buildRetroBridge } from '../../scripts/lib/open-data/retro-bridge.mjs'
const S = process.env.RETRO_DIR || '/tmp/retro'
const bridge = buildRetroBridge(readdirSync(`${S}/chad`).flatMap(f => csvObjects(readFileSync(`${S}/chad/${f}`, 'utf8').replace(/^﻿/, ''))))
const NONPA = /^(NP|SB|CS|PO|POCS|PB|WP|BK|OA|DI|FLE)/
for (const y of [1955, 1975, 1995]) {
  let pa = 0, hit = 0, games = 0; const ids = new Set(), got = new Set()
  for (const f of readdirSync(`${S}/r${y}`).filter(f => /\.EV[ANF]$/.test(f))) for (const l of readFileSync(`${S}/r${y}/${f}`, 'utf8').split(/\r?\n/)) {
    if (l.startsWith('id,')) games++
    else if (l.startsWith('play,')) { const p = l.split(','); if (NONPA.test(p[6])) continue; pa++; const ok = bridge.retroToMlbam.has(p[3]); if (ok) hit++; ids.add(p[3]); if (ok) got.add(p[3]) }
  }
  console.log(y, 'games', games, 'PAs', pa, 'batter PAs with an MLBAM id', (100 * hit / pa).toFixed(2) + '%', 'distinct batters', ids.size, 'with MLBAM', got.size)
}
