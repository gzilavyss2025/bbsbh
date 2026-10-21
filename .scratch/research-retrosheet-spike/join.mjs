// #2234 Retrosheet spike, step 2: join Retrosheet event files to MLBAM person ids
// (Chadwick register, ADR-0100) and to statsapi gamePk (home team + date + game
// number). Offline: reads only what fetch.sh and pull-schedules.mjs saved.
//
//   node join.mjs <dlDir> [firstYear] [lastYear] > out.txt
//
// <dlDir> holds ev/{year}/ (extracted event zips), gl/GL{year}.TXT (game logs),
// chad/people-*.csv (register) and sched/{year}.json (pull-schedules.mjs).
// Writes <dlDir>/join-years.json (one row of counts per season) and
// <dlDir>/join-games.json (each Retrosheet game with its gamePk or failure).
// NGL=1 reads only the Negro League files (.EVR/.EDR) and writes *-ngl.json.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { csvObjects, parseCsv } from '../../src/lib/csv/parse.js'
import { buildRetroBridge } from '../../scripts/lib/open-data/retro-bridge.mjs'

const [dl, first = '1908', last = '2025'] = process.argv.slice(2)
if (!dl) throw new Error('usage: node join.mjs <dlDir> [firstYear] [lastYear]')

const reg = readdirSync(`${dl}/chad`).filter(f => f.startsWith('people-'))
  .flatMap(f => csvObjects(readFileSync(`${dl}/chad/${f}`, 'utf8').replace(/^﻿/, '')))
const bridge = buildRetroBridge(reg)
console.log(`register rows ${bridge.rows}, bridged ${bridge.matched}, conflicts ${bridge.conflicts}`)

// Retrosheet event types that do not end a plate appearance.
const NONPA = /^(NP|SB|CS|PO|POCS|PB|WP|BK|OA|DI|FLE)/
// Final-like statsapi states. A suspended game shows once per date it was played on.
const DONE = new Set(['Final', 'Completed Early', 'Game Over', 'Forfeit', 'Final: Tied', 'Completed Early: Rain', 'Completed Early: Darkness'])

