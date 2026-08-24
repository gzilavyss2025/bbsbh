// Step 4: the cheap check that has to run BEFORE anything is built on top of
// the dependence panel.
//
// Two questions, both of which can kill or reshape the spike:
//
//  Q1. IS "HOMEGROWN DEPENDENCE" JUST "BAD TEAM" OR "SMALL MARKET" WEARING A
//      DIFFERENT NAME? If the measure is largely collinear with winning or with
//      market size, the headline question partly collapses and the write-up has
//      to say so before it says anything else.
//
//  Q2. DOES THE FIXED-EFFECTS DESIGN HAVE ANY POWER? The plan is to put
//      homegrownShare into a player-level duration model WITH org fixed
//      effects, which identifies the coefficient from WITHIN-org variation over
//      time only. If an org's dependence barely moves across twenty seasons,
//      that estimator has nothing to work with, and the null it returns would
//      mean "no power", not "no effect". This has to be measured first so the
//      later null can be read correctly.
//
// It also checks the FREE PILOT against the real thing. Before the full pull
// existed, the cheap stand-in available was a count: how many of the 3,061-
// player debut cohort had their first professional season at each org. That is
// a production count, not a playing-time share, and it is survivorship-limited
// to players who reached the majors. Whether it would have pointed the same way
// is worth knowing for the next spike that has to decide what to fund.
//
// Correlations are reported three ways on purpose. The pooled n=600 p-value is
// anti-conservative -- rows repeat within an org and within a season -- so the
// between-org (n=30 org means) and within-org (both variables demeaned by org,
// df charged for the 30 means) versions sit beside it rather than behind it.
//
// Writes homegrown-precheck.json.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { here, median } from './homegrown-lib.mjs'
import { selfTest, pearson, spearman, withinBetween, tTwoSidedP } from './homegrown-stats.mjs'

const fails = selfTest()
if (fails.length) {
  console.error('numeric self-test failed; refusing to run on real data')
  process.exit(1)
}

const panelFile = JSON.parse(await readFile(join(here, 'homegrown-panel.json'), 'utf8'))
const cohort = JSON.parse(await readFile(join(here, 'homegrown-cohort.json'), 'utf8'))
const panel = panelFile.panel.filter((r) => r.winPct != null)
console.log(`panel: ${panel.length} org-seasons with a win percentage`)

const orgNameById = new Map(cohort.perOrg.map((o) => [o.orgId, o.name]))

// --- Q2 first: within vs between variation -----------------------------------
console.log('\n=== Q2. within-org vs between-org variation in homegrownShare ===')
const wb = withinBetween(panel, 'orgId', 'homegrownShare')
console.log(`n=${wb.n} org-seasons across ${wb.groups} orgs, grand mean ${wb.grandMean.toFixed(3)}`)
console.log(`between-org SD: ${wb.betweenSD.toFixed(4)}`)
console.log(`within-org SD:  ${wb.withinSD.toFixed(4)}`)
console.log(`total SD:       ${wb.totalSD.toFixed(4)}`)
console.log(`share of variance that is WITHIN org: ${(wb.withinShareOfVariance * 100).toFixed(1)}%`)
console.log(
  wb.withinShareOfVariance > 0.5
    ? '-> most of the variation is within-org over time. The fixed-effects design has something to identify from.'
    : '-> most of the variation is BETWEEN orgs. A fixed-effects estimate would be weakly identified; read any null accordingly.',
)

// same decomposition by SEASON, since a league-wide time trend would show up as
// within-org variation while carrying no org-specific information at all
const wbSeason = withinBetween(panel, 'season', 'homegrownShare')
console.log(`\nby season instead: between-season SD ${wbSeason.betweenSD.toFixed(4)}, within-season SD ${wbSeason.withinSD.toFixed(4)}`)
console.log(`share of variance that is WITHIN a season (i.e. across orgs): ${(wbSeason.withinShareOfVariance * 100).toFixed(1)}%`)

// --- Q1: collinearity with winning and with market size ------------------------
function threeWays(label, xKey, yKey, rows) {
  const use = rows.filter((r) => r[xKey] != null && r[yKey] != null)
  const x = use.map((r) => r[xKey])
  const y = use.map((r) => r[yKey])
  const pooled = pearson(x, y)
  const pooledRho = spearman(x, y)

  // between-org: one point per org, the org's mean of each series
  const byOrg = new Map()
  for (const r of use) {
    if (!byOrg.has(r.orgId)) byOrg.set(r.orgId, { xs: [], ys: [] })
    byOrg.get(r.orgId).xs.push(r[xKey])
    byOrg.get(r.orgId).ys.push(r[yKey])
  }
  const bx = []
  const by = []
  const orgMeans = []
  for (const [orgId, v] of byOrg) {
    const mx = v.xs.reduce((a, b) => a + b, 0) / v.xs.length
    const my = v.ys.reduce((a, b) => a + b, 0) / v.ys.length
    bx.push(mx)
    by.push(my)
    orgMeans.push({ orgId, name: orgNameById.get(orgId) ?? String(orgId), n: v.xs.length, x: mx, y: my })
  }
  const between = pearson(bx, by)

  // within-org: both series demeaned by org, df charged for the org means
  const wx = []
  const wy = []
  for (const r of use) {
    const v = byOrg.get(r.orgId)
    const mx = v.xs.reduce((a, b) => a + b, 0) / v.xs.length
    const my = v.ys.reduce((a, b) => a + b, 0) / v.ys.length
    wx.push(r[xKey] - mx)
    wy.push(r[yKey] - my)
  }
  const withinRaw = pearson(wx, wy)
  const withinDf = use.length - byOrg.size - 1
  const withinT = (withinRaw.r * Math.sqrt(withinDf)) / Math.sqrt(1 - withinRaw.r * withinRaw.r)
  const within = { n: use.length, r: withinRaw.r, t: withinT, df: withinDf, p: tTwoSidedP(withinT, withinDf) }

  console.log(`\n--- ${label} ---`)
  console.log(`pooled      n=${pooled.n}  r=${pooled.r.toFixed(3)}  p=${pooled.p.toExponential(2)}  (rho=${pooledRho.rho.toFixed(3)})   [p anti-conservative: rows repeat by org and by season]`)
  console.log(`between-org n=${between.n}   r=${between.r.toFixed(3)}  p=${between.p.toFixed(4)}`)
  console.log(`within-org  n=${within.n}  r=${within.r.toFixed(3)}  p=${within.p.toExponential(2)}  (df=${within.df})`)
  return { label, pooled, pooledRho, between, within, orgMeans }
}

