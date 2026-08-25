// Two last checks before any of this gets written down.
//
// 1. Give the WAITING model every advantage the position model got - position
//    fixed effects included - and see whether the no survives.
// 2. Read the names. A join this deep can be wrong in a way no p-value shows,
//    and a front office would check the names first.
import { readFileSync, writeFileSync } from 'node:fs'
import { ols, fTest, mean, median } from './lib.mjs'

const hitters = JSON.parse(readFileSync('hitters.json', 'utf8'))
const rows = JSON.parse(readFileSync('rows.json', 'utf8'))
const out = {}
const say = (...a) => console.log(...a)

const TIERS = ['r1', 'r2_5', 'r6_15', 'r16plus']
const POSITIONS = ['C', 'SS', 'CF', '2B', '3B', 'COF']
const ageMean = mean(hitters.map((r) => r.ageAtStay).filter((v) => v != null))
const depthMean = mean(hitters.map((r) => r.jobDepth))
const jobAgeMean = mean(hitters.map((r) => r.jobAge).filter((v) => v != null))
const winMean = mean(hitters.map((r) => r.orgWinPct).filter((v) => v != null))

function base(r) {
  const c = [1, r.rateZ, (r.ageAtStay ?? ageMean) - ageMean]
  for (const t of TIERS) c.push(r.tier === t ? 1 : 0)
  c.push(r.era === 'e2' ? 1 : 0, r.era === 'e3' ? 1 : 0)
  for (const p of POSITIONS) c.push(r.aaaPos === p ? 1 : 0)
  return c
}
const BASE_NAMES = ['intercept', 'own rate (z)', 'age at stay', ...TIERS.map((t) => `draft ${t}`),
  'era 2014-18', 'era 2019-23', ...POSITIONS.map((p) => `pos ${p}`)]
const JOB_NAMES = ['incumbent quality (z)', 'incumbent control yrs left / 6',
  'incumbent depth at job', 'incumbent age', 'parent club win pct']
function job(r) {
  return [r.jobQZ, r.controlLeft / 6, r.jobDepth - depthMean,
    (r.jobAge ?? jobAgeMean) - jobAgeMean, (r.orgWinPct ?? winMean) - winMean]
}

say('========== THE WAITING MODEL, GIVEN EVERY ADVANTAGE ==========')
say('Hitters only, position held fixed - the exact specification under which')
say('the position-change finding survived.\n')
const y = hitters.map((r) => Math.log(r.activeDays))
const a = ols(hitters.map(base), y, BASE_NAMES)
const b = ols(hitters.map((r) => [...base(r), ...job(r)]), y, [...BASE_NAMES, ...JOB_NAMES])
const f = fTest(a, b)
say(`  his own line + position   R2 = ${a.r2.toFixed(4)}`)
say(`  plus the job above him    R2 = ${b.r2.toFixed(4)}`)
say(`  the job buys              dR2 = ${f.deltaR2.toFixed(4)}   F(${f.df1},${f.df2}) = ${f.F.toFixed(2)}`)
for (const t of b.terms) {
  if (!JOB_NAMES.includes(t.name)) continue
  const star = t.p < 0.01 ? '**' : t.p < 0.05 ? '*' : '  '
  say(`    ${t.name.padEnd(32)} b=${t.beta.toFixed(4).padStart(8)}  z=${t.z.toFixed(2).padStart(6)}  p=${t.p.toFixed(4)} ${star}`)
}
out.waitingWithPos = { n: a.n, baseR2: a.r2, fullR2: b.r2, deltaR2: f.deltaR2, F: f.F,
  terms: b.terms.filter((t) => JOB_NAMES.includes(t.name)) }

