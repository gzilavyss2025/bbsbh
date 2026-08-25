// The decisive test.
//
// "Depth at the job" and "room to move down the ladder" are both partly decided
// by WHICH position the man plays. Corner outfield has two slots, so depth is
// high there by construction, and it sits near the bottom of the ladder, so
// there is nowhere to fall. Catcher is one slot at the top. If that is all the
// finding is, it is positional arithmetic wearing a front-office story.
//
// So: show the confound, then put position fixed effects in and see what is
// left.
import { readFileSync, writeFileSync } from 'node:fs'
import { logistic, mean, median } from './lib.mjs'

const hitters = JSON.parse(readFileSync('hitters.json', 'utf8'))
const out = {}
const say = (...a) => console.log(...a)

const POSITIONS = ['C', 'SS', 'CF', '2B', '3B', 'COF', '1B', 'DH']

say('========== IS THE CONFOUND REAL ==========')
say('position   n    median depth   changed%   moved down%')
out.byPosition = []
for (const pos of POSITIONS) {
  const g = hitters.filter((r) => r.aaaPos === pos)
  if (!g.length) continue
  const rec = {
    pos,
    n: g.length,
    medianDepth: median(g.map((r) => r.jobDepth)),
    changedPct: 100 * mean(g.map((r) => r.changedPos)),
    downPct: 100 * mean(g.filter((r) => r.movedDown != null).map((r) => r.movedDown)),
  }
  out.byPosition.push(rec)
  say(`  ${pos.padEnd(6)} ${String(rec.n).padStart(4)}   ${String(rec.medianDepth).padStart(6)}        ${rec.changedPct.toFixed(1).padStart(5)}      ${rec.downPct.toFixed(1).padStart(5)}`)
}
say('\nIf depth tracks position and position decides the outcome, the confound is real.')

// ---- refit with position fixed effects -----------------------------------
const TIERS = ['r1', 'r2_5', 'r6_15', 'r16plus']
const present = POSITIONS.filter((p) => hitters.filter((r) => r.aaaPos === p).length >= 12)
const REF = present[present.length - 1]
const posCols = present.filter((p) => p !== REF)
say(`\nposition fixed effects: ${posCols.join(', ')}  (reference ${REF})`)

const ageMean = mean(hitters.map((r) => r.ageAtStay).filter((v) => v != null))
const depthMean = mean(hitters.map((r) => r.jobDepth))
const jobAgeMean = mean(hitters.map((r) => r.jobAge).filter((v) => v != null))
const winMean = mean(hitters.map((r) => r.orgWinPct).filter((v) => v != null))