console.log('\n=== Q1. is homegrown dependence just winning, or just market size? ===')
const vsWin = threeWays('homegrownShare vs winPct, same season', 'homegrownShare', 'winPct', panel)
const vsAtt = threeWays('homegrownShare vs home attendance, same season', 'homegrownShare', 'attendanceAvgHome', panel)
const winVsAtt = threeWays('winPct vs home attendance (for scale)', 'winPct', 'attendanceAvgHome', panel)

// lagged: dependence in S against the PREVIOUS season's win percentage, which is
// the direction a "bad teams rebuild with kids" story would run
const byKey = new Map(panel.map((r) => [`${r.orgId}:${r.season}`, r]))
const lagRows = panel
  .map((r) => {
    const prev = byKey.get(`${r.orgId}:${r.season - 1}`)
    return prev ? { ...r, winPctLag: prev.winPct } : null
  })
  .filter(Boolean)
const vsWinLag = threeWays('homegrownShare in S vs winPct in S-1', 'homegrownShare', 'winPctLag', lagRows)

// --- the free pilot, checked against the real thing ---------------------------
console.log('\n=== the free pilot (cohort counts) against the funded measure ===')
const meanShareByOrg = new Map()
for (const om of vsWin.orgMeans) meanShareByOrg.set(om.orgId, om.x)
const pilotRows = cohort.perOrg
  .filter((o) => meanShareByOrg.has(o.orgId))
  .map((o) => ({ orgId: o.orgId, name: o.name, pilotCount: o.n, meanShare: meanShareByOrg.get(o.orgId) }))
const pilotVsReal = pearson(pilotRows.map((r) => r.pilotCount), pilotRows.map((r) => r.meanShare))
const pilotVsRealRho = spearman(pilotRows.map((r) => r.pilotCount), pilotRows.map((r) => r.meanShare))
console.log(`cohort graduate count vs mean homegrown share, n=${pilotVsReal.n}: r=${pilotVsReal.r.toFixed(3)} (rho=${pilotVsRealRho.rho.toFixed(3)}), p=${pilotVsReal.p.toFixed(4)}`)
console.log(
  Math.abs(pilotVsReal.r) > 0.6
    ? '-> the free pilot would have pointed the same way. Cheap stand-in was sound.'
    : '-> the free pilot would NOT have substituted for the pull. A production count is not a dependence share.',
)

// --- descriptive tables --------------------------------------------------------
console.log('\n=== mean homegrown share by org, 2004-2023 ===')
const orgTable = [...vsWin.orgMeans]
  .map((om) => ({ ...om, meanWinPct: om.y }))
  .sort((a, b) => b.x - a.x)
for (const o of orgTable) console.log(`${(o.name ?? '').padEnd(24)} share ${o.x.toFixed(3)}  winPct ${o.y.toFixed(3)}  n=${o.n}`)

console.log('\n=== league mean homegrown share by season ===')
const bySeason = new Map()
for (const r of panel) {
  if (!bySeason.has(r.season)) bySeason.set(r.season, [])
  bySeason.get(r.season).push(r.homegrownShare)
}
const seasonRows = [...bySeason.entries()].sort((a, b) => a[0] - b[0]).map(([season, vs]) => ({ season, mean: vs.reduce((a, b) => a + b, 0) / vs.length, median: median(vs) }))
for (const s of seasonRows) console.log(`${s.season}  mean ${s.mean.toFixed(3)}  median ${s.median.toFixed(3)}`)
const trend = pearson(seasonRows.map((s) => s.season), seasonRows.map((s) => s.mean))
console.log(`league-wide time trend: r=${trend.r.toFixed(3)}, p=${trend.p.toFixed(4)} over ${trend.n} seasons`)

await writeFile(
  join(here, 'homegrown-precheck.json'),
  JSON.stringify({ withinBetweenOrg: wb, withinBetweenSeason: wbSeason, vsWin, vsWinLag, vsAtt, winVsAtt, pilot: { rows: pilotRows, pearson: pilotVsReal, spearman: pilotVsRealRho }, orgTable, seasonRows, trend }, null, 2),
)
console.log('\nwrote homegrown-precheck.json')
