// #2234 PA-row store measurement, 1961-2014. Scratch only, never committed.
//   node measure.mjs <dlDir> <cweventBinary> <outJson>
// Reads the Retrosheet event files, runs cwevent, joins to gamePk and MLBAM ids with
// the spike's join-games.json, and measures gzip -9 sizes of several layouts.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { gzipSync, brotliCompressSync, constants } from 'node:zlib'
import { performance } from 'node:perf_hooks'
import { csvObjects } from '/home/user/bbsbh/src/lib/csv/parse.js'
import { buildRetroBridge } from '/home/user/bbsbh/scripts/lib/open-data/retro-bridge.mjs'

const [dl, cwevent, outJson] = process.argv.slice(2)
const FIRST = 1961, LAST = 2014
const bridge = buildRetroBridge(readdirSync(`${dl}/chad`).filter(f => f.startsWith('people-'))
  .flatMap(f => csvObjects(readFileSync(`${dl}/chad/${f}`, 'utf8').replace(/^﻿/, ''))))
const joined = JSON.parse(readFileSync(`${dl}/join-games.json`, 'utf8'))
const gamePkOf = new Map(joined.filter(g => g.gamePk != null).map(g => [g.id, g.gamePk]))
const sched = new Map()
for (let y = FIRST; y <= LAST; y++) for (const g of JSON.parse(readFileSync(`${dl}/sched/${y}.json`, 'utf8'))) sched.set(g.gamePk, g)
const mlbam = r => { const m = bridge.retroToMlbam.get(r); return m ? +m : 0 }

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
// cwevent field numbers (cwevent -d): game id 0, inning 2, batting team 3, outs 4,
// balls 5, strikes 6, pitch sequence 7, vis score 8, home score 9, res batter 12, hand 13,
// res pitcher 16, hand 17, runners 26-28, lineup slot 33, event type 34, batter event
// flag 35, hit value 37, RBI 43, event number 96.
const F = [0, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 16, 17, 26, 27, 28, 33, 34, 35, 37, 43, 96]

const CAP = 8_700_000
const T = {
  gamePk: new Int32Array(CAP), ab: new Int16Array(CAP), batter: new Int32Array(CAP), pitcher: new Int32Array(CAP),
  event: new Int8Array(CAP), inn: new Int8Array(CAP), half: new Int8Array(CAP), outs: new Int8Array(CAP), bases: new Int8Array(CAP),
  balls: new Int8Array(CAP), strikes: new Int8Array(CAP), bsd: new Int16Array(CAP), slot: new Int8Array(CAP), hit: new Int8Array(CAP),
  rbi: new Int8Array(CAP), stand: new Uint8Array(CAP), throws: new Uint8Array(CAP), pseq: new Int32Array(CAP),
  season: new Int16Array(CAP), month: new Int8Array(CAP),
}
const HAND = ['?', 'L', 'R', 'B']
const dict = ['']; const dictId = new Map([['', 0]])
let N = 0
const seasonStats = []; const gameIndex = []

