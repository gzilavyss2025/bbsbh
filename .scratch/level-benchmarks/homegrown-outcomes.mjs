// Related angle 1: REVERSE THE ARROW. Does fast promotion pay off?
//
// The whole of docs/team-movement-windows.md asks who promotes fast. This asks
// whether it works -- which is the more decision-useful question, and one the
// data can actually carry, because the outcome side (public/data/war-history/,
// FanGraphs season WAR joined on xMLBAMID) is already in the repo.
//
// DELIBERATELY NOT AN ORG-LEVEL CORRELATION. "Org promotion speed against that
// org's graduates' career WAR" is the n=30 two-unreliable-estimates shape this
// research already knows produces numbers and no information. The same question
// asked at PLAYER level has ~1,300 units and can carry an org fixed effect on
// top, which turns it into "within one organization, did the players it moved
// faster turn out better?" -- a sharper question and a better-powered one.
//
// THE MEASUREMENTS
//
//  SPEED. A player's own promotion speed is the mean of his duration residuals
//  from log(days) ~ level + tier + era3 + org. Residualising is what makes the
//  numbers comparable: a raw mean would rank a player who happened to pass
//  through AAA (the fastest level) against one who did not. Positive residual =
//  SLOWER than the model expects, so every coefficient below is signed for
//  slowness and the prose says which way that points.
//
//  OUTCOME. WAR over a FIXED SIX-SEASON WINDOW from the debut year, not career
//  WAR. Career WAR is censored twice over here -- war-history starts at 2010,
//  and a 2023 debut has played three seasons against a 2010 debut's sixteen --
//  so a career total would mostly measure how long ago a player debuted. The
//  window closes both ends: debuts are restricted to 2010-2018 so that every
//  player in the sample has all six of his seasons inside the data. A season
//  with no WAR row counts as 0, which is the right reading: he produced no
//  major-league value that year.
//
//  BUST RATE. The share of graduates whose six-season WAR is at or below zero.
//  A second outcome on the same rows, because a mean can hide a tail.
//
// THE GAP THIS CANNOT CLOSE. Every player here reached the majors. An org that
// promotes aggressively and releases aggressively never shows its failures in
// this cohort, so "fast promotion pays off" can only ever mean "among players
// who made it". docs/team-movement-windows.md's cohort-selection section is the
// standing statement of that limit and nothing here changes it.
//
// Writes homegrown-outcomes.json.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { here, buildOrgMap, median } from './homegrown-lib.mjs'
import { shardKey100 } from '../../src/lib/shardKey.js'
import { selfTest, fitOLS, clusterCov, tTwoSidedP, pearson, spearman } from './homegrown-stats.mjs'

const fails = selfTest({ verbose: false })
if (fails.length) {
  console.error(`numeric self-test failed (${fails.join(', ')}); refusing to run on real data`)
  process.exit(1)
}
console.log('numeric self-test passed\n')

const DEBUT_MIN = 2010 // war-history starts here
const DEBUT_MAX = 2018 // so debut+5 is still inside the data
const WINDOW = 6

const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const dates = JSON.parse(await readFile(join(here, 'dates.json'), 'utf8'))
const findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const cohortFile = JSON.parse(await readFile(join(here, 'homegrown-cohort.json'), 'utf8'))
const panelFile = JSON.parse(await readFile(join(here, 'homegrown-panel.json'), 'utf8'))
const draftCache = JSON.parse(await readFile(join(here, 'draft-cache.json'), 'utf8'))
const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))
const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))
const orgMap = await buildOrgMap({ seasonMin: 1997, seasonMax: 2023 })

// --- WAR, straight off the shipped shards ---------------------------------------
const warRoot = join(here, '..', '..', 'public', 'data', 'war-history')
const shards = new Map()
async function warShard(key) {
  if (!shards.has(key)) {
    try {
      shards.set(key, JSON.parse(await readFile(join(warRoot, `${key}.json`), 'utf8')))
    } catch {
      shards.set(key, { bat: {}, pit: {} })
    }
  }
  return shards.get(key)
}
async function warWindow(personId, fromSeason) {
  const s = await warShard(shardKey100(personId))
  let total = 0
  let seasonsWithWar = 0
  for (let y = fromSeason; y < fromSeason + WINDOW; y++) {
    const b = s.bat?.[personId]?.[y]
    const p = s.pit?.[personId]?.[y]
    if (b == null && p == null) continue
    total += (b ?? 0) + (p ?? 0)
    seasonsWithWar++
  }
  return { total, seasonsWithWar }
}