// Same thing on the down-the-ladder subgroup: even among the men blockage DID
// move, did it also make them wait?
const movedDownSet = hitters.filter((r) => r.movedDown === 1)
say(`\namong the ${movedDownSet.length} men who moved DOWN the ladder, median season-days at Triple-A: ${median(movedDownSet.map((r) => r.activeDays))}`)
say(`among the ${hitters.filter((r) => r.changedPos === 0).length} who stayed at their position:            ${median(hitters.filter((r) => r.changedPos === 0).map((r) => r.activeDays))}`)
out.waitByOutcome = {
  movedDownMedian: median(movedDownSet.map((r) => r.activeDays)),
  stayedMedian: median(hitters.filter((r) => r.changedPos === 0).map((r) => r.activeDays)),
}

// ---- read the names ------------------------------------------------------
say('\n\n========== READ THE NAMES ==========')
say('The most blocked situations in the sample: one man owns the job, he is')
say('past his control window, and he is playing well.\n')
const blocked = hitters
  .filter((r) => r.jobDepth <= 1 && r.controlLeft === 0 && r.jobQZ > 0.5)
  .sort((a2, b2) => b2.jobQZ - a2.jobQZ)
  .slice(0, 14)
say('prospect                 season  org  AAA pos -> debut pos  days  moved down')
for (const r of blocked) {
  say(`  ${String(r.name).padEnd(24)} ${r.season}  ${String(r.orgId).padStart(3)}  ${String(r.aaaPos).padEnd(4)} -> ${String(r.debutPos || '?').padEnd(4)}  ${String(r.activeDays).padStart(4)}   ${r.movedDown ? 'yes' : 'no'}`)
}
out.blockedExamples = blocked.map((r) => ({
  name: r.name, season: r.season, orgId: r.orgId, aaaPos: r.aaaPos,
  debutPos: r.debutPos, activeDays: r.activeDays, movedDown: r.movedDown,
}))

say('\nThe opposite corner: a shared job held by cheap young men.\n')
const open = hitters
  .filter((r) => r.jobDepth >= 3 && r.controlLeft >= 4)
  .sort((a2, b2) => a2.activeDays - b2.activeDays)
  .slice(0, 10)
say('prospect                 season  org  AAA pos -> debut pos  days  moved down')
for (const r of open) {
  say(`  ${String(r.name).padEnd(24)} ${r.season}  ${String(r.orgId).padStart(3)}  ${String(r.aaaPos).padEnd(4)} -> ${String(r.debutPos || '?').padEnd(4)}  ${String(r.activeDays).padStart(4)}   ${r.movedDown ? 'yes' : 'no'}`)
}
out.openExamples = open.map((r) => ({
  name: r.name, season: r.season, orgId: r.orgId, aaaPos: r.aaaPos,
  debutPos: r.debutPos, activeDays: r.activeDays, movedDown: r.movedDown,
}))

// ---- how much of the sample is even blocked ------------------------------
say('\n\n========== HOW COMMON IS A BLOCKED SITUATION ==========')
const settled = hitters.filter((r) => r.jobDepth <= 1).length
const veteranHeld = hitters.filter((r) => r.controlLeft === 0).length
const both = hitters.filter((r) => r.jobDepth <= 1 && r.controlLeft === 0).length
say(`  one man owns the job:                       ${settled} of ${hitters.length} (${(100 * settled / hitters.length).toFixed(1)}%)`)
say(`  the man above him is past his control:      ${veteranHeld} of ${hitters.length} (${(100 * veteranHeld / hitters.length).toFixed(1)}%)`)
say(`  both at once - the real blockage:           ${both} of ${hitters.length} (${(100 * both / hitters.length).toFixed(1)}%)`)
out.prevalence = { settled, veteranHeld, both, n: hitters.length }

// Pitchers, for completeness: the same two conditions, on waiting.
const pitchers = rows.filter((r) => r.group === 'pitching')
say(`\n  pitchers in the sample: ${pitchers.length} (no position ladder applies to them)`)

writeFileSync('check.json', JSON.stringify(out, null, 2))
say('\nwrote check.json')
