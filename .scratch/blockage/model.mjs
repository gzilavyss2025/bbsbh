// Price the blockage.
//
// The ask: for every Triple-A stay, describe the job above the man, then ask
// whether that description predicts the length of the stay better than the
// prospect's own line does.
//
// What this adds to the ask:
//   - service-clock contract years, which are arithmetic inside the six-year
//     window and only unknown outside it
//   - a season-days outcome, because the benchmark's calendar days count the
//     winter as waiting
//   - the outcomes that are not waiting: he was traded, or he changed position
//   - a scarcity cut, which is the falsification test - blockage that bites
//     the same at catcher and in the bullpen is not blockage
import { readFileSync, writeFileSync } from 'node:fs'
import { ols, logistic, multinomial, fTest, median, quantile, mean, zscoreBy } from './lib.mjs'

const BENCH = 'C:/Users/gzilavy/bbsbh/.scratch/level-benchmarks'
const stays = JSON.parse(readFileSync('stays.json', 'utf8'))
const bio = JSON.parse(readFileSync('incumbent-bio.json', 'utf8'))
const mlb = JSON.parse(readFileSync('mlb-cache.json', 'utf8'))
const standings = JSON.parse(readFileSync(`${BENCH}/standings-cache.json`, 'utf8'))
// Who actually ended the stay, and why: read off the transaction wire
// (join-txn.mjs), not inferred from the level change alone. See exits.json's
// own header comment in join-txn.mjs for how "merit / injury / rosterRule /
// demoted / traded / settledEarlier / unresolved" are drawn from typeCode.
const exits = JSON.parse(readFileSync('exits.json', 'utf8'))

const out = {}
const say = (...a) => console.log(...a)

// ---- the contract, reconstructed ----------------------------------------
// Three pre-arbitration years then three arbitration years, unchanged across
// every season in this sample. So for any incumbent inside his first six, the
// years he is signed for are arithmetic off his debut. Outside the six they
// are a real contract this repo cannot see - Cot's here is a 2026 snapshot.
//
// The clock is SERVICE time, not seasons since debut: a man called up in
// September does not bank a year. Aug 15 is the cut - a debut after it starts
// the clock the following season.
function serviceStart(debutIso) {
  if (!debutIso) return null
  const y = Number(debutIso.slice(0, 4))
  const md = debutIso.slice(5)
  return md > '08-15' ? y + 1 : y
}

// Where a man actually appeared in the majors, by season - used both for the
// stricter service estimate and for how entrenched he already is with the club.
const appearances = new Map()
for (const [key, rows] of Object.entries(mlb)) {
  const [seasonStr, group] = key.split(':')
  if (group === 'fielding') continue
  const season = Number(seasonStr)
  for (const r of rows) {
    const played = group === 'hitting' ? (r.pa || 0) > 0 : (r.ip || 0) > 0
    if (!played) continue
    if (!appearances.has(r.p)) appearances.set(r.p, new Map())
    const bySeason = appearances.get(r.p)
    if (!bySeason.has(season)) bySeason.set(season, new Set())
    bySeason.get(season).add(r.t)
  }
}

function serviceYears(incId, staySeason) {
  const b = bio[String(incId)]
  const start = serviceStart(b && b.debut)
  if (start == null) return null
  return Math.max(0, staySeason - start)
}

// Stricter variant: count only seasons he was actually in the majors. A man
// optioned back down for a year does not accrue service he did not earn.
function serviceYearsStrict(incId, staySeason) {
  const b = bio[String(incId)]
  const start = serviceStart(b && b.debut)
  if (start == null) return null
  const seasons = appearances.get(incId)
  if (!seasons) return Math.max(0, staySeason - start)
  let count = 0
  for (let y = start; y < staySeason; y += 1) if (seasons.has(y)) count += 1
  return count
}

function orgTenure(incId, orgId, staySeason) {
  const seasons = appearances.get(incId)
  if (!seasons) return 0
  let count = 0
  for (let y = staySeason - 1; y >= staySeason - 10; y -= 1) {
    const teams = seasons.get(y)
    if (teams && teams.has(orgId)) count += 1
    else break
  }
  return count
}

