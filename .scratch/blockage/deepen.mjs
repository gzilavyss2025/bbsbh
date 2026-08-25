// The waiting model says no. The position model says yes. This script pushes on
// the second one until it breaks or holds:
//   - can a reader see it without a regression
//   - does it survive measuring the job BEFORE the stay
//   - does it survive throwing out debut seasons too short to read a position
//   - is the move DOWN the defensive spectrum, which is the direction blockage
//     predicts and nothing else does
//   - and what does the move cost him, in the only currency that matters
import { readFileSync, writeFileSync } from 'node:fs'
import { ols, logistic, median, mean, quantile, zscoreBy } from './lib.mjs'

const rows = JSON.parse(readFileSync('rows.json', 'utf8'))
const mlb = JSON.parse(readFileSync('mlb-cache.json', 'utf8'))
const out = {}
const say = (...a) => console.log(...a)

// ---- WAR, six seasons from debut -----------------------------------------
const war = { bat: {}, pit: {} }
for (let i = 0; i < 100; i += 1) {
  const shard = JSON.parse(
    readFileSync(`C:/Users/gzilavy/bbsbh/public/data/war-history/${String(i).padStart(2, '0')}.json`, 'utf8'),
  )
  Object.assign(war.bat, shard.bat || {})
  Object.assign(war.pit, shard.pit || {})
}
const WAR_MIN = 2010
const WAR_MAX = 2025

function war6(playerId, debutSeason, group) {
  const table = group === 'hitting' ? war.bat : war.pit
  const rec = table[String(playerId)]
  if (!rec) return null
  const last = debutSeason + 5
  if (debutSeason < WAR_MIN || last > WAR_MAX) return null
  let total = 0
  for (let y = debutSeason; y <= last; y += 1) total += rec[String(y)] || 0
  return total
}

// Debut-season playing time, so a five-game cup of coffee cannot decide which
// position a man "really" plays.
const debutGs = new Map()
for (const [key, list] of Object.entries(mlb)) {
  const [seasonStr, group] = key.split(':')
  if (group !== 'fielding') continue
  for (const r of list) {
    const k = `${r.p}:${seasonStr}`
    debutGs.set(k, (debutGs.get(k) || 0) + (r.gs || 0))
  }
}

// Hardest job to fill at the top. Blockage pushes a man DOWN this ladder;
// nothing else has a reason to.
const SPECTRUM = { C: 8, SS: 7, CF: 6, '2B': 5, '3B': 4, COF: 3, '1B': 2, DH: 1 }

const hitters = rows
  .filter((r) => r.group === 'hitting' && r.changedPos != null)
  .map((r) => {
    const debutSeason = Number(r.debutDate.slice(0, 4))
    return {
      ...r,
      debutSeason,
      debutStarts: debutGs.get(`${r.playerId}:${debutSeason}`) || 0,
      war6: war6(r.playerId, debutSeason, 'hitting'),
      movedDown: r.debutPos && r.aaaPos && SPECTRUM[r.debutPos] && SPECTRUM[r.aaaPos]
        ? Number(SPECTRUM[r.debutPos] < SPECTRUM[r.aaaPos])
        : null,
      movedUp: r.debutPos && r.aaaPos && SPECTRUM[r.debutPos] && SPECTRUM[r.aaaPos]
        ? Number(SPECTRUM[r.debutPos] > SPECTRUM[r.aaaPos])
        : null,
    }
  })

say(`hitter stays with a readable position on both sides: ${hitters.length}`)

// ---- 1. can a reader see it without a regression -------------------------
say('\n========== THE PICTURE WITHOUT A MODEL ==========')
say('Share of hitters who arrived in the majors at a different position than')
say('the one they played at Triple-A.\n')

function rate(list, f) {
  const g = list.filter(f)
  return { n: g.length, pct: g.length ? 100 * mean(g.map((r) => r.changedPos)) : null,
    downPct: g.length ? 100 * mean(g.filter((r) => r.movedDown != null).map((r) => r.movedDown)) : null }
}

out.crosstabs = {}
say('by how long the man above him is signed for:')
const ctrlRows = [
  ['post-control, 0 yrs left', (r) => r.controlLeft === 0],
  ['arbitration, 1-3 left', (r) => r.controlLeft >= 1 && r.controlLeft <= 3],
  ['pre-arb, 4-6 left', (r) => r.controlLeft >= 4],
]
out.crosstabs.control = []
for (const [label, f] of ctrlRows) {
  const r = rate(hitters, f)
  out.crosstabs.control.push({ label, ...r })
  say(`  ${label.padEnd(26)} n=${String(r.n).padStart(3)}   changed ${r.pct.toFixed(1)}%   of those, down the ladder ${r.downPct.toFixed(1)}%`)
}

say('\nby how many men already share that job:')
const depthRows = [
  ['one man owns it', (r) => r.jobDepth <= 1],
  ['two share it', (r) => r.jobDepth === 2],
  ['three or more', (r) => r.jobDepth >= 3],
]
out.crosstabs.depth = []
for (const [label, f] of depthRows) {
  const r = rate(hitters, f)
  out.crosstabs.depth.push({ label, ...r })
  say(`  ${label.padEnd(26)} n=${String(r.n).padStart(3)}   changed ${r.pct.toFixed(1)}%   of those, down the ladder ${r.downPct.toFixed(1)}%`)
}