for (let y = FIRST; y <= LAST; y++) {
  const dir = `${dl}/ev/${y}`
  const files = readdirSync(dir).filter(f => /\.E[VD][ANF]$/i.test(f)).sort()
  // Raw files: game info and the raw play lines (count and pitch string), in order.
  const raw = new Map()
  for (const f of files) {
    let g = null
    for (const line of readFileSync(`${dir}/${f}`, 'latin1').split(/\r?\n/)) {
      if (line.startsWith('id,')) { g = { info: {}, plays: [] }; raw.set(line.slice(3).trim(), g) }
      else if (!g) continue
      else if (line.startsWith('info,')) { const i = line.indexOf(',', 5); g.info[line.slice(5, i)] = line.slice(i + 1).replace(/"/g, '') }
      else if (line.startsWith('play,')) { const p = line.split(','); if (p[6] !== 'NP') g.plays.push([p[4], p[5]]) } // cwevent does not number NP (substitution) lines // fields: play,inn,half,player,count,pitches,event
    }
  }
  const csv = execFileSync(cwevent, ['-q', '-y', String(y), '-f', F.join(','), ...files], { cwd: dir, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] }).toString('latin1')
  const rows = []; const mismatch = { pseq: 0, nplay: 0 }
  const st = { year: y, pas: 0, games: { pitches: 0, count: 0, none: 0 }, pseqFilled: 0, countKnown: 0, complete: 0, hasUnknown: 0, pitchTotal: 0,
    cls: { K: [0, 0], W: [0, 0], HBP: [0, 0], BIP: [0, 0] } }
  const seenGame = new Set()
  for (const line of csv.split(/\r?\n/)) {
    if (!line) continue
    const v = parseCsvLine(line)
    const [gid, inn, batTeam, outs, balls, strikes, pseq, vs, hs, bat, bh, pit, ph, r1, r2, r3, slot, ev, batEv, hit, rbi, evn] = v
    if (batEv !== 'T') continue
    const pk = gamePkOf.get(gid); if (pk === undefined) continue
    const rg = raw.get(gid); const rp = rg.plays[+evn - 1]
    if (!rp) { mismatch.nplay++; continue }
    if (rp[1] !== pseq) mismatch.pseq++
    const countKnown = /^\d\d$/.test(rp[0]) // unknown is '??' (1961-83) or an empty field (1984-87)
    if (!seenGame.has(gid)) { seenGame.add(gid); st.games[rg.info.pitches] = (st.games[rg.info.pitches] ?? 0) + 1 }
    const half = +batTeam; const month = +gid.slice(7, 9)
    const jan1 = Date.UTC(y, 0, 1); const doy = Math.round((Date.UTC(y, month - 1, +gid.slice(9, 11)) - jan1) / 864e5)
    rows.push({ gid, pk, doy, evn: +evn, inn: +inn, half, outs: +outs, balls: countKnown ? +balls : -1, strikes: countKnown ? +strikes : -1, pseq,
      bat: mlbam(bat), pit: mlbam(pit), bh, ph, bases: (r1 ? 1 : 0) | (r2 ? 2 : 0) | (r3 ? 4 : 0), bsd: half ? +hs - +vs : +vs - +hs,
      slot: +slot, ev: +ev, hit: +hit, rbi: +rbi, month })
    // Pitch-string completeness. Markers (digits, + * . >) are not pitches.
    st.pas++; if (countKnown) st.countKnown++
    if (pseq) {
      st.pseqFilled++
      const s = pseq.replace(/[^BCFHIKLMNOPQRSTUVXY?]/g, '')
      st.pitchTotal += s.length
      const unknown = /[U?]/.test(s); if (unknown) st.hasUnknown++
      let b = 0, k = 0
      for (const c of s) { if ('BIPV'.includes(c)) b++; else if ('CSKMQLOT'.includes(c)) k++; else if ('FR'.includes(c) && k < 2) k++ }
      const last = s.at(-1) ?? ''
      let cls = null, ok = false
      if (+ev === 3) { cls = 'K'; ok = k >= 3 }
      else if (+ev === 14) { cls = 'W'; ok = b >= 4 }
      else if (+ev === 16) { cls = 'HBP'; ok = last === 'H' }
      else if ([2, 18, 19, 20, 21, 22, 23].includes(+ev)) { cls = 'BIP'; ok = last === 'X' || last === 'Y' }
      if (cls) { st.cls[cls][0]++; if (ok) st.cls[cls][1]++ }
      if (!unknown && cls && ok) st.complete++
    }
    for (const g of [gid]) if (!rows.gidSeen) rows.gidSeen = new Set()
    if (!rows.gidSeen.has(gid)) {
      rows.gidSeen.add(gid)
      const sg = sched.get(pk)
      gameIndex.push({ gamePk: pk, season: y, doy, home: sg.home, away: sg.away, site: rg.info.site, num: +rg.info.number, dn: rg.info.daynight === 'night' ? 1 : 0,
        dh: rg.info.usedh === 'true' ? 1 : 0, pit: ['none', 'count', 'pitches'].indexOf(rg.info.pitches), hr: sg.homeRuns, ar: sg.awayRuns, att: +rg.info.attendance || 0 })
    }
  }
  rows.sort((a, b) => a.doy - b.doy || a.pk - b.pk || a.evn - b.evn)
  for (const r of rows) {
    const i = N++
    T.gamePk[i] = r.pk; T.ab[i] = r.evn; T.batter[i] = r.bat; T.pitcher[i] = r.pit; T.event[i] = r.ev; T.inn[i] = r.inn; T.half[i] = r.half
    T.outs[i] = r.outs; T.bases[i] = r.bases; T.balls[i] = r.balls; T.strikes[i] = r.strikes; T.bsd[i] = r.bsd; T.slot[i] = r.slot; T.hit[i] = r.hit; T.rbi[i] = r.rbi
    T.stand[i] = Math.max(0, HAND.indexOf(r.bh)); T.throws[i] = Math.max(0, HAND.indexOf(r.ph))
    let id = dictId.get(r.pseq); if (id === undefined) { id = dict.length; dict.push(r.pseq); dictId.set(r.pseq, id) }
    T.pseq[i] = id; T.season[i] = y; T.month[i] = r.month
  }
  st.mismatch = mismatch
  seasonStats.push(st)
  console.log(y, st.pas, 'PAs', 'pseq', (100 * st.pseqFilled / st.pas).toFixed(1) + '%', 'count', (100 * st.countKnown / st.pas).toFixed(1) + '%', 'complete', (100 * st.complete / st.pas).toFixed(1) + '%', JSON.stringify(mismatch))
}
console.log('total PAs', N, 'distinct pitch strings', dict.length)

// ---- serialization ----
const GET = {
  gamePk: i => T.gamePk[i], ab: i => T.ab[i], batter: i => T.batter[i], pitcher: i => T.pitcher[i], event: i => T.event[i], inn: i => T.inn[i],
  half: i => T.half[i], outs: i => T.outs[i], bases: i => T.bases[i], balls: i => (T.balls[i] < 0 ? null : T.balls[i]),
  strikes: i => (T.strikes[i] < 0 ? null : T.strikes[i]), pseq: i => dict[T.pseq[i]], bsd: i => T.bsd[i], slot: i => T.slot[i], hit: i => T.hit[i], rbi: i => T.rbi[i],
  stand: i => HAND[T.stand[i]], throws: i => HAND[T.throws[i]],
}
const MIN = ['gamePk', 'ab', 'batter', 'pitcher', 'event', 'inn', 'half', 'outs', 'bases', 'balls', 'strikes']
const PS = [...MIN, 'pseq']
const RICH = [...PS, 'stand', 'throws', 'bsd', 'slot', 'hit', 'rbi']
const CORE_ONLY = MIN
function ser(meta, names, idxs) {
  const c = names.map(n => { const g = GET[n]; const a = new Array(idxs.length); for (let k = 0; k < idxs.length; k++) a[k] = g(idxs[k]); return a })
  return JSON.stringify({ ...meta, cols: names, c })
}
const gz = s => gzipSync(s, { level: 9 }).length
const range = (lo, hi) => { const a = new Int32Array(hi - lo); for (let k = 0; k < a.length; k++) a[k] = lo + k; return a }
const dist = arr => { const a = [...arr].sort((x, y) => x - y); const q = p => a[Math.min(a.length - 1, Math.floor(p * a.length))]; return { n: a.length, total: a.reduce((s, x) => s + x, 0), min: a[0], p50: q(0.5), p90: q(0.9), p99: q(0.99), max: a.at(-1) } }

// shards = (season, month) runs
const shards = []
for (let i = 0; i < N;) {
  let j = i; while (j < N && T.season[j] === T.season[i] && T.month[j] === T.month[i]) j++
  shards.push({ season: T.season[i], month: T.month[i], lo: i, hi: j }); i = j
}
const shardOfRow = new Int16Array(N); shards.forEach((s, k) => { for (let i = s.lo; i < s.hi; i++) shardOfRow[i] = k })
console.log('shards', shards.length)

const R = { seasonStats, N, shardsN: shards.length }
// Q1: sizes per variant, month shards
const VARS = { min: MIN, 'min+pseq': PS, 'rich+pseq': RICH }
R.variant = {}
for (const [vn, cols] of Object.entries(VARS)) R.variant[vn] = { raw: 0, gz: 0, perSeason: {} }
for (const s of shards) {
  const idx = range(s.lo, s.hi)
  for (const [vn, cols] of Object.entries(VARS)) {
    const j = ser({ season: s.season, month: s.month }, cols, idx); const g = gz(j)
    R.variant[vn].raw += j.length; R.variant[vn].gz += g
    const ps = R.variant[vn].perSeason[s.season] ??= { pas: 0, raw: 0, gz: 0 }
    ps.pas += s.hi - s.lo; ps.raw += j.length; ps.gz += g
    if (vn === 'min+pseq') { s.gzPS = g; s.rawPS = j.length }
  }
}
console.log('variants', JSON.stringify(Object.fromEntries(Object.entries(R.variant).map(([k, v]) => [k, [v.raw, v.gz]]))))
R.shardGz = dist(shards.map(s => s.gzPS)); R.shardRaw = dist(shards.map(s => s.rawPS))
R.shardList = shards.map(s => [s.season, s.month, s.hi - s.lo, s.rawPS, s.gzPS])

// split: core (no pseq) vs pseq-only files, month shards
let coreGz = 0, pseqGz = 0
for (const s of shards) {
  const idx = range(s.lo, s.hi)
  coreGz += gz(ser({ season: s.season, month: s.month }, MIN, idx))
  pseqGz += gz(JSON.stringify({ season: s.season, month: s.month, pseq: Array.from(idx, i => dict[T.pseq[i]]) }))
}
R.split = { coreGz, pseqGz }
console.log('split core', coreGz, 'pseq', pseqGz)

// per-season single files (PS)
const bySeason = new Map()
for (const s of shards) { const a = bySeason.get(s.season) ?? [s.lo, s.hi]; a[1] = s.hi; bySeason.set(s.season, a) }
const seasonFiles = []
for (const [y, [lo, hi]] of bySeason) { const j = ser({ season: y }, PS, range(lo, hi)); seasonFiles.push({ season: y, raw: j.length, gz: gz(j), br: null, str: null }) }
R.seasonFile = { gz: dist(seasonFiles.map(f => f.gz)), raw: dist(seasonFiles.map(f => f.raw)), list: seasonFiles.map(f => [f.season, f.raw, f.gz]) }
console.log('season files', JSON.stringify(R.seasonFile.gz))

// brotli sample (month shards, PS) for a few seasons
R.brotli = []
for (const y of [1961, 1975, 1987, 1995, 2005, 2014]) {
  let raw = 0, g = 0, b = 0
  for (const s of shards.filter(s => s.season === y)) {
    const j = ser({ season: y, month: s.month }, PS, range(s.lo, s.hi)); raw += j.length; g += gz(j)
    b += brotliCompressSync(j, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: j.length } }).length
  }
  R.brotli.push({ season: y, raw, gz: g, br: b })
  console.log('brotli', y, raw, g, b)
}