// --- speed residuals -------------------------------------------------------------
const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }
function orgForDuration(playerId, level, season) {
  const p = playersById.get(playerId)
  if (!p) return null
  const rows = (p.milb ?? []).filter((r) => r.sportId === LEVEL_SPORT[level])
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.season - season) < Math.abs(best.season - season)) best = r
  const hit = orgMap.get(`${best.teamId}:${best.season}`)
  return hit ? { orgId: hit[0], orgName: hit[1] } : null
}
function tierFromRound(round) {
  if (!round) return 'No draft record'
  const r = String(round)
  if (r === '1' || r === '1C' || r === 'CB-A' || r === 'C-A') return 'Round 1'
  const n = Number(r)
  if (!Number.isFinite(n)) return 'Round 1'
  if (n <= 5 || r === '2C' || r === 'CB-B') return 'Rounds 2-5'
  if (n <= 10) return 'Rounds 6-10'
  return 'Round 11+'
}
function correctedTier(playerId) {
  const person = draftCache[playerId]
  if (!person) return tierFromRound(playersById.get(playerId)?.ped?.draftRound)
  const drafts = person.drafts ?? []
  const signed = drafts.find((d) => String(d.year) === String(person.draftYear)) ?? (drafts.length ? drafts[drafts.length - 1] : null)
  return tierFromRound(signed?.pickRound)
}
const ERA3 = (season) => (season <= 2015 ? 'A' : season <= 2020 ? 'B' : 'C')

const durRows = []
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  if (d.days <= 0) continue
  if (d.season < 2011) continue // the wire floor, same as everywhere else in this spike
  const org = orgForDuration(d.playerId, d.level, d.season)
  if (!org) continue
  durRows.push({ playerId: d.playerId, orgId: org.orgId, orgName: org.orgName, level: d.level, tier: correctedTier(d.playerId), era3: ERA3(d.season), logDays: Math.log(d.days) })
}
console.log(`durations for the speed model: ${durRows.length}`)

const LEVELS = ['A', 'High-A', 'AA', 'AAA'].filter((l) => durRows.some((r) => r.level === l))
const TIERS = ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record'].filter((t) => durRows.some((r) => r.tier === t))
const ERAS = ['A', 'B', 'C'].filter((e) => durRows.some((r) => r.era3 === e))
const ORGS = [...new Set(durRows.map((r) => r.orgId))].sort((a, b) => a - b)
const refs = { level: LEVELS[LEVELS.length - 1], tier: TIERS[TIERS.length - 1], era: ERAS[ERAS.length - 1], org: ORGS[ORGS.length - 1] }
const designSpeed = (r) => {
  const row = [1]
  for (const l of LEVELS.filter((x) => x !== refs.level)) row.push(r.level === l ? 1 : r.level === refs.level ? -1 : 0)
  for (const t of TIERS.filter((x) => x !== refs.tier)) row.push(r.tier === t ? 1 : r.tier === refs.tier ? -1 : 0)
  for (const e of ERAS.filter((x) => x !== refs.era)) row.push(r.era3 === e ? 1 : r.era3 === refs.era ? -1 : 0)
  for (const o of ORGS.filter((x) => x !== refs.org)) row.push(r.orgId === o ? 1 : r.orgId === refs.org ? -1 : 0)
  return row
}
const speedFit = fitOLS(durRows.map(designSpeed), durRows.map((r) => r.logDays))
console.log(`speed model: n=${speedFit.n}, R^2=${speedFit.r2.toFixed(4)}`)

