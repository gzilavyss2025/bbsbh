// #2311 step 5: can Retrosheet 2023 plays be joined to MLBAM ids and to gamePk?
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { csvObjects } from '../../src/lib/csv/parse.js'
import { buildRetroBridge } from '../../scripts/lib/open-data/retro-bridge.mjs'
const S = process.env.RETRO_DIR || '/tmp/retro'
const TEAM = { ANA:108,ARI:109,ATL:144,BAL:110,BOS:111,CHA:145,CHN:112,CIN:113,CLE:114,COL:115,DET:116,HOU:117,KCA:118,LAN:119,MIA:146,MIL:158,MIN:142,NYA:147,NYN:121,OAK:133,PHI:143,PIT:134,SDN:135,SEA:136,SFN:137,SLN:138,TBA:139,TEX:140,TOR:141,WAS:120 }
// ---- bridge
const reg = readdirSync(`${S}/chad`).filter(f => f.startsWith('people-')).flatMap(f => csvObjects(readFileSync(`${S}/chad/${f}`, 'utf8').replace(/^﻿/, '')))
const bridge = buildRetroBridge(reg)
console.log('register rows', bridge.rows, 'bridged', bridge.matched, 'conflicts', bridge.conflicts)
// ---- schedule
let sched
if (existsSync('sched2023.json')) sched = JSON.parse(readFileSync('sched2023.json', 'utf8'))
else { const r = await fetch('https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=2023&gameType=R&startDate=2023-03-01&endDate=2023-11-01&hydrate=linescore'); sched = await r.json(); writeFileSync('sched2023.json', JSON.stringify(sched)) }
const sg = sched.dates.flatMap(d => d.games).filter(g => g.status.abstractGameState === 'Final')
const byKey = new Map()
for (const g of sg) byKey.set(`${g.teams.home.team.id}|${g.officialDate}|${g.doubleHeader === 'N' ? 1 : g.gameNumber}`, g)
console.log('statsapi final regular-season games', sg.length)
// ---- gamelog scores
const gl = readFileSync(`${S}/retro/gl2023.txt`, 'utf8').trim().split('\n').map(l => l.split(',').map(x => x.replace(/"/g, '')))
const glScore = new Map(gl.map(f => [`${f[6]}|${f[0]}|${f[1]}`, [+f[9], +f[10]]]))
// ---- parse events
const NONPA = /^(NP|SB|CS|PO|POCS|PB|WP|BK|OA|DI|FLE)/
const games = []
for (const f of readdirSync(`${S}/retro`).filter(f => /^2023.*\.EV[AN]$/.test(f))) {
  let g = null, pit = {}
  for (const line of readFileSync(`${S}/retro/${f}`, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('id,')) { g = { id: line.slice(3), pas: [] }; games.push(g); pit = {} }
    else if (line.startsWith('info,')) { const [, k, v] = line.split(','); if (['visteam','hometeam','date','number'].includes(k)) g[k] = v }
    else if (line.startsWith('start,') || line.startsWith('sub,')) { const m = line.match(/^(?:start|sub),([^,]+),"[^"]*",(\d),(\d),(\d)/); if (m && m[4] === '1') pit[m[2]] = m[1] }
    else if (line.startsWith('play,')) {
      const p = line.split(','); const inn = +p[1], half = +p[2], bat = p[3], ev = p[6]
      if (!NONPA.test(ev)) g.pas.push({ inn, half, bat, pit: pit[half === 0 ? '1' : '0'] })
    }
  }
}
console.log('retrosheet games', games.length, 'PAs', games.reduce((s, g) => s + g.pas.length, 0))
// ---- game join
let gJoin = 0, gScoreOk = 0, gNoGl = 0
const joined = []
for (const g of games) {
  const d = g.date.replace(/\//g, '-'), hid = TEAM[g.hometeam]
  const sgm = byKey.get(`${hid}|${d}|${g.number === '0' ? 1 : +g.number}`)
  if (sgm) { gJoin++; g.gamePk = sgm.gamePk; joined.push(g)
    const sc = glScore.get(`${g.hometeam}|${g.date.replace(/\//g, '')}|${g.number}`)
    if (sc) { const ls = sgm.linescore?.teams; if (ls && ls.away.runs === sc[0] && ls.home.runs === sc[1]) gScoreOk++ } else gNoGl++ }
}
console.log(`games joined to a gamePk: ${gJoin}/${games.length} (${(100*gJoin/games.length).toFixed(2)}%); of statsapi finals ${(100*gJoin/sg.length).toFixed(2)}%`)
console.log(`  of joined, final score equals statsapi linescore: ${gScoreOk}/${gJoin} (${(100*gScoreOk/gJoin).toFixed(2)}%), gamelog row missing ${gNoGl}`)
const unj = games.filter(g => !g.gamePk).slice(0, 5).map(g => g.id); console.log('  sample unjoined', unj)
// ---- player join, PA-weighted
let pa = 0, paB = 0, paP = 0, paBoth = 0
const ids = new Set(), miss = new Map()
for (const g of games) for (const p of g.pas) {
  pa++; const b = bridge.retroToMlbam.get(p.bat), q = bridge.retroToMlbam.get(p.pit)
  if (b) paB++; else miss.set(p.bat, (miss.get(p.bat) || 0) + 1)
  if (q) paP++; else miss.set(p.pit, (miss.get(p.pit) || 0) + 1)
  if (b && q) paBoth++; ids.add(p.bat); ids.add(p.pit)
}
let idHit = 0; for (const i of ids) if (bridge.retroToMlbam.has(i)) idHit++
console.log(`distinct retro ids ${ids.size}, bridged ${idHit} (${(100*idHit/ids.size).toFixed(2)}%)`)
console.log(`PAs ${pa}: batter id bridged ${(100*paB/pa).toFixed(3)}%, pitcher ${(100*paP/pa).toFixed(3)}%, both ${(100*paBoth/pa).toFixed(3)}%`)
console.log('top unbridged', [...miss].sort((a,b)=>b[1]-a[1]).slice(0,8))
// ---- PA-level check vs Savant on 3 sample days
const gpk = new Map(joined.map(g => [g.gamePk, g]))
for (const day of ['2023-06-10', '2023-06-11', '2023-06-12']) {
  const f = `sv/${day}.csv`
  if (!existsSync(f)) { const p = new URLSearchParams({ all: 'true', type: 'details', hfGT: 'R|', hfSea: '2023|', game_date_gt: day, game_date_lt: day }); writeFileSync(f, await (await fetch(`https://baseballsavant.mlb.com/statcast_search/csv?${p}`)).text()) }
  const rows = csvObjects(readFileSync(f, 'utf8').replace(/^﻿/, ''))
  const last = new Map(); for (const r of rows) { const k = `${r.game_pk}-${r.at_bat_number}`; if (!last.has(k) || +r.pitch_number > +last.get(k).pitch_number) last.set(k, r) }
  const svBy = new Map(); for (const r of last.values()) (svBy.get(+r.game_pk) ?? svBy.set(+r.game_pk, []).get(+r.game_pk)).push(r)
  let games_ = 0, exact = 0, countEq = 0, paTot = 0, paMatch = 0
  for (const [pk, srows] of svBy) {
    const g = gpk.get(pk); if (!g) continue; games_++
    srows.sort((a, b) => +a.at_bat_number - +b.at_bat_number)
    const mine = g.pas.map(p => `${bridge.retroToMlbam.get(p.bat)}-${bridge.retroToMlbam.get(p.pit)}-${p.inn}-${p.half === 0 ? 'Top' : 'Bot'}`)
    const theirs = srows.map(r => `${r.batter}-${r.pitcher}-${r.inning}-${r.inning_topbot}`)
    if (mine.length === theirs.length) countEq++
    if (mine.join() === theirs.join()) exact++
    paTot += theirs.length; const set = [...mine]; for (let k = 0; k < theirs.length; k++) { const t = theirs[k]; const i = set.indexOf(t); if (i >= 0) { paMatch++; set.splice(i, 1) } else { globalThis.UNM = (globalThis.UNM || []); UNM.push(srows[k].events || '(none: PA cut short)') } }
  }
  console.log(`${day}: games ${svBy.size} (joined ${games_}), same PA count ${countEq}, identical PA sequence ${exact}, Savant PAs ${paTot} found in Retrosheet ${paMatch} (${(100*paMatch/paTot).toFixed(2)}%)`)
}

const tally = {}; for (const e of UNM) tally[e] = (tally[e]||0)+1; console.log('Savant PAs not in Retrosheet, by Savant events:', Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,10))
const ids2 = new Set(sg.map(g=>g.gamePk)); console.log('unique gamePk', ids2.size, 'statuses', [...new Set(sg.map(g=>g.status.detailedState))], 'gameTypes', [...new Set(sg.map(g=>g.gameType))]); const jp = new Set(joined.map(g=>g.gamePk)); const ex = sg.filter(g=>!jp.has(g.gamePk)); console.log('statsapi finals with no Retrosheet game', ex.length, ex.slice(0,4).map(g=>[g.gamePk,g.officialDate,g.teams.home.team.name,g.gameNumber,g.doubleHeader,g.gameType]))