// game index
const idxSer = gs => JSON.stringify({ cols: ['gamePk', 'doy', 'home', 'away', 'site', 'num', 'dn', 'dh', 'pit', 'hr', 'ar', 'att'], c: ['gamePk', 'doy', 'home', 'away', 'site', 'num', 'dn', 'dh', 'pit', 'hr', 'ar', 'att'].map(k => gs.map(g => g[k])) })
gameIndex.sort((a, b) => a.season - b.season || a.doy - b.doy || a.gamePk - b.gamePk)
const idxPerSeason = []
for (let y = FIRST; y <= LAST; y++) { const j = idxSer(gameIndex.filter(g => g.season === y)); idxPerSeason.push({ season: y, games: gameIndex.filter(g => g.season === y).length, raw: j.length, gz: gz(j) }) }
const idxAll = idxSer(gameIndex)
R.gameIndex = { games: gameIndex.length, perSeasonGzTotal: idxPerSeason.reduce((s, x) => s + x.gz, 0), perSeasonRawTotal: idxPerSeason.reduce((s, x) => s + x.raw, 0), allRaw: idxAll.length, allGz: gz(idxAll), perSeason: idxPerSeason,
  sites: new Set(gameIndex.map(g => g.site)).size, clubs: new Set(gameIndex.flatMap(g => [g.home, g.away])).size }
