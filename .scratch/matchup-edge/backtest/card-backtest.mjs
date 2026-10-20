// Backtest of the World Series Pitch by pitch card's call (#1688 follow-up).
// Usage: node card-backtest.mjs <dir of pull.mjs day files> <statsapi season hitting stats json>
//
// The card (src/lib/postseason/worldseries/scouting/pitchByPitch.js) pools a club's nine
// regulars on one pitch type from one pitcher hand, both batter sides, and calls "Arm" or
// "Bats" when the pooled xwOBA is more than EDGE_BAND from the league's. Here the pooled
// figure is built before a split date, and the same nine hitters' figure on the same pitch
// and hand after it is the outcome. Question: does the call hold up?
import { readdirSync, readFileSync } from 'node:fs'

const [dir, statsFile] = process.argv.slice(2)
if (!dir || !statsFile) throw new Error('usage: node card-backtest.mjs <dataDir> <hitters.json>')

const SPLITS = [
  { name: 'A', train: '2026-07-01', testEnd: '2026-08-01' },
  { name: 'B', train: '2026-08-01', testEnd: '2026-10-01' },
]
const BANDS = [0.01, 0.02, 0.03, 0.05]
const MIN_PAS = [10, 30, 60, 100]
const REGULARS = 9
const BOOT = 500
const SKIP = new Set(['', 'PO', 'IN', 'FA', 'UN'])

// A hitter's club: the team row with the most PA (a traded hitter has one row per club).
const club = new Map()
for (const s of JSON.parse(readFileSync(statsFile, 'utf8')).stats[0].splits) {
  const id = s.player?.id, pa = Number(s.stat?.plateAppearances) || 0
  if (id == null || !s.team?.id) continue
  if (!club.has(id) || club.get(id).pa < pa) club.set(id, { team: s.team.id, pa })
}

const pas = []
for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
  for (const r of JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))) {
    const [date, , , , batter, , throws, code, , , , , desc, , wv, wd, xw] = r
    if (wd !== '1' || SKIP.has(code) || !'LR'.includes(throws) || !throws) continue
    pas.push({ date, batter: +batter, throws, code, x: desc === 'hit_into_play' && xw !== '' ? +xw : +wv || 0 })
  }
}

const sum = (a) => a.reduce((s, v) => s + v, 0)
const third = (v) => Math.round(v * 1000) / 1000
const get = (m, k, mk) => (m.has(k) ? m.get(k) : (m.set(k, mk()), m.get(k)))
const tally = (rows, keyOf) => {
  const m = new Map()
  for (const p of rows) { const k = keyOf(p); if (k == null) continue; const b = get(m, k, () => ({ pa: 0, x: 0 })); b.pa++; b.x += p.x }
  return m
}
const xw = (b) => (b && b.pa ? b.x / b.pa : null)

// Weighted least squares slope (with intercept) and weighted correlation.
function fit(cells, a, b, w = () => 1) {
  const W = sum(cells.map(w))
  const ma = sum(cells.map((c) => w(c) * c[a])) / W, mb = sum(cells.map((c) => w(c) * c[b])) / W
  let sab = 0, saa = 0, sbb = 0
  for (const c of cells) { const da = c[a] - ma, db = c[b] - mb; sab += w(c) * da * db; saa += w(c) * da * da; sbb += w(c) * db * db }
  return { slope: sab / saa, r: sab / Math.sqrt(saa * sbb) }
}
function boot(cells, stat, seed = 3) {
  let s = seed
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const by = [...cells.reduce((m, c) => get(m, c.team, () => []).push(c) && m, new Map()).values()]
  const out = []
  for (let i = 0; i < BOOT; i++) {
    const pick = []
    for (let j = 0; j < by.length; j++) pick.push(...by[Math.floor(rnd() * by.length)])
    out.push(stat(pick))
  }
  out.sort((x, y) => x - y)
  return `[${out[Math.floor(BOOT * 0.025)].toFixed(2)}, ${out[Math.floor(BOOT * 0.975)].toFixed(2)}]`
}

