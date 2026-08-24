// Related angle 2: does homegrown dependence predict WINNING?
//
// Unlike "which org promotes fast", this one has real power. 30 clubs x 20
// seasons is 600 org-seasons, and the outcome is measured without a transaction
// wire anywhere near it, so none of the instrument artifacts that dominate
// docs/team-movement-windows.md apply.
//
// Three specifications, and the difference between them is the whole point:
//
//   1. POOLED       winPct ~ homegrownShare. Between AND within, no controls.
//      This is what a scatter plot would show, and it is the least trustworthy.
//   2. + SEASON FE  removes any league-wide year effect (the share drifts over
//      the span; a common trend in both series would manufacture correlation).
//   3. + ORG FE     the within-org design: when a club's own dependence rises
//      above its own average, does it win more than its own average?
//
// SEs are two-way clustered on ORG and SEASON: rows repeat down both axes, and
// a season is a real cluster here because win percentages in one season sum to
// a constant by construction -- one club's win is another's loss.
//
// DIRECTION. Contemporaneous share and contemporaneous winning are entangled
// both ways: a club that develops well wins, and a club that wins keeps its own
// young players rather than trading them. Lagged specifications are reported for
// that reason, and none of this identifies a causal effect. Association.
//
// Writes homegrown-winning.json.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { here } from './homegrown-lib.mjs'
import { selfTest, fitOLS, clusterCov, twoWayClusterCov, withinBetween, tTwoSidedP, pearson } from './homegrown-stats.mjs'

const fails = selfTest({ verbose: false })
if (fails.length) {
  console.error(`numeric self-test failed (${fails.join(', ')}); refusing to run on real data`)
  process.exit(1)
}
console.log('numeric self-test passed\n')

const panelFile = JSON.parse(await readFile(join(here, 'homegrown-panel.json'), 'utf8'))
const cohort = JSON.parse(await readFile(join(here, 'homegrown-cohort.json'), 'utf8'))
const orgNameById = new Map(cohort.perOrg.map((o) => [o.orgId, o.name]))
const byKey = new Map(panelFile.panel.map((r) => [`${r.orgId}:${r.season}`, r]))

function rowsForLag(lag) {
  const out = []
  for (const r of panelFile.panel) {
    if (r.winPct == null) continue
    let share
    if (lag === 'trailing3') {
      const vals = []
      for (let k = 1; k <= 3; k++) {
        const p = byKey.get(`${r.orgId}:${r.season - k}`)
        if (p) vals.push(p.homegrownShare)
      }
      if (vals.length < 3) continue
      share = vals.reduce((a, b) => a + b, 0) / 3
    } else {
      const p = byKey.get(`${r.orgId}:${r.season - lag}`)
      if (!p) continue
      share = p.homegrownShare
    }
    out.push({ orgId: r.orgId, season: r.season, winPct: r.winPct, share })
  }
  return out
}

function fitPanel(rows, { orgFE, seasonFE, label }) {
  const orgIds = [...new Set(rows.map((r) => r.orgId))].sort((a, b) => a - b)
  const seasons = [...new Set(rows.map((r) => r.season))].sort((a, b) => a - b)
  const orgRef = orgIds[orgIds.length - 1]
  const seasonRef = seasons[seasons.length - 1]
  const orgCols = orgFE ? orgIds.filter((o) => o !== orgRef) : []
  const seasonCols = seasonFE ? seasons.filter((s) => s !== seasonRef) : []

  const mean = rows.reduce((s, r) => s + r.share, 0) / rows.length
  const sd = Math.sqrt(rows.reduce((s, r) => s + (r.share - mean) ** 2, 0) / rows.length)

  const X = rows.map((r) => {
    const row = [1, (r.share - mean) / sd]
    for (const s of seasonCols) row.push(r.season === s ? 1 : r.season === seasonRef ? -1 : 0)
    for (const o of orgCols) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
    return row
  })
  const y = rows.map((r) => r.winPct)
  const fit = fitOLS(X, y)
  const orgKeys = rows.map((r) => r.orgId)
  const seasonKeys = rows.map((r) => r.season)
  const byOrg = clusterCov(X, fit.resid, orgKeys, fit.XtXinv)
  const twoWay = twoWayClusterCov(X, fit.resid, orgKeys, seasonKeys, fit.XtXinv)

  const b = fit.beta[1]
  const seNaive = Math.sqrt(fit.naiveCov[1][1])
  const seOrg = Math.sqrt(byOrg.cov[1][1])
  const seTwo = twoWay.cov[1][1] > 0 ? Math.sqrt(twoWay.cov[1][1]) : null
  const df = Math.min(byOrg.G, twoWay.GB) - 1
  const winsPerSD = b * 162

  console.log(`\n--- ${label} ---`)
  console.log(`n=${rows.length}, p=${fit.p}, R^2=${fit.r2.toFixed(4)}`)
  console.log(`  homegrownShare: ${b >= 0 ? '+' : ''}${(b * 1000).toFixed(2)} points of win% per +1 SD  (= ${winsPerSD >= 0 ? '+' : ''}${winsPerSD.toFixed(2)} wins over 162)`)
  console.log(`  SE  naive ${seNaive.toFixed(5)} | by org ${seOrg.toFixed(5)} | two-way org+season ${seTwo == null ? 'non-positive' : seTwo.toFixed(5)}`)
  console.log(`  p   naive ${tTwoSidedP(b / seNaive, fit.dof).toFixed(4)} | by org (t, df=${byOrg.G - 1}) ${tTwoSidedP(b / seOrg, byOrg.G - 1).toFixed(4)} | two-way (t, df=${df}) ${seTwo == null ? 'n/a' : tTwoSidedP(b / seTwo, df).toFixed(4)}`)

  return {
    label,
    orgFE,
    seasonFE,
    n: rows.length,
    r2: fit.r2,
    betaPerSD: b,
    winPctPointsPerSD: b * 1000,
    winsPer162PerSD: winsPerSD,
    shareSD: sd,
    se: { naive: seNaive, byOrg: seOrg, twoWay: seTwo },
    p: {
      naive: tTwoSidedP(b / seNaive, fit.dof),
      byOrg: tTwoSidedP(b / seOrg, byOrg.G - 1),
      twoWay: seTwo == null ? null : tTwoSidedP(b / seTwo, df),
    },
    clusters: { orgs: byOrg.G, seasons: twoWay.GB },
  }
}