// ---- the outcome, twice --------------------------------------------------
// The benchmark's day count runs straight through the winter. A stay that
// starts in late August and ends on opening day reads as 223 days of waiting,
// and about 180 of those are months when nobody plays anywhere.
function activeDays(startIso, endIso) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  let days = 0
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y += 1) {
    const seasonStart = new Date(Date.UTC(y, 3, 1))
    const seasonEnd = new Date(Date.UTC(y, 9, 1))
    const lo = start > seasonStart ? start : seasonStart
    const hi = end < seasonEnd ? end : seasonEnd
    if (hi > lo) days += (hi - lo) / 86400000
  }
  return Math.round(days)
}

function draftTier(round) {
  const r = Number(round)
  if (!Number.isFinite(r)) return 'none'
  if (r <= 1) return 'r1'
  if (r <= 5) return 'r2_5'
  if (r <= 15) return 'r6_15'
  return 'r16plus'
}

// ---- assemble ------------------------------------------------------------
const rows = []
for (const s of stays) {
  if (!s.job || !s.job.id) continue
  const svc = serviceYears(s.job.id, s.season)
  if (svc == null) continue
  const svcStrict = serviceYearsStrict(s.job.id, s.season)
  const vol = s.group === 'hitting' ? s.ownPa : s.ownIp
  if (!vol) continue
  // A pitcher with a cumulative 0.00 ERA at the level (a real, if rare,
  // outcome for a short dominant stint) must not be treated as "no rate" -
  // `ownEra > 0` used to gate this and silently dropped every one of them.
  const rate = s.group === 'hitting' ? s.ownOps : -s.ownEra
  if (rate == null || !Number.isFinite(rate)) continue
  const act = activeDays(s.startDate, s.endDate)
  const exit = exits[`${s.playerId}:${s.season}:${s.endDate}`] || null
  rows.push({
    ...s,
    rate,
    vol,
    activeDays: Math.max(1, act),
    calDays: Math.max(1, s.days),
    svc,
    svcStrict,
    controlLeft: Math.max(0, 6 - svc),
    controlLeftStrict: Math.max(0, 6 - svcStrict),
    jobTenure: orgTenure(s.job.id, s.orgId, s.season),
    jobQualityRaw: s.job.quality,
    jobDepth: s.job.depth,
    jobAge: s.job.age,
    jobLagQualityRaw: s.jobLag ? s.jobLag.quality : null,
    jobLagControlLeft: s.jobLag && s.jobLag.id != null
      ? (serviceYears(s.jobLag.id, s.season - 1) == null
        ? null
        : Math.max(0, 6 - serviceYears(s.jobLag.id, s.season - 1)))
      : null,
    // The other job-above-him variables besides quality/control also need a
    // real lag, not just a relabeled current-season value - see jobCols().
    jobLagDepth: s.jobLag ? s.jobLag.depth : null,
    jobLagAge: s.jobLag ? s.jobLag.age : null,
    orgWinPctLag: standings[`${s.orgId}:${s.season - 1}`] ? standings[`${s.orgId}:${s.season - 1}`].winPct : null,
    jobTenureLag: s.jobLag && s.jobLag.id != null ? orgTenure(s.jobLag.id, s.orgId, s.season - 1) : null,
    tier: draftTier(s.draftRound),
    era: s.season <= 2013 ? 'e1' : s.season <= 2018 ? 'e2' : 'e3',
    exitReason: exit ? exit.exitReason : 'unresolved',
    prospectEvent: exit ? exit.prospectEvent : 'unmatched',
    incumbentEvent: exit ? exit.incumbentEvent : 'none',
  })
}

say(`rows usable: ${rows.length} of ${stays.length} stays`)
out.n = rows.length

// Standardise inside season and group so an incumbent's line reads against his
// own league-year, and a hitter's line and a pitcher's line share a scale.
const rateZ = zscoreBy(rows, (r) => `${r.season}:${r.group}`, (r) => r.rate)
const jobQZ = zscoreBy(rows, (r) => `${r.season}:${r.group}`, (r) => r.jobQualityRaw)
const jobLagQZ = zscoreBy(rows, (r) => `${r.season}:${r.group}`, (r) => r.jobLagQualityRaw)
rows.forEach((r, i) => {
  r.rateZ = rateZ[i] ?? 0
  r.jobQZ = jobQZ[i] ?? 0
  r.jobLagQZ = jobLagQZ[i] ?? 0
})