say('\nby how the man above him is playing:')
const qc = [quantile(hitters.map((r) => r.jobQZ), 0.33), quantile(hitters.map((r) => r.jobQZ), 0.67)]
const qRows = [
  ['struggling', (r) => r.jobQZ <= qc[0]],
  ['average', (r) => r.jobQZ > qc[0] && r.jobQZ < qc[1]],
  ['good', (r) => r.jobQZ >= qc[1]],
]
out.crosstabs.quality = []
for (const [label, f] of qRows) {
  const r = rate(hitters, f)
  out.crosstabs.quality.push({ label, ...r })
  say(`  ${label.padEnd(26)} n=${String(r.n).padStart(3)}   changed ${r.pct.toFixed(1)}%   of those, down the ladder ${r.downPct.toFixed(1)}%`)
}

// The corner the whole finding lives in.
const worst = hitters.filter((r) => r.controlLeft === 0 && r.jobDepth <= 1)
const best = hitters.filter((r) => r.controlLeft >= 4 && r.jobDepth >= 2)
say(`\nbehind ONE veteran past his control window:   n=${worst.length}  changed ${(100 * mean(worst.map((r) => r.changedPos))).toFixed(1)}%`)
say(`behind a SHARED job held by cheap young men: n=${best.length}  changed ${(100 * mean(best.map((r) => r.changedPos))).toFixed(1)}%`)
out.corner = {
  blockedN: worst.length,
  blockedPct: 100 * mean(worst.map((r) => r.changedPos)),
  openN: best.length,
  openPct: 100 * mean(best.map((r) => r.changedPos)),
}

// ---- 2/3. robustness ------------------------------------------------------
const TIERS = ['r1', 'r2_5', 'r6_15', 'r16plus']
const ageMean = mean(hitters.map((r) => r.ageAtStay).filter((v) => v != null))
const depthMean = mean(hitters.map((r) => r.jobDepth))
const jobAgeMean = mean(hitters.map((r) => r.jobAge).filter((v) => v != null))
const winMean = mean(hitters.map((r) => r.orgWinPct).filter((v) => v != null))

// useLag must describe the job a season EARLIER in full - depth/age/win pct
// used to stay concurrent regardless of the flag (same bug as model.mjs's
// jobCols(), fixed there first; see its comment for what a live check found).
function design(r, useLag) {
  const c = [1, r.rateZ, (r.ageAtStay ?? ageMean) - ageMean]
  for (const t of TIERS) c.push(r.tier === t ? 1 : 0)
  c.push(r.era === 'e2' ? 1 : 0, r.era === 'e3' ? 1 : 0)
  if (!useLag) {
    c.push(
      r.jobQZ,
      r.controlLeft / 6,
      r.jobDepth - depthMean,
      (r.jobAge ?? jobAgeMean) - jobAgeMean,
      (r.orgWinPct ?? winMean) - winMean,
    )
    return c
  }
  c.push(
    r.jobLagQZ,
    (r.jobLagControlLeft ?? r.controlLeft) / 6,
    (r.jobLagDepth ?? r.jobDepth) - depthMean,
    (r.jobLagAge ?? r.jobAge ?? jobAgeMean) - jobAgeMean,
    (r.orgWinPctLag ?? r.orgWinPct ?? winMean) - winMean,
  )
  return c
}
const NAMES = [
  'intercept', 'own rate (z)', 'age at stay',
  ...TIERS.map((t) => `draft ${t}`),
  'era 2014-18', 'era 2019-23',
  'incumbent quality (z)', 'incumbent control yrs left / 6',
  'incumbent depth at job', 'incumbent age', 'parent club win pct',
]
const JOB = NAMES.slice(-5)

function runLogit(list, yFn, label, useLag = false) {
  if (list.length < 80) { say(`\n--- ${label}: too few rows (${list.length}) ---`); return null }
  const y = list.map(yFn)
  if (mean(y) < 0.03 || mean(y) > 0.97) return null
  const m = logistic(list.map((r) => design(r, useLag)), y, NAMES)
  say(`\n--- ${label}  (n=${list.length}, rate=${(100 * mean(y)).toFixed(1)}%, McFadden=${m.mcFadden.toFixed(3)}) ---`)
  for (const t of m.terms) {
    if (!JOB.includes(t.name)) continue
    const star = t.p < 0.01 ? '**' : t.p < 0.05 ? '*' : '  '
    say(`    ${t.name.padEnd(32)} OR=${t.oddsRatio.toFixed(3).padStart(7)}  z=${t.z.toFixed(2).padStart(6)}  p=${t.p.toFixed(4)} ${star}`)
  }
  return { label, n: list.length, rate: mean(y), mcFadden: m.mcFadden, terms: m.terms.filter((t) => JOB.includes(t.name)) }
}

