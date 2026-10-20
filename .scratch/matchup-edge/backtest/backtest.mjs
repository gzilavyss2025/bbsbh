// Backtest of the Matchup Edge model (#1688, plan step 2).
// Usage: node backtest.mjs <dir of pull.mjs day files>
//
// For each split: build the model's inputs (hitter by pitch, league by pitch and cell,
// pitcher mix and cells by batter side) from the pitches BEFORE the split date, then
// predict every plate appearance in the test window and score the predictions.
// Questions: does the model rank a pitcher's opposing hitters better than the hitter's
// plain season line vs that hand? Which shrinkage constants are best? Does the
// location factor help?
import { readdirSync, readFileSync } from 'node:fs'
import { commandCell, normalizePitch } from '../../../src/lib/zone/zoneGeometry.js'

const dir = process.argv[2]
if (!dir) throw new Error('usage: node backtest.mjs <dataDir>')

// BT_SPLITS='[{"name":"A","train":"…","testEnd":"…"}]' overrides, for a smoke run on part of the season.
const SPLITS = process.env.BT_SPLITS ? JSON.parse(process.env.BT_SPLITS) : [
  { name: 'A', train: '2026-07-01', testEnd: '2026-08-01' }, // tune here
  { name: 'B', train: '2026-08-01', testEnd: '2026-10-01' }, // confirm here
]
const KS_X = [0, 15, 30, 60, 120, 250, 500, 1000]
const KS_W = [0, 25, 75, 150, 300, 600]
const MIN_PITCHER = 30 // pitches of a type to a side, as in matchup-model.mjs
const BOOT = 300

const SWING = new Set(['swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play', 'foul_bunt', 'missed_bunt', 'bunt_foul_tip'])
const WHIFF = new Set(['swinging_strike', 'swinging_strike_blocked', 'foul_tip', 'missed_bunt', 'bunt_foul_tip'])
const SKIP = new Set(['', 'PO', 'IN', 'FA', 'UN'])

// ---- load
const pitches = []
for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
  for (const r of JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))) {
    const [date, pk, ab, pitcher, batter, stand, throws, code, px, pz, top, bot, desc, , wv, wd, xw] = r
    if (SKIP.has(code) || !'LR'.includes(stand) || !'LR'.includes(throws) || !stand || !throws) continue
    const cell = commandCell(normalizePitch(+px, +pz, +top, +bot))
    const pa = wd === '1'
    pitches.push({
      date, pa: `${pk}:${ab}`, pitcher: +pitcher, batter: +batter, stand, throws, code,
      cell: cell ? cell.index : -1,
      swing: SWING.has(desc), whiff: WHIFF.has(desc),
      paEnd: pa,
      // xwOBA value of a PA-ending pitch: Savant's estimate on a tracked ball in play, else the wOBA value.
      x: !pa ? 0 : desc === 'hit_into_play' && xw !== '' ? +xw : +wv || 0,
    })
  }
}
console.log(`loaded ${pitches.length} pitches, ${pitches.filter((p) => p.paEnd).length} PA`)

const sum = (a) => a.reduce((s, v) => s + v, 0)
const z25 = () => new Array(25).fill(0)
const get = (m, k, mk) => (m.has(k) ? m.get(k) : (m.set(k, mk()), m.get(k)))
const blank = () => ({ p: 0, pa: 0, x: 0, sw: 0, wh: 0 })
const add = (b, p) => { b.p++; b.sw += p.swing; b.wh += p.whiff; if (p.paEnd) { b.pa++; b.x += p.x } }

function build(train) {
  const hit = new Map() // batter:code:hand:side
  const hitAll = new Map() // batter:hand:side
  const lg = new Map() // code:hand:side -> blank + cells
  const lgAll = new Map() // hand:side
  const pit = new Map() // pitcher:side -> Map code -> {n, cells}
  for (const p of train) {
    add(get(hit, `${p.batter}:${p.code}:${p.throws}:${p.stand}`, blank), p)
    add(get(hitAll, `${p.batter}:${p.throws}:${p.stand}`, blank), p)
    add(get(lgAll, `${p.throws}:${p.stand}`, blank), p)
    const L = get(lg, `${p.code}:${p.throws}:${p.stand}`, () => ({ ...blank(), cp: z25(), cx: z25(), cw: z25() }))
    add(L, p)
    if (p.cell >= 0) {
      L.cp[p.cell]++; L.cw[p.cell] += p.whiff
      if (p.paEnd) L.cx[p.cell] += p.x
      const P = get(get(pit, `${p.pitcher}:${p.stand}`, () => new Map()), p.code, () => ({ n: 0, cells: z25() }))
      P.n++; P.cells[p.cell]++
    }
  }
  return { hit, hitAll, lg, lgAll, pit }
}