const ageMean = mean(rows.map((r) => r.ageAtStay).filter((v) => v != null))
const depthMean = mean(rows.map((r) => r.jobDepth))
const jobAgeMean = mean(rows.map((r) => r.jobAge).filter((v) => v != null))
const winMean = mean(rows.map((r) => r.orgWinPct).filter((v) => v != null))

// ---- descriptives --------------------------------------------------------
say('\n=== how long is a Triple-A stay, two ways of counting ===')
const cal = rows.map((r) => r.calDays)
const act = rows.map((r) => r.activeDays)
say(`calendar days  median ${median(cal)}  [p25 ${quantile(cal, 0.25)} - p75 ${quantile(cal, 0.75)}]`)
say(`season days    median ${median(act)}  [p25 ${quantile(act, 0.25)} - p75 ${quantile(act, 0.75)}]`)
out.duration = {
  calendar: { median: median(cal), p25: quantile(cal, 0.25), p75: quantile(cal, 0.75) },
  season: { median: median(act), p25: quantile(act, 0.25), p75: quantile(act, 0.75) },
}

say('\n=== stay length by how long the man above him is signed for ===')
const ctrlBuckets = [
  ['post-control (0 yrs left)', (r) => r.controlLeft === 0],
  ['arbitration (1-3 left)', (r) => r.controlLeft >= 1 && r.controlLeft <= 3],
  ['pre-arb (4-6 left)', (r) => r.controlLeft >= 4],
]
out.byControl = []
for (const [label, f] of ctrlBuckets) {
  const g = rows.filter(f)
  const rec = {
    label,
    n: g.length,
    medianSeasonDays: median(g.map((r) => r.activeDays)),
    medianCalDays: median(g.map((r) => r.calDays)),
  }
  out.byControl.push(rec)
  say(`  ${label.padEnd(26)} n=${String(g.length).padStart(3)}  season-days median ${rec.medianSeasonDays}`)
}

say('\n=== stay length by how well the man above him is playing ===')
const qCuts = [quantile(rows.map((r) => r.jobQZ), 0.33), quantile(rows.map((r) => r.jobQZ), 0.67)]
const qBuckets = [
  ['incumbent struggling', (r) => r.jobQZ <= qCuts[0]],
  ['incumbent average', (r) => r.jobQZ > qCuts[0] && r.jobQZ < qCuts[1]],
  ['incumbent good', (r) => r.jobQZ >= qCuts[1]],
]
out.byQuality = []
for (const [label, f] of qBuckets) {
  const g = rows.filter(f)
  const rec = { label, n: g.length, medianSeasonDays: median(g.map((r) => r.activeDays)) }
  out.byQuality.push(rec)
  say(`  ${label.padEnd(26)} n=${String(g.length).padStart(3)}  season-days median ${rec.medianSeasonDays}`)
}

// ---- the models ----------------------------------------------------------
const TIERS = ['r1', 'r2_5', 'r6_15', 'r16plus']