// useLag must describe the job a season EARLIER in full - depth/age/win pct
// used to stay concurrent regardless of the flag (same bug as model.mjs's
// jobCols(), fixed there first; see its comment for what a live check found).
function design(r, { withPos, useLag }) {
  const c = [1, r.rateZ, (r.ageAtStay ?? ageMean) - ageMean]
  for (const t of TIERS) c.push(r.tier === t ? 1 : 0)
  c.push(r.era === 'e2' ? 1 : 0, r.era === 'e3' ? 1 : 0)
  if (withPos) for (const p of posCols) c.push(r.aaaPos === p ? 1 : 0)
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
function names(withPos) {
  const n = ['intercept', 'own rate (z)', 'age at stay', ...TIERS.map((t) => `draft ${t}`), 'era 2014-18', 'era 2019-23']
  if (withPos) for (const p of posCols) n.push(`pos ${p}`)
  n.push('incumbent quality (z)', 'incumbent control yrs left / 6', 'incumbent depth at job', 'incumbent age', 'parent club win pct')
  return n
}
const JOB = ['incumbent quality (z)', 'incumbent control yrs left / 6', 'incumbent depth at job', 'incumbent age', 'parent club win pct']

function run(list, yFn, label, opts) {
  const y = list.map(yFn)
  if (list.length < 60 || mean(y) < 0.03 || mean(y) > 0.97) {
    say(`\n--- ${label}: not fittable (n=${list.length}) ---`)
    return null
  }
  let m
  try {
    m = logistic(list.map((r) => design(r, opts)), y, names(opts.withPos))
  } catch (e) {
    say(`\n--- ${label}: ${e.message} ---`)
    return null
  }
  say(`\n--- ${label}  (n=${list.length}, rate=${(100 * mean(y)).toFixed(1)}%, McFadden=${m.mcFadden.toFixed(3)}) ---`)
  for (const t of m.terms) {
    if (!JOB.includes(t.name)) continue
    const star = t.p < 0.01 ? '**' : t.p < 0.05 ? '*' : '  '
    say(`    ${t.name.padEnd(32)} OR=${t.oddsRatio.toFixed(3).padStart(7)}  z=${t.z.toFixed(2).padStart(6)}  p=${t.p.toFixed(4)} ${star}`)
  }
  return { label, n: list.length, rate: mean(y), mcFadden: m.mcFadden, terms: m.terms.filter((t) => JOB.includes(t.name)) }
}

say('\n\n========== WITH POSITION HELD FIXED ==========')
out.fits = []
out.fits.push(run(hitters, (r) => r.changedPos, 'changed position, NO position controls', { withPos: false, useLag: false }))
out.fits.push(run(hitters, (r) => r.changedPos, 'changed position, position held fixed', { withPos: true, useLag: false }))
out.fits.push(run(hitters.filter((r) => r.movedDown != null), (r) => r.movedDown,
  'moved down, NO position controls', { withPos: false, useLag: false }))
out.fits.push(run(hitters.filter((r) => r.movedDown != null), (r) => r.movedDown,
  'moved down, position held fixed', { withPos: true, useLag: false }))
out.fits.push(run(hitters.filter((r) => r.movedDown != null), (r) => r.movedDown,
  'moved down, position fixed AND job lagged', { withPos: true, useLag: true }))

// ---- the hardest version: inside one position group ----------------------
say('\n\n========== INSIDE A SINGLE POSITION ==========')
say('No positional arithmetic can survive this - every man here plays the same job.')
for (const pos of ['SS', 'CF', 'COF', '3B', '2B']) {
  const g = hitters.filter((r) => r.aaaPos === pos)
  const res = run(g, (r) => r.changedPos, `${pos} only, changed position`, { withPos: false, useLag: false })
  if (res) out.fits.push(res)
}

// A cleaner within-position read that does not need a model: split each
// position at its own median depth and compare.
say('\n\n========== WITHIN POSITION, SPLIT AT ITS OWN MEDIAN DEPTH ==========')
let loN = 0
let loChanged = 0
let hiN = 0
let hiChanged = 0
out.withinSplit = []
for (const pos of POSITIONS) {
  const g = hitters.filter((r) => r.aaaPos === pos)
  if (g.length < 20) continue
  const med = median(g.map((r) => r.jobDepth))
  const lo = g.filter((r) => r.jobDepth <= med)
  const hi = g.filter((r) => r.jobDepth > med)
  if (!lo.length || !hi.length) continue
  loN += lo.length
  loChanged += lo.filter((r) => r.changedPos).length
  hiN += hi.length
  hiChanged += hi.filter((r) => r.changedPos).length
  const rec = {
    pos,
    med,
    settledN: lo.length,
    settledPct: 100 * mean(lo.map((r) => r.changedPos)),
    sharedN: hi.length,
    sharedPct: 100 * mean(hi.map((r) => r.changedPos)),
  }
  out.withinSplit.push(rec)
  say(`  ${pos.padEnd(5)} settled(<=${med}) n=${String(lo.length).padStart(3)} ${rec.settledPct.toFixed(1).padStart(5)}%    shared(>${med}) n=${String(hi.length).padStart(3)} ${rec.sharedPct.toFixed(1).padStart(5)}%`)
}
say(`\n  POOLED WITHIN POSITION:  settled ${(100 * loChanged / loN).toFixed(1)}% (n=${loN})   shared ${(100 * hiChanged / hiN).toFixed(1)}% (n=${hiN})`)
out.pooledWithin = {
  settledN: loN,
  settledPct: (100 * loChanged) / loN,
  sharedN: hiN,
  sharedPct: (100 * hiChanged) / hiN,
}

writeFileSync('confound.json', JSON.stringify(out, null, 2))
say('\nwrote confound.json')