// The pitch rows of one pitcher to one side: mix, weights and location factors.
function pitcherRows(m, pitcher, hand, side) {
  const P = m.pit.get(`${pitcher}:${side}`)
  if (!P) return null
  const kept = [...P].filter(([c, v]) => v.n >= MIN_PITCHER && m.lg.has(`${c}:${hand}:${side}`))
  const tot = sum(kept.map(([, v]) => v.n))
  if (!tot) return null
  return kept.map(([c, v]) => {
    const L = m.lg.get(`${c}:${hand}:${side}`)
    let xr = 0, wr = 0
    for (let i = 0; i < 25; i++) {
      if (!L.cp[i] || !v.cells[i]) continue
      const f = v.cells[i] / v.n
      xr += f * (L.cx[i] / L.cp[i]); wr += f * (L.cw[i] / L.cp[i])
    }
    const mix = v.n / tot
    return {
      c, L, mix,
      lgx: L.x / L.pa, lgw: L.wh / L.sw,
      wx: mix * (L.pa / L.p), ww: mix * (L.sw / L.p),
      xf: xr / (L.x / L.p), wf: wr / (L.wh / L.p),
    }
  })
}

// own = { x, w }: the hitter's own shrunk season level as a ratio to the league (1 = shrink each
// pitch to the league, as matchup-model.mjs does; the "hier" variant shrinks to the hitter instead).
function predict(m, rows, batter, hand, side, kx, kw, loc, own = { x: 1, w: 1 }) {
  let ex = 0, sx = 0, ew = 0, sw = 0, base = 0
  for (const r of rows) {
    const h = m.hit.get(`${batter}:${r.c}:${hand}:${side}`) ?? blank()
    const px = r.lgx * own.x, pw0 = r.lgw * own.w
    const hx = (h.x + kx * px) / (h.pa + kx || 1)
    const hw = (h.wh + kw * pw0) / (h.sw + kw || 1)
    const pa = h.pa + kx ? hx : px
    const pw = h.sw + kw ? hw : pw0
    ex += r.wx * pa * (loc ? r.xf : 1); sx += r.wx; base += r.wx * r.lgx
    ew += r.ww * pw * (loc ? r.wf : 1); sw += r.ww
  }
  return { x: ex / sx, w: ew / sw, mixLg: base / sx }
}

// ---- scoring helpers
// Within-pitcher: subtract each test pitcher's PA-weighted mean from outcome and predictions,
// so a pitcher's quality (which the plain season line ignores) cannot win the comparison.
// That leaves the question the page asks: which of HIS opponents does best against him?
function demean(rows, keys) {
  const by = new Map()
  for (const r of rows) get(by, r.g, () => []).push(r)
  for (const g of by.values()) for (const k of keys) {
    const mu = sum(g.map((r) => r[k])) / g.length
    for (const r of g) r[`d_${k}`] = r[k] - mu
  }
}
const mse = (rows, k) => sum(rows.map((r) => (r.y - r[k]) ** 2)) / rows.length
const corr = (rows, a, b) => {
  const ma = sum(rows.map((r) => r[a])) / rows.length, mb = sum(rows.map((r) => r[b])) / rows.length
  let sab = 0, saa = 0, sbb = 0
  for (const r of rows) { const da = r[a] - ma, db = r[b] - mb; sab += da * db; saa += da * da; sbb += db * db }
  return sab / Math.sqrt(saa * sbb)
}
// OLS of y on two regressors, no intercept (all demeaned).
function ols2(rows, y, a, b) {
  let aa = 0, bb = 0, ab = 0, ay = 0, by = 0
  for (const r of rows) { aa += r[a] ** 2; bb += r[b] ** 2; ab += r[a] * r[b]; ay += r[a] * r[y]; by += r[b] * r[y] }
  const det = aa * bb - ab * ab
  return [(bb * ay - ab * by) / det, (aa * by - ab * ay) / det]
}
// Bootstrap by batter: resample whole hitters, so one hitter's many PA count once.
function boot(rows, stat, seed = 1) {
  let s = seed
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const by = [...rows.reduce((m, r) => get(m, r.batter, () => []).push(r) && m, new Map()).values()]
  const out = []
  for (let i = 0; i < BOOT; i++) {
    const pick = []
    for (let j = 0; j < by.length; j++) pick.push(...by[Math.floor(rnd() * by.length)])
    out.push(stat(pick))
  }
  out.sort((x, y) => x - y)
  return [out[Math.floor(BOOT * 0.025)], out[Math.floor(BOOT * 0.975)]]
}
const f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3)
const f4 = (v) => (v >= 0 ? '+' : '') + v.toFixed(4)