function baseCols(r, pooled) {
  const c = [1, r.rateZ, (r.ageAtStay ?? ageMean) - ageMean]
  for (const t of TIERS) c.push(r.tier === t ? 1 : 0)
  c.push(r.era === 'e2' ? 1 : 0, r.era === 'e3' ? 1 : 0)
  if (pooled) c.push(r.group === 'pitching' ? 1 : 0)
  return c
}
function baseNames(pooled) {
  const n = ['intercept', 'own rate (z)', 'age at stay']
  for (const t of TIERS) n.push(`draft ${t}`)
  n.push('era 2014-18', 'era 2019-23')
  if (pooled) n.push('is pitcher')
  return n
}
// useLag=true must describe the job as it stood a season EARLIER, in full -
// quality and control were already doing this; depth/age/org win pct/tenure
// were silently reading the current season regardless of the flag, so a
// "lagged" fit was still half-leaking concurrent information. Every term
// here now switches together.
function jobCols(r, useLag) {
  if (!useLag) {
    return [
      r.jobQZ,
      r.controlLeft / 6,
      r.jobDepth - depthMean,
      (r.jobAge ?? jobAgeMean) - jobAgeMean,
      (r.orgWinPct ?? winMean) - winMean,
      r.jobTenure,
    ]
  }
  return [
    r.jobLagQZ,
    (r.jobLagControlLeft ?? r.controlLeft) / 6,
    (r.jobLagDepth ?? r.jobDepth) - depthMean,
    (r.jobLagAge ?? r.jobAge ?? jobAgeMean) - jobAgeMean,
    (r.orgWinPctLag ?? r.orgWinPct ?? winMean) - winMean,
    r.jobTenureLag ?? r.jobTenure,
  ]
}
const JOB_NAMES = [
  'incumbent quality (z)',
  'incumbent control yrs left / 6',
  'incumbent depth at job',
  'incumbent age',
  'parent club win pct',
  'incumbent tenure with org',
]

function fitPair(subset, label, { pooled = true, outcome = 'activeDays', useLag = false } = {}) {
  if (subset.length < 60) return null
  const y = subset.map((r) => Math.log(r[outcome]))
  const Xa = subset.map((r) => baseCols(r, pooled))
  const Xb = subset.map((r) => [...baseCols(r, pooled), ...jobCols(r, useLag)])
  const a = ols(Xa, y, baseNames(pooled))
  const b = ols(Xb, y, [...baseNames(pooled), ...JOB_NAMES])
  const f = fTest(a, b)
  say(`\n--- ${label}  (n=${subset.length}, outcome=log ${outcome}${useLag ? ', lagged job' : ''}) ---`)
  say(`  his own line alone      R2 = ${a.r2.toFixed(4)}  (adj ${a.adjR2.toFixed(4)})`)
  say(`  plus the job above him  R2 = ${b.r2.toFixed(4)}  (adj ${b.adjR2.toFixed(4)})`)
  say(`  the job buys            dR2 = ${(f.deltaR2).toFixed(4)}   F(${f.df1},${f.df2}) = ${f.F.toFixed(2)}`)
  for (const t of b.terms) {
    if (!JOB_NAMES.includes(t.name)) continue
    const star = t.p < 0.01 ? '**' : t.p < 0.05 ? '*' : '  '
    say(`    ${t.name.padEnd(32)} b=${t.beta.toFixed(4).padStart(8)}  z=${t.z.toFixed(2).padStart(6)}  p=${t.p.toFixed(4)} ${star}`)
  }
  return {
    label,
    n: subset.length,
    outcome,
    useLag,
    baseR2: a.r2,
    fullR2: b.r2,
    baseAdjR2: a.adjR2,
    fullAdjR2: b.adjR2,
    deltaR2: f.deltaR2,
    F: f.F,
    df1: f.df1,
    df2: f.df2,
    jobTerms: b.terms.filter((t) => JOB_NAMES.includes(t.name)),
    ownTerm: b.terms.find((t) => t.name === 'own rate (z)'),
  }
}

say('\n\n========== THE ASK: does the job beat his own line? ==========')
out.models = []
out.models.push(fitPair(rows, 'all Triple-A stays, season days'))
out.models.push(fitPair(rows, 'all Triple-A stays, calendar days', { outcome: 'calDays' }))
out.models.push(fitPair(rows, 'all Triple-A stays, lagged job', { useLag: true }))
out.models.push(fitPair(rows.filter((r) => r.group === 'hitting'), 'hitters only', { pooled: false }))
out.models.push(fitPair(rows.filter((r) => r.group === 'pitching'), 'pitchers only', { pooled: false }))

say('\n\n========== THE FALSIFICATION TEST: does it bite where jobs are scarce? ==========')
say('Blockage that reads the same at catcher and in the bullpen is not blockage.')
out.byScarcity = []
for (const sc of ['scarce', 'mid', 'open', 'rotation', 'bullpen']) {
  const g = rows.filter((r) => r.scarcity === sc)
  const res = fitPair(g, `job type: ${sc}`, { pooled: false })
  if (res) out.byScarcity.push({ scarcity: sc, ...res })
}