const residByPlayer = new Map()
durRows.forEach((r, i) => {
  if (!residByPlayer.has(r.playerId)) residByPlayer.set(r.playerId, { resids: [], orgs: new Map() })
  residByPlayer.get(r.playerId).resids.push(speedFit.resid[i])
  const o = residByPlayer.get(r.playerId).orgs
  o.set(r.orgId, (o.get(r.orgId) || 0) + 1)
})

// --- assemble the player-level rows ------------------------------------------------
const homeOrgOf = new Map(Object.entries(cohortFile.resolved).map(([id, v]) => [Number(id), v.orgId]))
const panelByKey = new Map(panelFile.panel.map((r) => [`${r.orgId}:${r.season}`, r]))

const rows = []
let noWar = 0
for (const [playerId, agg] of residByPlayer) {
  const p = playersById.get(playerId)
  const debutYear = Number((p?.debutDate || '').slice(0, 4))
  if (!(debutYear >= DEBUT_MIN && debutYear <= DEBUT_MAX)) continue
  const { total, seasonsWithWar } = await warWindow(playerId, debutYear)
  if (seasonsWithWar === 0) {
    noWar++
    continue
  }
  // the org he spent most of his measured durations with
  let devOrg = null
  let best = 0
  for (const [o, n] of agg.orgs) if (n > best) ((best = n), (devOrg = o))
  const homeOrg = homeOrgOf.get(playerId) ?? null
  const share = homeOrg != null ? panelByKey.get(`${homeOrg}:${debutYear - 1}`)?.homegrownShare ?? null : null
  rows.push({
    playerId,
    name: p?.ped?.name ?? '',
    group: p?.group ?? '',
    tier: correctedTier(playerId),
    debutYear,
    devOrg,
    homeOrg,
    entryOrgShare: share,
    nDurations: agg.resids.length,
    slownessResid: agg.resids.reduce((a, b) => a + b, 0) / agg.resids.length,
    war6: total,
    seasonsWithWar,
  })
}
console.log(`players: ${rows.length} with a debut ${DEBUT_MIN}-${DEBUT_MAX} and at least one WAR season; ${noWar} dropped for no WAR row in the window`)
console.log(`WAR over ${WINDOW} seasons: median ${median(rows.map((r) => r.war6)).toFixed(2)}, mean ${(rows.reduce((s, r) => s + r.war6, 0) / rows.length).toFixed(2)}`)
console.log(`bust rate (WAR6 <= 0): ${((rows.filter((r) => r.war6 <= 0).length / rows.length) * 100).toFixed(1)}%`)

// --- the model ----------------------------------------------------------------------
function fitOutcome(outcomeKey, { orgFE, label }) {
  const use = rows.filter((r) => r[outcomeKey] != null && r.devOrg != null)
  const groups = ['hitting', 'pitching'].filter((g) => use.some((r) => r.group === g))
  const tiers = TIERS.filter((t) => use.some((r) => r.tier === t))
  const years = [...new Set(use.map((r) => r.debutYear))].sort((a, b) => a - b)
  const orgs = [...new Set(use.map((r) => r.devOrg))].sort((a, b) => a - b)
  const gRef = groups[groups.length - 1]
  const tRef = tiers[tiers.length - 1]
  const yRef = years[years.length - 1]
  const oRef = orgs[orgs.length - 1]

  const mean = use.reduce((s, r) => s + r.slownessResid, 0) / use.length
  const sd = Math.sqrt(use.reduce((s, r) => s + (r.slownessResid - mean) ** 2, 0) / use.length)

  const X = use.map((r) => {
    const row = [1, (r.slownessResid - mean) / sd]
    for (const g of groups.filter((x) => x !== gRef)) row.push(r.group === g ? 1 : r.group === gRef ? -1 : 0)
    for (const t of tiers.filter((x) => x !== tRef)) row.push(r.tier === t ? 1 : r.tier === tRef ? -1 : 0)
    for (const y of years.filter((x) => x !== yRef)) row.push(r.debutYear === y ? 1 : r.debutYear === yRef ? -1 : 0)
    if (orgFE) for (const o of orgs.filter((x) => x !== oRef)) row.push(r.devOrg === o ? 1 : r.devOrg === oRef ? -1 : 0)
    return row
  })
  const y = use.map((r) => r[outcomeKey])
  const fit = fitOLS(X, y)
  const byOrg = clusterCov(X, fit.resid, use.map((r) => r.devOrg), fit.XtXinv)
  const b = fit.beta[1]
  const seNaive = Math.sqrt(fit.naiveCov[1][1])
  const seOrg = Math.sqrt(byOrg.cov[1][1])
  console.log(`\n--- ${label} ---`)
  console.log(`n=${use.length}, p=${fit.p}, R^2=${fit.r2.toFixed(4)}`)
  console.log(`  +1 SD SLOWER promotion -> ${b >= 0 ? '+' : ''}${b.toFixed(3)} ${outcomeKey}`)
  console.log(`  SE naive ${seNaive.toFixed(4)} (p=${tTwoSidedP(b / seNaive, fit.dof).toFixed(4)}) | by org ${seOrg.toFixed(4)} (p=${tTwoSidedP(b / seOrg, byOrg.G - 1).toFixed(4)})`)
  return { label, outcomeKey, orgFE, n: use.length, r2: fit.r2, betaPerSD: b, seNaive, seOrg, pNaive: tTwoSidedP(b / seNaive, fit.dof), pByOrg: tTwoSidedP(b / seOrg, byOrg.G - 1), residSD: sd }
}