// ---- run
const results = {}
for (const sp of SPLITS) {
  const train = pitches.filter((p) => p.date < sp.train)
  const test = pitches.filter((p) => p.date >= sp.train && p.date < sp.testEnd)
  const m = build(train)
  const rowsCache = new Map()
  // One record per test PA (xwOBA) and per test swing (whiff).
  const pas = [], swings = []
  for (const p of test) {
    const key = `${p.pitcher}:${p.throws}:${p.stand}`
    if (!rowsCache.has(key)) rowsCache.set(key, pitcherRows(m, p.pitcher, p.throws, p.stand))
    const rows = rowsCache.get(key)
    if (!rows) continue
    const rec = { g: p.pitcher, batter: p.batter, hand: p.throws, side: p.stand, rows }
    if (p.paEnd) pas.push({ ...rec, y: p.x })
    if (p.swing) swings.push({ ...rec, y: +p.whiff })
  }
  const pitchersIn = new Set(pas.map((r) => r.g)).size
  console.log(`\n=== split ${sp.name}: train < ${sp.train} (${train.length} pitches), test to ${sp.testEnd}: ${pas.length} PA, ${swings.length} swings, ${pitchersIn} pitchers with a train profile`)

  // Season line vs this hand and side, shrunk to the league with constant k.
  const season = (r, k) => {
    const h = m.hitAll.get(`${r.batter}:${r.hand}:${r.side}`) ?? blank()
    const L = m.lgAll.get(`${r.hand}:${r.side}`)
    return (h.x + k * (L.x / L.pa)) / (h.pa + k || 1) || L.x / L.pa
  }
  const seasonW = (r, k) => {
    const h = m.hitAll.get(`${r.batter}:${r.hand}:${r.side}`) ?? blank()
    const L = m.lgAll.get(`${r.hand}:${r.side}`)
    return (h.wh + k * (L.wh / L.sw)) / (h.sw + k || 1) || L.wh / L.sw
  }

  const ownOf = (r) => {
    const L = m.lgAll.get(`${r.hand}:${r.side}`)
    return { x: season(r, 120) / (L.x / L.pa), w: seasonW(r, 75) / (L.wh / L.sw) }
  }

  // -- xwOBA: tune K for each predictor on within-pitcher MSE.
  const table = []
  for (const k of KS_X) {
    for (const r of pas) {
      r.season = season(r, k)
      const mo = predict(m, r.rows, r.batter, r.hand, r.side, k, 75, false)
      const ml = predict(m, r.rows, r.batter, r.hand, r.side, k, 75, true)
      r.mix = mo.x; r.loc = ml.x; r.lg = mo.mixLg
      r.hier = predict(m, r.rows, r.batter, r.hand, r.side, k, 75, false, ownOf(r)).x
    }
    demean(pas, ['y', 'season', 'mix', 'loc', 'lg', 'hier'])
    const base = mse(pas.map((r) => ({ y: r.d_y, p: 0 })), 'p')
    const skill = (k2) => 1e4 * (1 - mse(pas.map((r) => ({ y: r.d_y, p: r[`d_${k2}`] })), 'p') / base)
    table.push({ k, season: skill('season'), mix: skill('mix'), loc: skill('loc'), hier: skill('hier') })
  }
  console.log('xwOBA, within-pitcher skill (MSE cut vs "every hitter the same", in units of 0.01%; higher is better)')
  console.log('K_X    season-line   model-no-loc   model+loc   hier (pitch shrunk to own line)')
  for (const t of table) console.log(String(t.k).padEnd(6), t.season.toFixed(2).padStart(11), t.mix.toFixed(2).padStart(14), t.loc.toFixed(2).padStart(11), t.hier.toFixed(2).padStart(10))
  results[sp.name] = { table }

  // -- The incremental test at the K picked in split A (or this split's best when this is A).
  const pick = (col) => (results.A.table.reduce((b, t) => (t[col] > b[col] ? t : b))).k
  const kS = pick('season'), kM = pick('mix'), kL = pick('loc'), kH = pick('hier')
  for (const r of pas) {
    r.season = season(r, kS)
    r.mix = predict(m, r.rows, r.batter, r.hand, r.side, kM, 75, false).x
    r.loc = predict(m, r.rows, r.batter, r.hand, r.side, kL, 75, true).x
    r.mixPart = r.mix - r.season
    r.locPart = r.loc - r.season
    r.hier = predict(m, r.rows, r.batter, r.hand, r.side, kH, 75, false, ownOf(r)).x
    r.hierPart = r.hier - r.season
  }
  demean(pas, ['y', 'season', 'mix', 'loc', 'mixPart', 'locPart', 'hier', 'hierPart'])
  console.log(`K picked on split A: season-line ${kS}, model-no-loc ${kM}, model+loc ${kL}, hier ${kH}`)
  for (const [name, col, part] of [['model-no-loc', 'mix', 'mixPart'], ['model+loc', 'loc', 'locPart'], ['hier', 'hier', 'hierPart']]) {
    const [bS, bP] = ols2(pas, 'd_y', 'd_season', `d_${part}`)
    const ci = boot(pas, (rs) => ols2(rs, 'd_y', 'd_season', `d_${part}`)[1])
    const dc = corr(pas, 'd_y', `d_${col}`) - corr(pas, 'd_y', 'd_season')
    const ciC = boot(pas, (rs) => corr(rs, 'd_y', `d_${col}`) - corr(rs, 'd_y', 'd_season'), 7)
    console.log(`${name}: within-pitcher corr ${corr(pas, 'd_y', `d_${col}`).toFixed(4)} vs season-line ${corr(pas, 'd_y', 'd_season').toFixed(4)}, gain ${f4(dc)} [95% ${f4(ciC[0])}, ${f4(ciC[1])}]`)
    console.log(`   y ~ season + (model - season): season coef ${bS.toFixed(2)}, matchup-part coef ${bP.toFixed(2)} [95% ${ci[0].toFixed(2)}, ${ci[1].toFixed(2)}] (1 = the matchup part is right-sized, 0 = noise)`)
    const sd = Math.sqrt(sum(pas.map((r) => r[`d_${part}`] ** 2)) / pas.length)
    console.log(`   size of the matchup part: sd ${sd.toFixed(4)} xwOBA`)
  }
  // Side bias: does the model mis-rank lefties vs righties against a pitcher?
  for (const side of ['L', 'R']) {
    const s = pas.filter((r) => r.side === side)
    console.log(`   batter side ${side}: mean demeaned outcome ${f3(sum(s.map((r) => r.d_y)) / s.length)}, season-line ${f3(sum(s.map((r) => r.d_season)) / s.length)}, model+loc ${f3(sum(s.map((r) => r.d_loc)) / s.length)}`)
  }

  // -- whiff per swing
  const wt = []
  for (const k of KS_W) {
    for (const r of swings) {
      r.season = seasonW(r, k)
      r.mix = predict(m, r.rows, r.batter, r.hand, r.side, 60, k, false).w
      r.loc = predict(m, r.rows, r.batter, r.hand, r.side, 60, k, true).w
      r.hier = predict(m, r.rows, r.batter, r.hand, r.side, 60, k, false, ownOf(r)).w
    }
    demean(swings, ['y', 'season', 'mix', 'loc', 'hier'])
    const base = mse(swings.map((r) => ({ y: r.d_y, p: 0 })), 'p')
    const skill = (k2) => 1e4 * (1 - mse(swings.map((r) => ({ y: r.d_y, p: r[`d_${k2}`] })), 'p') / base)
    wt.push({ k, season: skill('season'), mix: skill('mix'), loc: skill('loc'), hier: skill('hier') })
  }
  console.log('whiff per swing, within-pitcher skill (same units)')
  console.log('K_W    season-line   model-no-loc   model+loc   hier')
  for (const t of wt) console.log(String(t.k).padEnd(6), t.season.toFixed(2).padStart(11), t.mix.toFixed(2).padStart(14), t.loc.toFixed(2).padStart(11), t.hier.toFixed(2).padStart(10))
  results[sp.name].whiff = wt
}