// ---- the outcomes that are not waiting -----------------------------------
say('\n\n========== WAITING IS NOT THE ONLY EXIT ==========')
const traded = rows.filter((r) => r.changedOrg != null)
const moved = rows.filter((r) => r.changedPos != null && r.group === 'hitting')
say(`debuted with a different club than the one he waited in: ${traded.filter((r) => r.changedOrg).length} of ${traded.length} (${(100 * mean(traded.map((r) => r.changedOrg))).toFixed(1)}%)`)
say(`hitters who changed position between Triple-A and the majors: ${moved.filter((r) => r.changedPos).length} of ${moved.length} (${(100 * mean(moved.map((r) => r.changedPos))).toFixed(1)}%)`)

function fitLogit(subset, yFn, label, pooled = true) {
  if (subset.length < 80) return null
  const y = subset.map(yFn)
  if (mean(y) < 0.02 || mean(y) > 0.98) return null
  const X = subset.map((r) => [...baseCols(r, pooled), ...jobCols(r, false)])
  const m = logistic(X, y, [...baseNames(pooled), ...JOB_NAMES])
  say(`\n--- ${label}  (n=${subset.length}, rate=${(100 * mean(y)).toFixed(1)}%, McFadden=${m.mcFadden.toFixed(4)}) ---`)
  for (const t of m.terms) {
    if (!JOB_NAMES.includes(t.name)) continue
    const star = t.p < 0.01 ? '**' : t.p < 0.05 ? '*' : '  '
    say(`    ${t.name.padEnd(32)} OR=${t.oddsRatio.toFixed(3).padStart(7)}  z=${t.z.toFixed(2).padStart(6)}  p=${t.p.toFixed(4)} ${star}`)
  }
  return { label, n: subset.length, rate: mean(y), mcFadden: m.mcFadden, terms: m.terms }
}

out.competing = []
out.competing.push(fitLogit(traded, (r) => r.changedOrg, 'left the org before he debuted'))
out.competing.push(fitLogit(moved, (r) => r.changedPos, 'changed position by the time he debuted', false))

// ---- why did the stay actually end? (join-txn.mjs, read off the wire) ----
say('\n\n========== WHY THE STAY ENDED: THE TRANSACTION WIRE, NOT JUST THE LEVEL CHANGE ==========')
const reasonCounts = {}
for (const r of rows) reasonCounts[r.exitReason] = (reasonCounts[r.exitReason] || 0) + 1
say('exit reason composition:')
for (const [k, v] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
  say(`  ${k.padEnd(16)} n=${String(v).padStart(4)}  (${(100 * v / rows.length).toFixed(1)}%)`)
}
out.exitReasons = reasonCounts

// The decisive test: does "the job above him" still fail to predict waiting
// once the confounded exits (injury forced it, September/DFA opened a spot,
// he was already rostered months earlier) are taken out, rather than pooled
// in with the ordinary case as if every promotion were the same kind of event?
say('\n--- refit "the job above him" restricted to a clean merit promotion ---')
const meritOnly = rows.filter((r) => r.exitReason === 'merit')
out.meritOnlyModel = fitPair(meritOnly, `merit-only promotions (n=${meritOnly.length} of ${rows.length})`)

