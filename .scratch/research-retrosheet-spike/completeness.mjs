// #2234 Retrosheet spike, step 7: are the play-by-play accounts complete? For each
// joined game, compare the PAs in the event file with the PAs in Retrosheet's own
// game log box score (AB + BB + HBP + SH + SF + CI, both clubs; a blank counts 0).
//
//   node completeness.mjs <dlDir>
import { readFileSync, existsSync } from 'node:fs'
import { parseCsv } from '../../src/lib/csv/parse.js'

const dl = process.argv[2]
const games = JSON.parse(readFileSync(`${dl}/join-games.json`, 'utf8'))
const gl = new Map()
for (const y of new Set(games.map(g => g.year))) {
  const f = [`${dl}/gl/GL${y}.TXT`, `${dl}/gl/gl${y}.txt`].find(existsSync)
  // Quote-aware: the completion field ("date,park,vis,home,outs") holds commas.
  for (const x of parseCsv(readFileSync(f, 'latin1').trim())) {
    // 0-based: visitor AB 21, SH 27, SF 28, HBP 29, BB 30, CI 36; home the same +28.
    const pa = o => [21, 27, 28, 29, 30, 36].reduce((s, i) => s + (+x[i + o] || 0), 0)
    gl.set(`${x[6]}|${x[0]}|${x[1]}`, pa(0) + pa(28))
  }
}
const dec = new Map()
for (const g of games) {
  const d = Math.floor(g.year / 10) * 10
  const a = dec.get(d) ?? dec.set(d, { games: 0, equal: 0, short: 0, long: 0, ev: 0, box: 0, deduced: 0, dedEqual: 0 }).get(d)
  const box = gl.get(`${g.home}|${g.date.replace(/-/g, '')}|${g.id.slice(-1)}`)
  if (box == null) continue
  a.games++; a.ev += g.pas; a.box += box
  if (g.pas === box) a.equal++; else if (g.pas < box) a.short++; else a.long++
  if (g.ext.startsWith('ED')) { a.deduced++; if (g.pas === box) a.dedEqual++ }
}
console.log('| Decade | Games | Event PAs equal box PAs | Fewer in events | More in events | Event PAs / box PAs | Deduced games (equal) |')
console.log('|---|---|---|---|---|---|---|')
for (const [d, a] of [...dec].sort((x, y) => x[0] - y[0]))
  console.log(`| ${d}s | ${a.games} | ${a.equal} (${(100 * a.equal / a.games).toFixed(2)}%) | ${a.short} | ${a.long} | ${a.ev} / ${a.box} (${(100 * a.ev / a.box).toFixed(2)}%) | ${a.deduced} (${a.dedEqual}) |`)

// The game log comes from the same event files (inference), so the table above
// tests consistency. Unknown plays are the real gap: Retrosheet writes the event
// "99" for a PA whose result it does not know. Count them in the joined files.
import { readdirSync } from 'node:fs'
const NONPA = /^(NP|SB|CS|PO|POCS|PB|WP|BK|OA|DI|FLE)/
const unk = new Map()
for (const y of [...new Set(games.map(g => g.year))].sort()) {
  const d = Math.floor(y / 10) * 10
  const a = unk.get(d) ?? unk.set(d, { pa: 0, unknown: 0, gamesWithUnknown: 0, games: 0 }).get(d)
  for (const f of readdirSync(`${dl}/ev/${y}`).filter(f => /\.E[VD][AN]$/i.test(f))) {
    let has = false
    for (const line of readFileSync(`${dl}/ev/${y}/${f}`, 'latin1').split(/\r?\n/)) {
      if (line.startsWith('id,')) { if (has) a.gamesWithUnknown++; has = false; a.games++ }
      if (!line.startsWith('play,')) continue
      const ev = line.split(',')[6] ?? ''
      if (NONPA.test(ev)) continue
      a.pa++
      if (ev.startsWith('99')) { a.unknown++; has = true }
    }
    if (has) a.gamesWithUnknown++
  }
}
console.log('\n| Decade | PAs | PAs with an unknown result ("99") | Games with at least one |')
console.log('|---|---|---|---|')
for (const [d, a] of [...unk].sort((x, y) => x[0] - y[0]))
  console.log(`| ${d}s | ${a.pa} | ${a.unknown} (${(100 * a.unknown / a.pa).toFixed(2)}%) | ${a.gamesWithUnknown} of ${a.games} |`)