console.log('\n=== does slower promotion predict a better first six seasons? ===')
const out = { specs: [] }
out.specs.push(fitOutcome('war6', { orgFE: false, label: 'WAR over 6 seasons | no org FE' }))
out.specs.push(fitOutcome('war6', { orgFE: true, label: 'WAR over 6 seasons | dev-org FE (within-org)' }))

// bust as a linear probability model on the same rows
for (const r of rows) r.bust = r.war6 <= 0 ? 1 : 0
out.specs.push(fitOutcome('bust', { orgFE: false, label: 'bust (WAR6 <= 0) | no org FE' }))
out.specs.push(fitOutcome('bust', { orgFE: true, label: 'bust (WAR6 <= 0) | dev-org FE' }))

// --- a table a reader can hold ---------------------------------------------------
const sorted = [...rows].sort((a, b) => a.slownessResid - b.slownessResid)
const third = Math.floor(sorted.length / 3)
const buckets = [
  { name: 'fastest third', rs: sorted.slice(0, third) },
  { name: 'middle third', rs: sorted.slice(third, 2 * third) },
  { name: 'slowest third', rs: sorted.slice(2 * third) },
]
console.log('\n=== by promotion-speed tercile (raw, no controls) ===')
const tercileTable = buckets.map((b) => ({
  name: b.name,
  n: b.rs.length,
  medianWar6: median(b.rs.map((r) => r.war6)),
  meanWar6: b.rs.reduce((s, r) => s + r.war6, 0) / b.rs.length,
  bustRate: b.rs.filter((r) => r.war6 <= 0).length / b.rs.length,
}))
for (const t of tercileTable) console.log(`${t.name.padEnd(16)} n=${t.n}  median WAR6 ${t.medianWar6.toFixed(2)}  mean ${t.meanWar6.toFixed(2)}  bust ${(t.bustRate * 100).toFixed(1)}%`)
out.tercileTable = tercileTable

// --- and the org's own dependence against its graduates' outcomes -----------------
// The homegrown question applied to the outcome side: do the graduates of a
// more homegrown-dependent organisation turn out better or worse? Entry-org
// share is taken in the season before the player's debut.
const withShare = rows.filter((r) => r.entryOrgShare != null)
const shareVsWar = pearson(withShare.map((r) => r.entryOrgShare), withShare.map((r) => r.war6))
const shareVsWarRho = spearman(withShare.map((r) => r.entryOrgShare), withShare.map((r) => r.war6))
console.log(`\n=== entry-org homegrown share vs the graduate's own WAR6 (n=${shareVsWar.n}) ===`)
console.log(`  r=${shareVsWar.r.toFixed(3)} (rho=${shareVsWarRho.rho.toFixed(3)}), naive p=${shareVsWar.p.toFixed(4)}  [rows cluster by org; read the p as a ceiling on the evidence, not the evidence]`)
out.entryShareVsWar = { pearson: shareVsWar, spearman: shareVsWarRho }
out.playerRows = rows.map(({ playerId, name, group, tier, debutYear, devOrg, homeOrg, entryOrgShare, nDurations, slownessResid, war6, bust }) => ({ playerId, name, group, tier, debutYear, devOrg, homeOrg, entryOrgShare, nDurations, slownessResid, war6, bust }))