console.log('game index', JSON.stringify({ ...R.gameIndex, perSeason: undefined }))

// grouped file layouts (PS columns)
function grouped(label, keyOf, drop) {
  const groups = new Map()
  for (let i = 0; i < N; i++) { const ks = keyOf(i); for (const k of Array.isArray(ks) ? ks : [ks]) { if (k == null) continue; let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(i) } }
  const names = PS.filter(n => n !== drop)
  const gzs = []; let raw = 0
  for (const [k, a] of groups) { const j = ser({ key: k }, names, a); raw += j.length; gzs.push(gz(j)) }
  const d = dist(gzs); R[label] = { files: gzs.length, raw, ...d }
  console.log(label, JSON.stringify(R[label])); return groups
}
const pkTeams = new Map(); for (const g of gameIndex) pkTeams.set(g.gamePk, [g.home, g.away])
const pkSite = new Map(gameIndex.map(g => [g.gamePk, g.site]))
const byBatter = grouped('byBatter', i => T.batter[i] || null, 'batter')
const byPitcher = grouped('byPitcher', i => T.pitcher[i] || null, 'pitcher')
grouped('byPark', i => pkSite.get(T.gamePk[i]), null)
grouped('byBattingClubSeason', i => { const t = pkTeams.get(T.gamePk[i]); return `${T.season[i]}:${T.half[i] ? t[0] : t[1]}` }, null)
grouped('byBothClubsSeason', i => { const t = pkTeams.get(T.gamePk[i]); return [`${T.season[i]}:${t[0]}`, `${T.season[i]}:${t[1]}`] }, null)