const out = { specs: [] }
console.log('=== does homegrown dependence predict winning? ===')
for (const [lag, lagName] of [
  [0, 'contemporaneous S'],
  [1, 'lagged S-1'],
  ['trailing3', 'trailing 3-year mean'],
]) {
  const rows = rowsForLag(lag)
  const wb = withinBetween(rows, 'orgId', 'share')
  console.log(`\n### ${lagName}: ${rows.length} org-seasons, share within-org SD ${wb.withinSD.toFixed(4)} vs between-org ${wb.betweenSD.toFixed(4)}`)
  out.specs.push(fitPanel(rows, { orgFE: false, seasonFE: false, label: `${lagName} | pooled, no FE` }))
  out.specs.push(fitPanel(rows, { orgFE: false, seasonFE: true, label: `${lagName} | season FE` }))
  out.specs.push(fitPanel(rows, { orgFE: true, seasonFE: true, label: `${lagName} | org FE + season FE (within-org)` }))
}

// --- the between-org picture, stated as the weak thing it is --------------------
// One point per club: 30 points. This is the shape the spike's own prior work
// warns about, included so the write-up can show it next to the panel result
// rather than leaving a reader to imagine it.
const orgMeans = new Map()
for (const r of panelFile.panel) {
  if (r.winPct == null) continue
  if (!orgMeans.has(r.orgId)) orgMeans.set(r.orgId, { shares: [], wins: [] })
  orgMeans.get(r.orgId).shares.push(r.homegrownShare)
  orgMeans.get(r.orgId).wins.push(r.winPct)
}
const bx = []
const by = []
for (const v of orgMeans.values()) {
  bx.push(v.shares.reduce((a, b) => a + b, 0) / v.shares.length)
  by.push(v.wins.reduce((a, b) => a + b, 0) / v.wins.length)
}
const between = pearson(bx, by)
console.log(`\n--- between-org, one point per club (n=${between.n}) ---`)
console.log(`  r=${between.r.toFixed(3)}, p=${between.p.toFixed(4)}  [30 points, no controls -- the shape this research already knows not to trust]`)
out.betweenOrg = between

// --- hitters and pitchers separately ---------------------------------------------
// The two shares are built from different volume units and different roster
// economics (a club can buy pitching more readily than it can buy a lineup), so
// a pooled null could be two opposite effects cancelling.
console.log('\n--- split by side, contemporaneous, org FE + season FE ---')
for (const key of ['homegrownShareHit', 'homegrownSharePit']) {
  const rows = panelFile.panel.filter((r) => r.winPct != null && r[key] != null).map((r) => ({ orgId: r.orgId, season: r.season, winPct: r.winPct, share: r[key] }))
  out.specs.push(fitPanel(rows, { orgFE: true, seasonFE: true, label: `${key} | org FE + season FE` }))
}

// --- the extremes, for a reader ----------------------------------------------------
const table = [...orgMeans.entries()]
  .map(([orgId, v]) => ({
    orgId,
    name: orgNameById.get(orgId) ?? String(orgId),
    share: v.shares.reduce((a, b) => a + b, 0) / v.shares.length,
    winPct: v.wins.reduce((a, b) => a + b, 0) / v.wins.length,
  }))
  .sort((a, b) => b.share - a.share)
out.orgTable = table

await writeFile(join(here, 'homegrown-winning.json'), JSON.stringify(out, null, 2))
console.log('\nwrote homegrown-winning.json')