// ============================================================================
// THE OBJECTION THAT MATTERS, AND THE ONLY TEST THIS DATA CAN GIVE IT
// ============================================================================
// Speed is not exogenous. Clubs promote the players who are playing well, and
// players who play well in the minors go on to produce major-league value --
// docs/team-movement-windows.md measures the first half of that directly, at
// z=-8.7, the strongest single effect anywhere in this research. So "fast movers
// turned out better" is, to an unknown degree, "good players turned out better"
// restated. It is a DESCRIPTION of what happened, not a lever a club could pull.
//
// The available test is to hold in-level performance constant and see whether
// anything survives. perf-pool.json already carries the full (not qualification-
// floored) hitting and pitching population for every level-season the cohort
// touches, so each duration gets an OPS percentile (hitters) or inverted-ERA
// percentile (pitchers) within its own level-season, averaged to the player.
//
// THE TEST IS COMPROMISED IN A KNOWN DIRECTION and the write-up has to say so:
// computing a percentile needs enough PA/IP to rank, and accumulating PA/IP
// needs TIME AT THE LEVEL, so the volume floor removes the fastest promotions
// preferentially. That is the exact trap the performance section of
// docs/team-movement-windows.md found. The loss is measured below rather than
// waved at.
const perfPool = JSON.parse(await readFile(join(here, 'perf-pool.json'), 'utf8'))
const POOL_MIN_PA = 1
const POOL_MIN_IP = 1
const ROW_MIN_PA = 20
const ROW_MIN_IP = 10
function percentile(sportId, season, group, value) {
  const pool = (perfPool[`${sportId}:${season}:${group}`] || []).filter((r) => (group === 'hitting' ? r.plateAppearances >= POOL_MIN_PA && r.ops != null : r.inningsPitched >= POOL_MIN_IP && r.era != null))
  if (pool.length < 20) return null
  const values = pool.map((r) => (group === 'hitting' ? r.ops : r.era)).sort((a, b) => a - b)
  const below = group === 'hitting' ? values.filter((v) => v < value).length : values.filter((v) => v > value).length
  const atOrBelow = group === 'hitting' ? values.filter((v) => v <= value).length : values.filter((v) => v >= value).length
  return (((below + atOrBelow) / 2 / values.length) * 100)
}
function bestMilbRow(playerId, level, season) {
  const p = playersById.get(playerId)
  const rowsAt = (p?.milb ?? []).filter((r) => r.sportId === LEVEL_SPORT[level])
  if (!rowsAt.length) return null
  let best = rowsAt[0]
  for (const r of rowsAt) if (Math.abs(r.season - season) < Math.abs(best.season - season)) best = r
  return best
}
const perfByPlayer = new Map()
let belowFloor = 0
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  if (d.days <= 0 || d.season < 2011) continue
  const p = playersById.get(d.playerId)
  if (!p) continue
  const best = bestMilbRow(d.playerId, d.level, d.season)
  if (!best) continue
  const stat = best.stat || {}
  let value = null
  if (p.group === 'hitting') {
    if (stat.plateAppearances >= ROW_MIN_PA && stat.ops != null) value = Number(stat.ops)
  } else {
    const ip = stat.inningsPitched != null ? Number(stat.inningsPitched) : 0
    if (ip >= ROW_MIN_IP && stat.era != null) value = Number(stat.era)
  }
  if (value == null) {
    belowFloor++
    continue
  }
  const pct = percentile(LEVEL_SPORT[d.level], best.season, p.group, value)
  if (pct == null) continue
  if (!perfByPlayer.has(d.playerId)) perfByPlayer.set(d.playerId, [])
  perfByPlayer.get(d.playerId).push(pct)
}
for (const r of rows) {
  const ps = perfByPlayer.get(r.playerId)
  r.perfPctile = ps?.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null
}
const withPerf = rows.filter((r) => r.perfPctile != null)
console.log(`\n=== in-level performance control ===`)
console.log(`${belowFloor} durations fall below the PA>=${ROW_MIN_PA}/IP>=${ROW_MIN_IP} floor`)
console.log(`players with a usable performance percentile: ${withPerf.length} of ${rows.length}`)
const droppedRows = rows.filter((r) => r.perfPctile == null)
if (droppedRows.length) {
  console.log(`  dropped players' mean slowness residual ${(droppedRows.reduce((s, r) => s + r.slownessResid, 0) / droppedRows.length).toFixed(3)} vs kept ${(withPerf.reduce((s, r) => s + r.slownessResid, 0) / withPerf.length).toFixed(3)}`)
  console.log('  (a NEGATIVE gap means the floor removed the faster movers, exactly the known trap)')
}

