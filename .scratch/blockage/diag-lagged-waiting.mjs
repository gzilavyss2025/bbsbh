// Throwaway diagnostic, not part of the committed pipeline. Checks whether
// the newly-significant lagged-depth waiting-model result (findings.json
// models[2], dR2=0.0155 F=2.87 p~.01) is a real, blockage-shaped signal or an
// artifact: does it concentrate where blockage theory predicts (scarce jobs)
// and vanish where it should (bullpen)? Does it hold for hitters AND pitchers
// separately? Is it driven by a handful of outliers?
import { readFileSync } from 'node:fs'
import { ols, fTest, mean, zscoreBy, quantile } from './lib.mjs'

const rows = JSON.parse(readFileSync('rows.json', 'utf8'))
const depthMean = mean(rows.map((r) => r.jobDepth))
const jobAgeMean = mean(rows.map((r) => r.jobAge).filter((v) => v != null))
const winMean = mean(rows.map((r) => r.orgWinPct).filter((v) => v != null))
const ageMean = mean(rows.map((r) => r.ageAtStay).filter((v) => v != null))
const TIERS = ['r1', 'r2_5', 'r6_15', 'r16plus']

function baseCols(r, pooled) {
  const c = [1, r.rateZ, (r.ageAtStay ?? ageMean) - ageMean]
  for (const t of TIERS) c.push(r.tier === t ? 1 : 0)
  c.push(r.era === 'e2' ? 1 : 0, r.era === 'e3' ? 1 : 0)
  if (pooled) c.push(r.group === 'pitching' ? 1 : 0)
  return c
}
function jobColsLag(r) {
  return [
    r.jobLagQZ,
    (r.jobLagControlLeft ?? r.controlLeft) / 6,
    (r.jobLagDepth ?? r.jobDepth) - depthMean,
    (r.jobLagAge ?? r.jobAge ?? jobAgeMean) - jobAgeMean,
    (r.orgWinPctLag ?? r.orgWinPct ?? winMean) - winMean,
    r.jobTenureLag ?? r.jobTenure,
  ]
}
const JOB_NAMES = ['quality', 'controlLeft', 'depth', 'age', 'winPct', 'tenure']

function fitLag(subset, label, pooled = true) {
  if (subset.length < 40) {
    console.log(`${label}: n=${subset.length}, too small to fit`)
    return
  }
  const y = subset.map((r) => Math.log(r.activeDays))
  const Xa = subset.map((r) => baseCols(r, pooled))
  const Xb = subset.map((r) => [...baseCols(r, pooled), ...jobColsLag(r)])
  const a = ols(Xa, y)
  const b = ols(Xb, y)
  const f = fTest(a, b)
  const depthTerm = b.terms[b.terms.length - 4] // job cols appended after base; depth is 3rd of 6
  console.log(
    `${label}: n=${subset.length}  dR2=${f.deltaR2.toFixed(4)}  F(${f.df1},${f.df2})=${f.F.toFixed(2)}  depth b=${depthTerm.beta.toFixed(4)} p=${depthTerm.p.toFixed(4)}`,
  )
}

console.log('=== falsification: by scarcity (blockage should bite scarce, not bullpen) ===')
for (const sc of ['scarce', 'mid', 'open', 'rotation', 'bullpen']) {
  fitLag(rows.filter((r) => r.scarcity === sc), `job type: ${sc}`, false)
}

console.log('\n=== hitters vs pitchers separately ===')
fitLag(rows.filter((r) => r.group === 'hitting'), 'hitters only', false)
fitLag(rows.filter((r) => r.group === 'pitching'), 'pitchers only', false)

console.log('\n=== calendar days instead of season days ===')
{
  const subset = rows
  const y = subset.map((r) => Math.log(r.calDays))
  const Xa = subset.map((r) => baseCols(r, true))
  const Xb = subset.map((r) => [...baseCols(r, true), ...jobColsLag(r)])
  const a = ols(Xa, y)
  const b = ols(Xb, y)
  const f = fTest(a, b)
  const depthTerm = b.terms[b.terms.length - 4]
  console.log(`calendar days, all: n=${subset.length}  dR2=${f.deltaR2.toFixed(4)}  F(${f.df1},${f.df2})=${f.F.toFixed(2)}  depth b=${depthTerm.beta.toFixed(4)} p=${depthTerm.p.toFixed(4)}`)
}

console.log('\n=== descriptive: median season-days by lagged-depth tercile (no model) ===')
{
  const withDepth = rows.filter((r) => r.jobLagDepth != null || r.jobDepth != null)
  const depths = withDepth.map((r) => r.jobLagDepth ?? r.jobDepth).sort((a, b) => a - b)
  const cuts = [quantile(depths, 0.33), quantile(depths, 0.67)]
  const buckets = { low: [], mid: [], high: [] }
  for (const r of withDepth) {
    const d = r.jobLagDepth ?? r.jobDepth
    const b = d <= cuts[0] ? 'low' : d <= cuts[1] ? 'mid' : 'high'
    buckets[b].push(r.activeDays)
  }
  for (const k of ['low', 'mid', 'high']) {
    const arr = buckets[k].sort((a, b) => a - b)
    const med = arr[Math.floor(arr.length / 2)]
    console.log(`  ${k} lagged depth: n=${arr.length}  median season-days=${med}`)
  }
}

console.log('\n=== outlier check: same fit, winsorized at p1/p99 activeDays ===')
{
  const vals = rows.map((r) => r.activeDays).sort((a, b) => a - b)
  const lo = quantile(vals, 0.01)
  const hi = quantile(vals, 0.99)
  const subset = rows.filter((r) => r.activeDays >= lo && r.activeDays <= hi)
  fitLag(subset, `winsorized (dropped ${rows.length - subset.length} extreme stays)`, true)
}