say('\n\n========== DOES THE POSITION FINDING HOLD UP ==========')
out.robustness = []
out.robustness.push(runLogit(hitters, (r) => r.changedPos, 'baseline: changed position'))
out.robustness.push(runLogit(hitters.filter((r) => r.debutStarts >= 20), (r) => r.changedPos,
  'only debut seasons with 20+ starts'))
out.robustness.push(runLogit(hitters.filter((r) => r.debutStarts >= 40), (r) => r.changedPos,
  'only debut seasons with 40+ starts'))
out.robustness.push(runLogit(hitters, (r) => r.changedPos, 'job measured the season BEFORE the stay', true))
out.robustness.push(runLogit(hitters.filter((r) => r.movedDown != null), (r) => r.movedDown,
  'moved DOWN the defensive ladder'))
out.robustness.push(runLogit(hitters.filter((r) => r.movedUp != null), (r) => r.movedUp,
  'moved UP the defensive ladder (should be nothing)'))

// ---- 4. what does the move cost him --------------------------------------
say('\n\n========== WHAT THE MOVE COSTS ==========')
const withWar = hitters.filter((r) => r.war6 != null)
say(`hitters with six full seasons of WAR on the record: ${withWar.length}`)
const conv = withWar.filter((r) => r.changedPos === 1)
const stay = withWar.filter((r) => r.changedPos === 0)
const down = withWar.filter((r) => r.movedDown === 1)
say(`  stayed at his position   n=${stay.length}  median WAR6 ${median(stay.map((r) => r.war6))}  mean ${mean(stay.map((r) => r.war6)).toFixed(2)}`)
say(`  changed position         n=${conv.length}  median WAR6 ${median(conv.map((r) => r.war6))}  mean ${mean(conv.map((r) => r.war6)).toFixed(2)}`)
say(`  moved DOWN the ladder    n=${down.length}  median WAR6 ${median(down.map((r) => r.war6))}  mean ${mean(down.map((r) => r.war6)).toFixed(2)}`)

if (withWar.length > 80) {
  const y = withWar.map((r) => r.war6)
  const X = withWar.map((r) => {
    const c = [1, r.rateZ, (r.ageAtStay ?? ageMean) - ageMean]
    for (const t of TIERS) c.push(r.tier === t ? 1 : 0)
    c.push(r.era === 'e2' ? 1 : 0, r.era === 'e3' ? 1 : 0)
    c.push(r.changedPos, r.movedDown ?? 0)
    return c
  })
  const names = ['intercept', 'own rate (z)', 'age at stay', ...TIERS.map((t) => `draft ${t}`),
    'era 2014-18', 'era 2019-23', 'changed position', 'moved down the ladder']
  const m = ols(X, y, names)
  say(`\nWAR6 model (n=${m.n}, R2=${m.r2.toFixed(3)}):`)
  for (const t of m.terms.slice(-2)) {
    const star = t.p < 0.01 ? '**' : t.p < 0.05 ? '*' : '  '
    say(`    ${t.name.padEnd(28)} b=${t.beta.toFixed(3).padStart(7)} WAR   z=${t.z.toFixed(2).padStart(6)}  p=${t.p.toFixed(4)} ${star}`)
  }
  out.warModel = { n: m.n, r2: m.r2, terms: m.terms.slice(-2) }
}

// ---- 5. the price, stated as a price -------------------------------------
say('\n\n========== THE PRICE ==========')
const full = logistic(hitters.map((r) => design(r, false)), hitters.map((r) => r.changedPos), NAMES)
const beta = Object.fromEntries(full.terms.map((t) => [t.name, t.beta]))
function pr(over) {
  const r = {
    rateZ: 0, ageAtStay: ageMean, tier: 'r2_5', era: 'e3',
    jobQZ: 0, controlLeft: 3, jobDepth: depthMean, jobAge: jobAgeMean, orgWinPct: winMean,
    ...over,
  }
  const eta = design(r, false).reduce((s, v, i) => s + v * full.terms[i].beta, 0)
  return 1 / (1 + Math.exp(-eta))
}
const scenarios = [
  ['job shared by two, held by cheap young men', { jobDepth: 2, controlLeft: 6, jobQZ: -0.5 }],
  ['league-average situation', {}],
  ['one good veteran owns it, past his control window', { jobDepth: 1, controlLeft: 0, jobQZ: 1 }],
]
out.price = []
for (const [label, over] of scenarios) {
  const p = pr(over)
  out.price.push({ label, prob: p })
  say(`  ${label.padEnd(46)} P(changes position) = ${(100 * p).toFixed(1)}%`)
}
say(`\nspread between the open job and the blocked one: ${(100 * (pr(scenarios[2][1]) - pr(scenarios[0][1]))).toFixed(1)} points`)
out.priceSpread = 100 * (pr(scenarios[2][1]) - pr(scenarios[0][1]))
say(`(intercept term note: beta for control = ${beta['incumbent control yrs left / 6'].toFixed(3)})`)

writeFileSync('deepen.json', JSON.stringify(out, null, 2))
writeFileSync('hitters.json', JSON.stringify(hitters))
say('\nwrote deepen.json')