say('\n--- refit the full sample with exit reason as an explicit control ---')
// Collapse the rare tail (demoted/traded/left/settledEarlier/unresolved -
// none clears 3% of the sample on its own) into one "other" dummy so this
// doesn't add more parameters than the confound is worth resolving.
const REASON_DUMMIES = ['injury', 'rosterRule', 'other']
function reasonDummy(r) {
  if (r.exitReason === 'injury') return 'injury'
  if (r.exitReason === 'rosterRule') return 'rosterRule'
  if (r.exitReason === 'merit') return null
  return 'other'
}
{
  const y = rows.map((r) => Math.log(r.activeDays))
  const names = [...baseNames(true), ...JOB_NAMES, ...REASON_DUMMIES.map((d) => `exit: ${d}`)]
  const X = rows.map((r) => {
    const rd = reasonDummy(r)
    return [...baseCols(r, true), ...jobCols(r, false), ...REASON_DUMMIES.map((d) => (rd === d ? 1 : 0))]
  })
  const m = ols(X, y, names)
  say(`  n=${rows.length}, R2=${m.r2.toFixed(4)} (adj ${m.adjR2.toFixed(4)})`)
  for (const t of m.terms) {
    if (!JOB_NAMES.includes(t.name) && !t.name.startsWith('exit: ')) continue
    const star = t.p < 0.01 ? '**' : t.p < 0.05 ? '*' : '  '
    say(`    ${t.name.padEnd(32)} b=${t.beta.toFixed(4).padStart(8)}  z=${t.z.toFixed(2).padStart(6)}  p=${t.p.toFixed(4)} ${star}`)
  }
  out.withExitControls = {
    n: rows.length,
    r2: m.r2,
    adjR2: m.adjR2,
    jobTerms: m.terms.filter((t) => JOB_NAMES.includes(t.name)),
    exitTerms: m.terms.filter((t) => t.name.startsWith('exit: ')),
  }
}

// ---- one competing-risk outcome, not three separate ones ------------------
// Hitters only (changedPos does not exist for pitchers): stayed at Triple-A
// and made it up the same way he came in (reference), left the org before he
// debuted, or moved to a new position before he debuted. A player can be
// both traded AND repositioned; traded is coded first because it is the more
// legible, harder-edged event and because that is the same precedence the
// separate binary fits above already imply by fitting it as its own outcome.
say('\n\n========== ONE OUTCOME, THREE FATES: A JOINT MODEL INSTEAD OF THREE SEPARATE ONES ==========')
const compRows = rows.filter((r) => r.group === 'hitting' && r.changedOrg != null && r.changedPos != null)
const CLASS_NAMES = ['stayed', 'traded', 'positionChanged']
const compY = compRows.map((r) => (r.changedOrg ? 1 : r.changedPos ? 2 : 0))
const compCounts = [0, 0, 0]
compY.forEach((c) => { compCounts[c] += 1 })
say(`n=${compRows.length}  stayed=${compCounts[0]}  traded=${compCounts[1]}  positionChanged=${compCounts[2]}`)
if (compRows.length >= 80 && compCounts.every((c) => c >= 15)) {
  const compX = compRows.map((r) => [...baseCols(r, false), ...jobCols(r, false)])
  const compNames = [...baseNames(false), ...JOB_NAMES]
  const mm = multinomial(compX, compY, 3, CLASS_NAMES, compNames)
  say(`McFadden=${mm.mcFadden.toFixed(4)}`)
  out.jointCompeting = { n: compRows.length, counts: compCounts, mcFadden: mm.mcFadden, classes: [] }
  for (const cls of mm.classes) {
    say(`\n--- vs "stayed": ${cls.className} ---`)
    for (const t of cls.terms) {
      if (!JOB_NAMES.includes(t.name)) continue
      const star = t.p < 0.01 ? '**' : t.p < 0.05 ? '*' : '  '
      say(`    ${t.name.padEnd(32)} OR=${t.oddsRatio.toFixed(3).padStart(7)}  z=${t.z.toFixed(2).padStart(6)}  p=${t.p.toFixed(4)} ${star}`)
    }
    out.jointCompeting.classes.push({ className: cls.className, terms: cls.terms.filter((t) => JOB_NAMES.includes(t.name)) })
  }
  // Same "traded" question, same hitters-only subset, fit as an independent
  // binary logistic - the direct comparison the separate-fits approach above
  // was actually running, so the joint fit's "did anything change" claim has
  // something matched to compare against.
  say('\n--- for comparison: "traded", hitters only, fit independently (not jointly) ---')
  const tradedHittersOnly = fitLogit(compRows, (r) => r.changedOrg, 'traded, hitters only, independent fit', false)
  out.jointCompeting.independentTradedComparison = tradedHittersOnly
} else {
  say('too few cases in one class to fit a joint model')
}