// shards a batter / pitcher touches, and the bytes to read through month shards
function touch(col) {
  const m = new Map()
  for (let i = 0; i < N; i++) { const p = T[col][i]; if (!p) continue; let s = m.get(p); if (!s) m.set(p, s = new Set()); s.add(shardOfRow[i]) }
  const counts = [], bytes = []
  for (const s of m.values()) { counts.push(s.size); let b = 0; for (const k of s) b += shards[k].gzPS; bytes.push(b) }
  return { shardsTouched: dist(counts), bytesViaMonthShards: dist(bytes), map: m }
}
const tb = touch('batter'), tp = touch('pitcher')
R.touchBatter = { shardsTouched: tb.shardsTouched, bytes: tb.bytesViaMonthShards }; R.touchPitcher = { shardsTouched: tp.shardsTouched, bytes: tp.bytesViaMonthShards }
// inverted index person -> shard numbers
const inv = col => JSON.stringify(Object.fromEntries([...(col === 'batter' ? tb : tp).map].map(([p, s]) => [p, [...s].sort((a, b) => a - b)])))
const ib = inv('batter'), ip = inv('pitcher')
R.invIndex = { batterRaw: ib.length, batterGz: gz(ib), pitcherRaw: ip.length, pitcherGz: gz(ip) }
console.log('inv index', JSON.stringify(R.invIndex))
// named players
const NAMES = { rosep001: 'Pete Rose', aaroh101: 'Hank Aaron', bondb001: 'Barry Bonds', jeted001: 'Derek Jeter', ryann001: 'Nolan Ryan', clemr001: 'Roger Clemens', riverm001: 'Mariano Rivera', kersc001: 'Clayton Kershaw', trouM001: 'Mike Trout' }
R.named = []
for (const [retro, name] of Object.entries(NAMES)) {
  const id = mlbam(retro); if (!id) continue
  const rowsB = byBatter.get(id), rowsP = byPitcher.get(id)
  const rec = { name, retro, mlbam: id }
  for (const [role, groups, tt, drop] of [['batter', byBatter, tb, 'batter'], ['pitcher', byPitcher, tp, 'pitcher']]) {
    const a = groups.get(id); if (!a) continue
    const j = ser({ key: id }, PS.filter(n => n !== drop), a)
    const sh = tt.map.get(id); let b = 0; for (const k of sh) b += shards[k].gzPS
    rec[role] = { pas: a.length, personFileGz: gz(j), shardsTouched: sh.size, bytesViaMonthShards: b }
  }
  R.named.push(rec)
}
console.log(JSON.stringify(R.named))