function fitWithPerf(subset, { includePerf, label }) {
  const groups = ['hitting', 'pitching'].filter((g) => subset.some((r) => r.group === g))
  const tiers = TIERS.filter((t) => subset.some((r) => r.tier === t))
  const years = [...new Set(subset.map((r) => r.debutYear))].sort((a, b) => a - b)
  const gRef = groups[groups.length - 1]
  const tRef = tiers[tiers.length - 1]
  const yRef = years[years.length - 1]
  const mean = subset.reduce((s, r) => s + r.slownessResid, 0) / subset.length
  const sd = Math.sqrt(subset.reduce((s, r) => s + (r.slownessResid - mean) ** 2, 0) / subset.length)
  const X = subset.map((r) => {
    const row = [1, (r.slownessResid - mean) / sd]
    for (const g of groups.filter((x) => x !== gRef)) row.push(r.group === g ? 1 : r.group === gRef ? -1 : 0)
    for (const t of tiers.filter((x) => x !== tRef)) row.push(r.tier === t ? 1 : r.tier === tRef ? -1 : 0)
    for (const y of years.filter((x) => x !== yRef)) row.push(r.debutYear === y ? 1 : r.debutYear === yRef ? -1 : 0)
    if (includePerf) row.push((r.perfPctile - 50) / 10)
    return row
  })
  const fit = fitOLS(X, subset.map((r) => r.war6))
  const byOrg = clusterCov(X, fit.resid, subset.map((r) => r.devOrg), fit.XtXinv)
  const b = fit.beta[1]
  const seOrg = Math.sqrt(byOrg.cov[1][1])
  const perfB = includePerf ? fit.beta[fit.p - 1] : null
  console.log(`\n--- ${label} ---`)
  console.log(`n=${subset.length}, R^2=${fit.r2.toFixed(4)}`)
  console.log(`  +1 SD SLOWER -> ${b >= 0 ? '+' : ''}${b.toFixed(3)} WAR6, org-clustered p=${tTwoSidedP(b / seOrg, byOrg.G - 1).toFixed(4)}`)
  if (includePerf) console.log(`  +10 in-level performance percentile points -> ${perfB >= 0 ? '+' : ''}${perfB.toFixed(3)} WAR6`)
  return { label, n: subset.length, r2: fit.r2, betaPerSD: b, seOrg, pByOrg: tTwoSidedP(b / seOrg, byOrg.G - 1), perfBetaPer10: perfB }
}
out.perfControl = {
  eligible: withPerf.length,
  total: rows.length,
  baseline: fitWithPerf(withPerf, { includePerf: false, label: 'performance-eligible subsample, NO performance control' }),
  augmented: fitWithPerf(withPerf, { includePerf: true, label: 'performance-eligible subsample, WITH performance control' }),
}

await writeFile(join(here, 'homegrown-outcomes.json'), JSON.stringify(out, null, 2))
console.log('\nwrote homegrown-outcomes.json')
