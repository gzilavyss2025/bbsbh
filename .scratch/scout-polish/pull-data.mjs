// Rebuilds pair-601713-694192.json, the data the mockup embeds.
// Run from the repo root: node .scratch/scout-polish/pull-data.mjs [pitcherId] [hitterId]
// It runs the scout's OWN pure functions (loadScout, pitcherBoard, hitterSide)
// against the nightly stores in public/data, then adds every head-to-head
// pitch from Baseball Savant and each pitch's playId from the statsapi game feed.
import fs from 'node:fs'
import path from 'node:path'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const ROOT = process.cwd()
const pitcherId = Number(process.argv[2] ?? 601713)
const hitterId = Number(process.argv[3] ?? 694192)
const realFetch = globalThis.fetch
globalThis.window ??= { location: { origin: 'http://localhost' } }
// The app reads its stores at /data/...; serve them from public/data.
globalThis.fetch = async (u, o) => {
  const s = String(u)
  const m = s.match(/\/data\/(.+?)(\?.*)?$/)
  if (m && !s.includes('mlb.com')) {
    const p = path.join(ROOT, 'public/data', m[1])
    if (!fs.existsSync(p)) return new Response('nf', { status: 404 })
    return new Response(fs.readFileSync(p), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return realFetch(u, o)
}
const src = (p) => path.join(ROOT, 'src', p)
const { loadScout } = await import(src('screens/scout/loadScout.js'))
const { pitcherBoard } = await import(src('screens/scout/board.js'))
const { hitterSide, metricsFor } = await import(src('screens/scout/hitterBoard.js'))
const { stanceFor } = await import(src('lib/scout/roles.js'))
const { fetchHeadToHead, savantUrl } = await import(src('api/scout/headToHead.js'))
const { csvObjects } = await import(src('lib/csv/parse.js'))
const { baseballToday } = await import(src('lib/time/standingsDates.js'))

const d = await loadScout(pitcherId, hitterId)
if (!d) throw new Error('loadScout returned null')
const stance = stanceFor(d.hitter.bats, d.pitcher.throws)
const board = pitcherBoard({ arsenal: d.arsenal, command: d.command, pitcherId, stance, scope: 'reg' })
const out = {
  types: board.types.map(({ code, name, family, pct, mph }) => ({ code, name, family, pct, mph })),
  pmap: Object.fromEntries([['ALL', board.all], ...Object.entries(board.byType)].map(([c, m]) => [c, { n: m.n, thin: m.thin, share: m.share, regionN: m.regionN }])),
  hit: {},
}
for (const metric of metricsFor(d.grid)) {
  const s = hitterSide({ board, grid: d.grid, league: d.league, hand: null, stand: d.hitter.bats, scope: 'reg', metric })
  out.hit[metric] = { overall: s.overall, ALL: { cells: s.all.cells, seen: s.all.seen } }
  for (const [c, v] of Object.entries(s.byType)) out.hit[metric][c] = { cells: v.cells, seen: v.seen, exp: v.exp, league: v.league, typeVal: v.typeVal, leagueFlat: v.leagueFlat }
}

// Every pitch of every meeting (the page's own Savant URL), plus playIds.
const today = baseballToday()
const h2h = await fetchHeadToHead(hitterId, pitcherId, today)
out.totals = h2h?.totals ?? null
const rows = csvObjects(await (await realFetch(savantUrl(hitterId, pitcherId, today))).text()).filter((r) => r.plate_x)
const playIds = new Map()
for (const pk of new Set(rows.map((r) => r.game_pk))) {
  const feed = await getJson(`/api/v1.1/game/${pk}/feed/live`)
  for (const play of feed.liveData.plays.allPlays) {
    let n = 0
    for (const e of play.playEvents) if (e.isPitch) playIds.set(`${pk}-${play.about.atBatIndex + 1}-${++n}`, e.playId)
  }
}
const num = (v) => (v === '' || v == null ? null : Number(v))
const byPa = new Map()
for (const r of rows.sort((a, b) => a.game_pk - b.game_pk || a.at_bat_number - b.at_bat_number || a.pitch_number - b.pitch_number)) {
  const key = `${r.game_pk}-${r.at_bat_number}`
  if (!byPa.has(key)) byPa.set(key, { ab: Number(r.at_bat_number), gamePk: Number(r.game_pk), date: r.game_date, pitches: [] })
  byPa.get(key).pitches.push({
    n: Number(r.pitch_number), code: r.pitch_type, name: r.pitch_name, mph: num(r.release_speed), desc: r.description,
    b: Number(r.balls), s: Number(r.strikes), px: num(r.plate_x), pz: num(r.plate_z), szt: num(r.sz_top), szb: num(r.sz_bot),
    ev: r.events, ls: num(r.launch_speed), la: num(r.launch_angle), xw: num(r.estimated_woba_using_speedangle), inn: Number(r.inning),
    vx0: num(r.vx0), vy0: num(r.vy0), vz0: num(r.vz0), ax: num(r.ax), ay: num(r.ay), az: num(r.az),
    rx: num(r.release_pos_x), rz: num(r.release_pos_z), ry: num(r.release_pos_y), spin: num(r.release_spin_rate),
    pfx: num(r.pfx_x), pfz: num(r.pfx_z), playId: playIds.get(`${key}-${r.pitch_number}`) ?? null, des: r.des,
  })
}
out.h2h = { pas: [...byPa.values()] }
const file = path.join(ROOT, `.scratch/scout-polish/pair-${pitcherId}-${hitterId}.json`)
fs.writeFileSync(file, JSON.stringify(out))
console.log('wrote', file, out.h2h.pas.length, 'PAs')