function parseEvents(dir) {
  const games = []
  for (const f of readdirSync(dir).filter(f => (process.env.NGL ? /\.E[VD]R$/i : /\.E[VD][ANF]$/i).test(f))) {
    let g = null; const pit = {}
    for (const line of readFileSync(`${dir}/${f}`, 'latin1').split(/\r?\n/)) {
      if (line.startsWith('id,')) { g = { id: line.slice(3).trim(), file: f, ext: f.slice(-3).toUpperCase(), pas: 0, bat: [], pit: [], people: new Set(), info: {} }; games.push(g); pit[0] = pit[1] = null }
      else if (!g) continue
      else if (line.startsWith('info,')) { const i = line.indexOf(',', 5); g.info[line.slice(5, i)] = line.slice(i + 1).replace(/"/g, '') }
      else if (line.startsWith('start,') || line.startsWith('sub,')) {
        const m = line.match(/^(?:start|sub),([^,]+),"[^"]*",(\d),(\d+),(\d+)/)
        if (m) { g.people.add(`${m[2]}:${m[1]}`); if (m[4] === '1') pit[m[2]] = m[1] }
      } else if (line.startsWith('play,')) {
        const p = line.split(',')
        if (NONPA.test(p[6] ?? '')) continue
        const half = +p[2]
        g.pas++; g.bat.push(p[3]); g.pit.push(pit[half === 0 ? 1 : 0])
      }
    }
  }
  return games
}

function loadGamelog(y) {
  const f = [`${dl}/gl/GL${y}.TXT`, `${dl}/gl/gl${y}.txt`].find(existsSync)
  if (!f) return new Map()
  // Quote-aware: the completion field ("date,park,vis,home,outs") holds commas.
  return new Map(parseCsv(readFileSync(f, 'latin1').trim()).map(x => {
    return [`${x[6]}|${x[0]}|${x[1]}`, { vis: +x[9], home: +x[10], completion: x[13] || '', forfeit: x[14] || '' }]
  }))
}

const years = []
const allGames = []
for (let y = +first; y <= +last; y++) {
  if (!existsSync(`${dl}/ev/${y}`) || !existsSync(`${dl}/sched/${y}.json`)) continue
  // statsapi has no Federal League (1914-15) games, so its files (.EVF/.EDF) are
  // counted apart and kept out of the team vote and the join.
  const all = parseEvents(`${dl}/ev/${y}`)
  const rg = all.filter(g => !g.ext.endsWith('F'))
  const sched = JSON.parse(readFileSync(`${dl}/sched/${y}.json`, 'utf8'))
  const sDone = sched.filter(g => DONE.has(g.state) && !['S', 'E', 'A'].includes(g.gameType))
  const gl = loadGamelog(y)
  const iso = d => d.replace(/\//g, '-')

  // Team map by vote: for each Retrosheet code, the statsapi id that shares the most
  // dates as the home (or away) club. No names are read, so a rename cannot break it.
  const byDate = new Map()
  // A suspended game is listed on each date it was played, with one gamePk and one
  // officialDate (its start date). Retrosheet dates it by its start date too.
  const seen = new Set()
  for (const g of sDone) { if (seen.has(g.gamePk)) continue; seen.add(g.gamePk); (byDate.get(g.officialDate) ?? byDate.set(g.officialDate, []).get(g.officialDate)).push(g) }
  const vote = new Map()
  const add = (code, id) => { const v = vote.get(code) ?? vote.set(code, new Map()).get(code); v.set(id, (v.get(id) ?? 0) + 1) }
  for (const g of rg) for (const s of byDate.get(iso(g.info.date)) ?? []) { add(g.info.hometeam, s.home); add(g.info.visteam, s.away) }
  const teamMap = new Map(); const teamNote = {}
  for (const [code, v] of vote) {
    const [[id, n], [, n2] = [0, 0]] = [...v].sort((a, b) => b[1] - a[1])
    teamMap.set(code, id)
    teamNote[code] = { id, name: sDone.find(s => s.home === id)?.homeName ?? sDone.find(s => s.away === id)?.awayName, votes: n, runnerUp: n2 }
  }

  const key = (home, date, n) => `${home}|${date}|${n}`
  const idx = new Map()
  for (const g of [...byDate.values()].flat()) {
    const k = key(g.home, g.officialDate, g.doubleHeader === 'N' ? 1 : g.gameNumber)
    ;(idx.get(k) ?? idx.set(k, []).get(k)).push(g)
  }
  const used = new Map()
  const row = { year: y, rsGames: rg.length, rsFederal: all.length - rg.length, rsGamesPbp: rg.filter(g => g.pas > 0).length, sFinal: seen.size, sFinalR: [...byDate.values()].flat().filter(g => g.gameType === 'R').length,
    joined: 0, joinedPair: 0, awayOk: 0, scoreChecked: 0, scoreOk: 0, fail: {}, dupPk: 0, pas: 0, paBat: 0, paPit: 0, paBoth: 0, ids: 0, idsBridged: 0, joinedGameTypes: {} }
  const ids = new Set()
  // Pass 1: the exact key (home club + date + game number). Pass 2, for what is left:
  // the same date and the same two clubs in either home/away order, nearest game
  // number first. Pass 2 catches a makeup game played in the other club's park and
  // a doubleheader whose two sources number the games differently. Every join is
  // then checked against the game log's final score.
  const outs = []
  const scoreCheck = (g, s, out) => {
    const sc = gl.get(`${g.info.hometeam}|${g.info.date.replace(/\//g, '')}|${g.info.number}`)
    if (!sc || s.homeRuns == null) return
    const swapped = s.home !== teamMap.get(g.info.hometeam)
    const [sv, sh] = swapped ? [s.homeRuns, s.awayRuns] : [s.awayRuns, s.homeRuns]
    row.scoreChecked++
    if (sc.home === sh && sc.vis === sv) row.scoreOk++
    else out.scoreDiff = { rs: [sc.vis, sc.home], sa: [sv, sh], completion: sc.completion, forfeit: sc.forfeit, state: s.state }
  }
  for (const g of rg) {
    const date = iso(g.info.date), home = teamMap.get(g.info.hometeam)
    const n = g.info.number === '0' ? 1 : +g.info.number
    const hit = (idx.get(key(home, date, n)) ?? []).filter(s => !used.has(s.gamePk))
    const out = { id: g.id, year: y, ext: g.ext, date, n, pas: g.pas, home: g.info.hometeam, vis: g.info.visteam, how: 'none', gamePk: null }
    if (hit.length === 1) { out.how = 'exact'; out.gamePk = hit[0].gamePk; used.set(hit[0].gamePk, g.id) }
    outs.push([g, out])
  }
  for (const [g, out] of outs) {
    if (out.how === 'exact') continue
    const home = teamMap.get(g.info.hometeam), away = teamMap.get(g.info.visteam)
    const pair = (byDate.get(out.date) ?? []).filter(s => !used.has(s.gamePk) && ((s.home === home && s.away === away) || (s.home === away && s.away === home)))
      .sort((a, b) => Math.abs(a.gameNumber - out.n) - Math.abs(b.gameNumber - out.n))
    if (!pair.length) {
      const near = [...byDate.values()].flat().filter(s => !used.has(s.gamePk) && [s.home, s.away].sort().join() === [home, away].sort().join() && Math.abs(Date.parse(s.officialDate) - Date.parse(out.date)) <= 3 * 864e5)
      out.diag = near.length ? { reason: 'nearDateOnly', near: near.map(s => [s.gamePk, s.officialDate, s.gameNumber]) } : { reason: 'noStatsapiGame' }
      continue
    }
    const s = pair[0]
    out.gamePk = s.gamePk; used.set(s.gamePk, g.id)
    out.how = 'pair:' + [s.home !== home && 'homeSwapped', (s.doubleHeader === 'N' ? 1 : s.gameNumber) !== out.n && 'gameNumber'].filter(Boolean).join('+')
    out.diag = { gamePk: s.gamePk, gameNumber: s.gameNumber, doubleHeader: s.doubleHeader, statsapiHome: s.homeName, candidates: pair.length }
  }
  for (const [g, out] of outs) {
    const s = out.gamePk ? [...byDate.values()].flat().find(x => x.gamePk === out.gamePk) : null
    if (out.how === 'exact') { row.joined++; row.joinedGameTypes[s.gameType] = (row.joinedGameTypes[s.gameType] ?? 0) + 1; if (s.away === teamMap.get(g.info.visteam)) row.awayOk++ }
    else if (s) row.joinedPair++
    else row.fail[out.diag.reason] = (row.fail[out.diag.reason] ?? 0) + 1
    if (out.how !== 'exact' && s) row.fail[out.how] = (row.fail[out.how] ?? 0) + 1
    if (s) scoreCheck(g, s, out)
    // People and PA-weighted id bridge.
    for (const p of g.people) ids.add(p.split(':')[1])
    for (let i = 0; i < g.pas; i++) {
      const b = bridge.retroToMlbam.has(g.bat[i]), q = bridge.retroToMlbam.has(g.pit[i])
      row.pas++; if (b) row.paBat++; if (q) row.paPit++; if (b && q) row.paBoth++
    }
    out.people = [...g.people].map(p => { const [side, rid] = p.split(':'); return [+side, rid, bridge.retroToMlbam.get(rid) ?? null] })
    allGames.push(out)
  }
  row.ids = ids.size
  row.idsBridged = [...ids].filter(i => bridge.retroToMlbam.has(i)).length
  row.unbridged = [...ids].filter(i => !bridge.retroToMlbam.has(i))
  row.sFinalUnjoined = [...byDate.values()].flat().filter(s => !used.has(s.gamePk)).map(s => ({ gamePk: s.gamePk, date: s.date, gameType: s.gameType, home: s.homeName, away: s.awayName, state: s.state, linescore: s.homeRuns != null }))
  row.teamMap = teamNote
  years.push(row)
  console.log(y, `rs ${row.rsGames} (pbp ${row.rsGamesPbp}) sFinal ${row.sFinal}`, `joined ${row.joined} +pair ${row.joinedPair}`, `score ${row.scoreOk}/${row.scoreChecked}`,
    `PA ${row.pas} both ${row.paBoth}`, `ids ${row.idsBridged}/${row.ids}`, JSON.stringify(row.fail), `sUnjoined ${row.sFinalUnjoined.length} (R ${row.sFinalUnjoined.filter(s => s.gameType === 'R').length})`, `awayOk ${row.awayOk}`)
}
const tag = process.env.NGL ? '-ngl' : ''
writeFileSync(`${dl}/join-years${tag}.json`, JSON.stringify(years, null, 1))
writeFileSync(`${dl}/join-games${tag}.json`, JSON.stringify(allGames))