// ---- selection: the men this cohort cannot see ---------------------------
say('\n\n========== WHO IS MISSING ==========')
const blockedHard = rows.filter((r) => r.controlLeft >= 4 && r.jobQZ >= 0)
const blockedNot = rows.filter((r) => r.controlLeft === 0 || r.jobQZ < 0)
say(`stays behind a good, cost-controlled incumbent: n=${blockedHard.length}, left the org ${(100 * mean(blockedHard.map((r) => r.changedOrg || 0))).toFixed(1)}%`)
say(`every other stay:                               n=${blockedNot.length}, left the org ${(100 * mean(blockedNot.map((r) => r.changedOrg || 0))).toFixed(1)}%`)
out.selection = {
  blockedN: blockedHard.length,
  blockedLeftPct: 100 * mean(blockedHard.map((r) => r.changedOrg || 0)),
  otherN: blockedNot.length,
  otherLeftPct: 100 * mean(blockedNot.map((r) => r.changedOrg || 0)),
}

// ---- the rival explanation nobody named: the calendar --------------------
say('\n\n========== THE RIVAL EXPLANATION: THE CALENDAR ==========')
const byMonth = new Map()
for (const r of rows) {
  const m = Number(r.endDate.slice(5, 7))
  byMonth.set(m, (byMonth.get(m) || 0) + 1)
}
const monthRows = [...byMonth.entries()].sort((a, b) => a[0] - b[0])
say('when the stay ended, by month:')
for (const [m, c] of monthRows) {
  say(`  ${String(m).padStart(2)}  ${String(c).padStart(3)}  ${'#'.repeat(Math.round(c / 4))}`)
}
out.promotionMonths = monthRows.map(([m, c]) => ({ month: m, n: c }))

// April promotions after the control-year cutoff are a roster decision, not a
// development one. Count how many stays end in the first three weeks of April.
const earlyApril = rows.filter((r) => r.endDate.slice(5) >= '04-01' && r.endDate.slice(5) <= '04-21')
const lateApril = rows.filter((r) => r.endDate.slice(5) > '04-21' && r.endDate.slice(5) <= '05-11')
say(`\nstays ending 1-21 April: ${earlyApril.length}    22 Apr - 11 May: ${lateApril.length}`)
out.aprilSplit = { early: earlyApril.length, late: lateApril.length }

// ---- sensitivity: the stricter service clock ----------------------------
say('\n\n========== SENSITIVITY: THE STRICTER SERVICE CLOCK ==========')
const disagree = rows.filter((r) => r.controlLeft !== r.controlLeftStrict).length
say(`the two service estimates disagree on ${disagree} of ${rows.length} stays (${(100 * disagree / rows.length).toFixed(1)}%)`)
const yS = rows.map((r) => Math.log(r.activeDays))
const XaS = rows.map((r) => baseCols(r, true))
const XbS = rows.map((r) => [
  ...baseCols(r, true),
  r.jobQZ,
  r.controlLeftStrict / 6,
  r.jobDepth - depthMean,
  (r.jobAge ?? jobAgeMean) - jobAgeMean,
  (r.orgWinPct ?? winMean) - winMean,
  r.jobTenure,
])
const aS = ols(XaS, yS, baseNames(true))
const bS = ols(XbS, yS, [...baseNames(true), ...JOB_NAMES])
const fS = fTest(aS, bS)
say(`strict clock: dR2 = ${fS.deltaR2.toFixed(4)} (headline was compared against the same base)`)
const ctrlTermS = bS.terms.find((t) => t.name === 'incumbent control yrs left / 6')
say(`strict clock control term: b=${ctrlTermS.beta.toFixed(4)} z=${ctrlTermS.z.toFixed(2)} p=${ctrlTermS.p.toFixed(4)}`)
out.sensitivity = {
  disagreePct: (100 * disagree) / rows.length,
  strictDeltaR2: fS.deltaR2,
  strictControlTerm: ctrlTermS,
}

writeFileSync('findings.json', JSON.stringify(out, null, 2))
writeFileSync('rows.json', JSON.stringify(rows))
say('\nwrote findings.json and rows.json')