// timing: parse + scan, Node on this container
{
  const files = [...bySeason].map(([y, [lo, hi]]) => ser({ season: y }, PS, range(lo, hi)))
  let tParse = 0, tScan = 0, hits = 0
  for (const j of files) {
    const t0 = performance.now(); const o = JSON.parse(j); const t1 = performance.now()
    const [outs, bases, balls, strikes] = ['outs', 'bases', 'balls', 'strikes'].map(n => o.c[o.cols.indexOf(n)])
    for (let i = 0; i < outs.length; i++) if (outs[i] === 2 && bases[i] === 7 && balls[i] === 3 && strikes[i] === 2) hits++
    const t2 = performance.now(); tParse += t1 - t0; tScan += t2 - t1
  }
  R.timing = { files: files.length, parseMs: Math.round(tParse), scanMs: Math.round(tScan), hits, rawBytes: files.reduce((s, f) => s + f.length, 0) }
  console.log('timing', JSON.stringify(R.timing))
}

// "last time" scans, newest shard first: how many shards until the first match
const lastTime = (label, pred) => {
  let r = -1; for (let i = N - 1; i >= 0; i--) if (pred(i)) { r = i; break }
  if (r < 0) return { label, found: false }
  let b = 0, n = 0; for (let k = shards.length - 1; k >= shardOfRow[r]; k--) { b += shards[k].gzPS; n++ }
  let total = 0; for (let i = 0; i < N; i++) if (pred(i)) total++
  return { label, found: true, season: T.season[r], month: T.month[r], gamePk: T.gamePk[r], shardsRead: n, bytesGz: b, matches: total }
}
R.lastTime = [
  lastTime('K, bases loaded, 2 outs, 3-2 count', i => T.event[i] === 3 && T.bases[i] === 7 && T.outs[i] === 2 && T.balls[i] === 3 && T.strikes[i] === 2),
  lastTime('HR on an 0-2 count', i => T.event[i] === 23 && T.balls[i] === 0 && T.strikes[i] === 2),
  lastTime('HR, bases loaded, 2 outs, 3-2 count, 9th or later', i => T.event[i] === 23 && T.bases[i] === 7 && T.outs[i] === 2 && T.balls[i] === 3 && T.strikes[i] === 2 && T.inn[i] >= 9),
  lastTime('HR, bases loaded, bottom 9th or later, trailing by 3 (walk-off grand slam)', i => T.event[i] === 23 && T.bases[i] === 7 && T.half[i] === 1 && T.inn[i] >= 9 && T.bsd[i] === -3),
]
console.log(JSON.stringify(R.lastTime))
writeFileSync(outJson, JSON.stringify(R, null, 1))
console.log('done')