for (const sp of SPLITS) {
  const train = pas.filter((p) => p.date < sp.train)
  const test = pas.filter((p) => p.date >= sp.train && p.date < sp.testEnd)
  // The nine regulars: the club's hitters with the most PA before the split.
  const byBatter = tally(train, (p) => p.batter)
  const regs = new Map()
  for (const [b, v] of byBatter) { const c = club.get(b)?.team; if (c) get(regs, c, () => []).push([b, v.pa]) }
  const teamOf = new Map()
  for (const [c, list] of regs) for (const [b] of list.sort((x, y) => y[1] - x[1]).slice(0, REGULARS)) teamOf.set(b, c)
  const key = (p) => (teamOf.has(p.batter) ? `${teamOf.get(p.batter)}:${p.throws}:${p.code}` : null)
  const trC = tally(train, key), teC = tally(test, key)
  const trL = tally(train, (p) => `${p.throws}:${p.code}`), teL = tally(test, (p) => `${p.throws}:${p.code}`)
  // The club's overall level vs a hand, to split a pitch figure into "good lineup" and "this pitch".
  const allKey = (p) => (teamOf.has(p.batter) ? `${teamOf.get(p.batter)}:${p.throws}` : null)
  const trA = tally(train, allKey), teA = tally(test, allKey)
  const trLA = tally(train, (p) => p.throws), teLA = tally(test, (p) => p.throws)

  console.log(`\n=== split ${sp.name}: train < ${sp.train}, test to ${sp.testEnd} (${teamOf.size} regulars on ${regs.size} clubs)`)
  for (const minPa of MIN_PAS) {
    const cells = []
    for (const [k, b] of trC) {
      if (b.pa < minPa) continue
      const [team, hand, code] = k.split(':')
      const t = teC.get(k)
      if (!t?.pa) continue
      const lgTr = xw(trL.get(`${hand}:${code}`)), lgTe = xw(teL.get(`${hand}:${code}`))
      // The card's figure: both values rounded to three places, then the gap.
      const trainDiff = third(third(xw(b)) - third(lgTr))
      const testDiff = xw(t) - lgTe
      const clubTr = xw(trA.get(`${team}:${hand}`)) - xw(trLA.get(hand))
      const clubTe = xw(teA.get(`${team}:${hand}`)) - xw(teLA.get(hand))
      cells.push({ team, hand, code, n: b.pa, m: t.pa, trainDiff, testDiff, pitchTr: trainDiff - clubTr, pitchTe: testDiff - clubTe })
    }
    const w = (c) => c.m
    const all = fit(cells, 'trainDiff', 'testDiff', w)
    const pitch = fit(cells, 'pitchTr', 'pitchTe', w)
    console.log(`MIN_PA ${minPa}: ${cells.length} cells, median train PA ${cells.map((c) => c.n).sort((a, b) => a - b)[cells.length >> 1]}, median test PA ${cells.map((c) => c.m).sort((a, b) => a - b)[cells.length >> 1]}`)
    console.log(`   card figure -> later figure: slope ${all.slope.toFixed(2)} ${boot(cells, (cs) => fit(cs, 'trainDiff', 'testDiff', w).slope)}, r ${all.r.toFixed(2)}`)
    console.log(`   pitch part (club level removed): slope ${pitch.slope.toFixed(2)} ${boot(cells, (cs) => fit(cs, 'pitchTr', 'pitchTe', w).slope, 9)}, r ${pitch.r.toFixed(2)}`)
    for (const band of BANDS) {
      const called = cells.filter((c) => Math.abs(c.trainDiff) > band)
      const held = called.filter((c) => Math.sign(c.testDiff) === Math.sign(c.trainDiff))
      // Weighted by test PA, so a cell with 3 later PA counts less than one with 60.
      const wHeld = sum(held.map(w)) / sum(called.map(w))
      console.log(`   band ${band.toFixed(3)}: ${called.length} calls (${(100 * called.length / cells.length).toFixed(0)}% of cells), same direction later ${(100 * held.length / called.length).toFixed(0)}% (PA-weighted ${(100 * wHeld).toFixed(0)}%)`)
    }
  }
}
