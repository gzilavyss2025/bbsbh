// The service-clock analysis. Every test the spike contract names, in order.
//
//   T1  validate the line against `mls` before testing anything with it
//   T2  the density test: is there a jump at the line?
//   T3  the placebo: the identical test at dates carrying no service cost
//   T4  rank-matched controls, and the high-vs-low pedigree contrast
//   T5  club fixed effects
//   T6  the roster-need control
//   T7  leave-one-season-out, and era splits
//
// Output: .scratch/service-clock/findings.json
import { writeFile } from 'node:fs/promises'
import { j, local, loadCalendar, rateRatioTest, propTest, zToP, pct, fmt } from './lib.mjs'

const all = await j(local('panel'))
const calendar = await loadCalendar()
const out = {}
const say = (s) => process.stdout.write(s + '\n')
const head = (s) => say(`\n${'='.repeat(74)}\n${s}\n${'='.repeat(74)}`)

// 2020 is out of every figure: a 67-day championship season cannot carry a
// 172-day rule, and the pro-rated grant that replaced it is in no feed here.
const panel = all.filter((r) => !r.excludedSeason)

// The post-line window width. 14 days is set once, here, and used by the real
// test and every placebo alike so the comparison is like for like.
const POST_WIDTH = 14

function eraOf(y) {
  if (y <= 2011) return '2005-2011'
  if (y <= 2016) return '2012-2016'
  if (y <= 2021) return '2017-2021'
  return '2022-2025' // the 2022 agreement's promotion incentives
}

// --- T1. validate the line ---------------------------------------------------
head('T1. Does the derived line actually divide who banks a service year?')
say('The line is  regularSeasonEndDate - 171 days,  derived per season, never')
say('hard-coded. It moves from 2011-04-10 to 2025-04-10 across the window.')
say('')
say('The hard prediction: a man on the active roster only from day +1 onward')
say('CANNOT reach 172 days, so he must show 0 years of service the next spring.')
say('')

// A bare-integer `mls` cell is excluded. 2,926 of the 19,308 populated cells
// hold one and they mix two different things — an exactly-round figure that is
// right, and a rounded count of SEASONS that is not. Jonny Venters reads 1, 2,
// 3, 4, 5 across 2011-2015 and then a real 5.159 in 2019; he debuted
// 2010-04-17, so entering 2011 he held about 0.168. Nothing in the cell
// separates the two cases, so the service test drops all of them and says so.
const withMlsAll = panel.filter((r) => r.bankedFullYear != null)
const withMls = withMlsAll.filter((r) => !r.mlsNextIsBareInteger)
say(`service cells available ${withMlsAll.length}; bare integers dropped ${withMlsAll.length - withMls.length}; usable ${withMls.length}`)
say('')
function bankTable(rows, key) {
  const buckets = [
    ['on or before the line', (r) => r[key] != null && r[key] <= 0],
    ['line +1 to +14', (r) => r[key] != null && r[key] >= 1 && r[key] <= 14],
    ['line +15 or later', (r) => r[key] != null && r[key] >= 15],
  ]
  return buckets.map(([label, f]) => {
    const sel = rows.filter(f)
    const banked = sel.filter((r) => r.bankedFullYear).length
    return { bucket: label, n: sel.length, banked, rate: sel.length ? banked / sel.length : null }
  })
}
const t1debut = bankTable(withMls, 'relDay')
const t1add = bankTable(
  withMls.filter((r) => r.addRelDay != null),
  'addRelDay',
)
say('measured on the DEBUT date:')
for (const b of t1debut) say(`  ${b.bucket.padEnd(24)} n ${String(b.n).padStart(4)}  banked a full year ${String(b.banked).padStart(4)}  ${pct(b.rate)}`)
say('measured on the ROSTER-ADD date from the wire (service starts here):')
for (const b of t1add) say(`  ${b.bucket.padEnd(24)} n ${String(b.n).padStart(4)}  banked a full year ${String(b.banked).padStart(4)}  ${pct(b.rate)}`)

// The violations are the interesting part: a man who banked a year despite
// joining after the line means the line, the date, or the cell is wrong.
const violations = withMls
  .filter((r) => r.addRelDay != null && r.addRelDay >= 1 && r.bankedFullYear)
  .map((r) => ({
    name: r.name,
    season: r.debutSeason,
    cutoff: r.cutoff,
    rosterAddDate: r.rosterAddDate,
    addRelDay: r.addRelDay,
    mlsNextRaw: r.mlsNextRaw,
  }))
say('')
say(`violations of the hard prediction (joined after the line, still banked a year): ${violations.length} of ${t1add[1].n + t1add[2].n}`)
for (const v of violations.slice(0, 12)) say(`   ${v.name} ${v.season}: line ${v.cutoff}, added ${v.rosterAddDate} (+${v.addRelDay}), next-spring mls ${v.mlsNextRaw}`)
out.t1 = { byDebutDate: t1debut, byRosterAddDate: t1add, violations, cellsAvailable: withMlsAll.length, bareIntegersDropped: withMlsAll.length - withMls.length, usable: withMls.length }

// --- zone machinery ----------------------------------------------------------
// Zone B, "costly": the season is under way and a full year is still reachable,
// so promoting here gives the year away for only a few extra days of the man.
//   seasonDay >= 1  AND  relDay <= K
// Zone C, "free": the year is already gone, so promoting costs nothing.
//   relDay in [K+1, K+POST_WIDTH]
// Opening day (seasonDay 0) is excluded from both. It is a structural mass
// point — a man who breaks camp is not making a promotion decision inside the
// season — and leaving it in swamps every rate with it.
function zones(rows, shift, key = 'relDay', dayKey = 'seasonDay') {
  const seasonsSeen = new Set(rows.map((r) => r.debutSeason))
  let expB = 0
  let expC = 0
  for (const s of seasonsSeen) {
    const cal = calendar.get(s)
    if (!cal) continue
    // Zone B has the same width as the real pre-line window, shifted.
    const widthB = cal.preLineDays - 1
    for (let d = shift - widthB + 1; d <= shift; d++) {
      // relDay d corresponds to seasonDay d + (preLineDays - 1)
      const sd = d + cal.preLineDays - 1
      if (sd >= 1 && sd <= cal.lengthDays - 1) expB++
    }
    for (let d = shift + 1; d <= shift + POST_WIDTH; d++) {
      const sd = d + cal.preLineDays - 1
      if (sd >= 1 && sd <= cal.lengthDays - 1) expC++
    }
  }
  let kB = 0
  let kC = 0
  for (const r of rows) {
    const v = r[key]
    const sd = r[dayKey]
    if (v == null || sd == null || sd < 1) continue
    const cal = calendar.get(r.debutSeason)
    const widthB = cal.preLineDays - 1
    if (v <= shift && v > shift - widthB) kB++
    else if (v >= shift + 1 && v <= shift + POST_WIDTH) kC++
  }
  return rateRatioTest(kC, expC, kB, expB) // ratio = free-zone rate / costly-zone rate
}

// --- T2. the density test ----------------------------------------------------
head('T2. Is the debut rate higher just after the line than just before it?')
say('Rate ratio = debuts per club-day in the free zone / in the costly zone.')
say('A club that manages the clock promotes in the free zone, so the clock')
say('predicts a ratio above 1 and a JUMP at the line, not a slope.')
say('')
const t2debut = zones(panel, 0, 'relDay', 'seasonDay')
const t2add = zones(
  panel.filter((r) => r.addRelDay != null),
  0,
  'addRelDay',
  'addSeasonDay',
)
function showRR(label, r) {
  say(
    `  ${label.padEnd(26)} costly ${String(r.k2).padStart(4)}/${String(r.exp2).padStart(4)}d = ${fmt(r.rate2, 3)}/d   free ${String(r.k1).padStart(4)}/${String(r.exp1).padStart(4)}d = ${fmt(r.rate1, 3)}/d   ratio ${fmt(r.ratio, 3)}  p=${fmt(r.p, 4)}`,
  )
}
showRR('debut clock', t2debut)
showRR('roster-add clock', t2add)
out.t2 = { debutClock: t2debut, rosterAddClock: t2add }

// --- T3. the placebo ---------------------------------------------------------
head('T3. Placebo — the identical test at dates with no service consequence')
say('The same zones, the same widths, slid along the calendar. If the line')
say('carries a clock, the ratio at shift 0 stands out from its neighbours. If')
say('it does not, what the test found is a seasonal promotion rhythm.')
say('')
const sweep = []
for (let k = -6; k <= 70; k++) {
  const r = zones(panel, k, 'relDay', 'seasonDay')
  const ra = zones(panel.filter((x) => x.addRelDay != null), k, 'addRelDay', 'addSeasonDay')
  sweep.push({ shift: k, ratio: r.ratio, p: r.p, kC: r.k1, kB: r.k2, addRatio: ra.ratio, addP: ra.p })
}
const real = sweep.find((s) => s.shift === 0)
const others = sweep.filter((s) => s.shift !== 0 && Number.isFinite(s.ratio))
const bigger = others.filter((s) => s.ratio >= real.ratio).length
say(`  shift   0 (THE LINE)  ratio ${fmt(real.ratio, 3)}  p=${fmt(real.p, 4)}`)
for (const k of [10, 20, 30, 35, 40, 50, 60]) {
  const s = sweep.find((x) => x.shift === k)
  say(`  shift ${String(k).padStart(3)}               ratio ${fmt(s.ratio, 3)}  p=${fmt(s.p, 4)}`)
}
const ratios = others.map((s) => s.ratio).sort((a, b) => a - b)
say('')
say(`  placebo shifts run: ${others.length}`)
say(`  placebo ratio median ${fmt(ratios[Math.floor(ratios.length / 2)], 3)}, min ${fmt(ratios[0], 3)}, max ${fmt(ratios[ratios.length - 1], 3)}`)
say(`  placebo shifts whose ratio EQUALS OR BEATS the real line: ${bigger} of ${others.length}  -> permutation p = ${fmt((bigger + 1) / (others.length + 1), 4)}`)
out.t3 = { sweep, real, placebosAtLeastAsLarge: bigger, placebosRun: others.length, permutationP: (bigger + 1) / (others.length + 1) }

// --- T4. rank-matched controls ----------------------------------------------
head('T4. Rank-matched controls, and the contrast that matters')
say('The clock is only worth managing for a man the club expects to hold for')
say('six years. A seasonal rhythm moves everyone. So the sharpest test is not')
say('the pooled ratio — it is whether the ratio is LARGER for the men the')
say('incentive reaches than for the men it does not.')
say('')
const cohort = panel.filter((r) => r.inProspectCohort)
function cut(label, f) {
  const sel = cohort.filter(f)
  const r = zones(sel, 0, 'relDay', 'seasonDay')
  return { label, n: sel.length, ...r }
}
const cuts = [
  cut('round 1 pick', (r) => r.draftTier === 'Round 1'),
  cut('rounds 2-5', (r) => r.draftTier === 'Rounds 2-5'),
  cut('round 6+ / undrafted', (r) => r.draftTier && r.draftTier !== 'Round 1' && r.draftTier !== 'Rounds 2-5'),
  cut('age at debut <= 23', (r) => r.ageAtDebut != null && r.ageAtDebut <= 23),
  cut('age at debut 24-26', (r) => r.ageAtDebut != null && r.ageAtDebut > 23 && r.ageAtDebut <= 26),
  cut('age at debut 27+', (r) => r.ageAtDebut != null && r.ageAtDebut > 26),
  cut('award tier A or B', (r) => r.awardTier === 'A' || r.awardTier === 'B'),
  cut('award tier C or none', (r) => r.awardTier === 'C' || r.awardTier === 'none'),
]
for (const c of cuts) say(`  ${c.label.padEnd(24)} n ${String(c.n).padStart(4)}  costly ${String(c.k2).padStart(3)}  free ${String(c.k1).padStart(3)}  ratio ${fmt(c.ratio, 3)}  p=${fmt(c.p, 4)}`)

// The incentive-present group, built from all three dimensions at once.
const HIGH = (r) =>
  r.ageAtDebut != null &&
  r.ageAtDebut <= 24 &&
  (r.draftTier === 'Round 1' || r.draftTier === 'Rounds 2-5' || r.awardTier === 'A' || r.awardTier === 'B')
const LOW = (r) => r.ageAtDebut != null && r.ageAtDebut >= 27
const hi = cut('INCENTIVE PRESENT', HIGH)
const lo = cut('INCENTIVE ABSENT', LOW)
say('')
say(`  ${hi.label.padEnd(24)} n ${String(hi.n).padStart(4)}  costly ${String(hi.k2).padStart(3)}  free ${String(hi.k1).padStart(3)}  ratio ${fmt(hi.ratio, 3)}  p=${fmt(hi.p, 4)}`)
say(`  ${lo.label.padEnd(24)} n ${String(lo.n).padStart(4)}  costly ${String(lo.k2).padStart(3)}  free ${String(lo.k1).padStart(3)}  ratio ${fmt(lo.ratio, 3)}  p=${fmt(lo.p, 4)}`)
// Difference in the share landing in the free zone, between the two groups.
const dd = propTest(hi.k1, hi.k1 + hi.k2, lo.k1, lo.k1 + lo.k2)
say(`  free-zone share: incentive present ${pct(dd.p1)} vs absent ${pct(dd.p2)}  z=${fmt(dd.z, 2)} p=${fmt(dd.p, 4)}`)
out.t4 = { cuts, high: hi, low: lo, contrast: dd }

// --- T5. club fixed effects --------------------------------------------------
head('T5. Club fixed effects')
say('Stratified by club: within each club, compare the men it promoted in the')
say('free zone against the men it promoted in the costly zone, against the')
say("club's own exposure. Summing observed - expected across clubs removes")
say('every between-club difference in how often a club promotes at all.')
say('')
function clubStratified(rows) {
  // Per club: k in free zone, k in costly zone, and the exposure split, which
  // depends only on season, so it is computed per club-season.
  const byClub = new Map()
  for (const r of rows) {
    if (r.clubId == null || r.addRelDay == null || r.addSeasonDay == null || r.addSeasonDay < 1) continue
    const cal = calendar.get(r.debutSeason)
    const widthB = cal.preLineDays - 1
    let zone = null
    if (r.addRelDay <= 0 && r.addRelDay > -widthB) zone = 'B'
    else if (r.addRelDay >= 1 && r.addRelDay <= POST_WIDTH) zone = 'C'
    if (!zone) continue
    if (!byClub.has(r.clubId)) byClub.set(r.clubId, { kB: 0, kC: 0, expB: 0, expC: 0, seasons: new Set() })
    const s = byClub.get(r.clubId)
    s[zone === 'B' ? 'kB' : 'kC']++
    s.seasons.add(r.debutSeason)
  }
  let obs = 0
  let exp = 0
  let varSum = 0
  const perClub = []
  for (const [clubId, s] of byClub) {
    let eB = 0
    let eC = 0
    for (const y of s.seasons) {
      const cal = calendar.get(y)
      eB += cal.preLineDays - 1
      eC += POST_WIDTH
    }
    const n = s.kB + s.kC
    const pC = eC / (eB + eC)
    obs += s.kC
    exp += n * pC
    varSum += n * pC * (1 - pC)
    perClub.push({ clubId, kB: s.kB, kC: s.kC, expectedC: n * pC, ratio: eB && s.kB ? (s.kC / eC) / (s.kB / eB) : null })
  }
  const z = varSum > 0 ? (obs - exp) / Math.sqrt(varSum) : null
  return { obs, exp, z, p: z == null ? 1 : zToP(z), clubs: byClub.size, perClub }
}
const t5all = clubStratified(panel)
const t5hi = clubStratified(cohort.filter(HIGH))
say(`  all debuts     clubs ${t5all.clubs}  observed in free zone ${t5all.obs}  expected ${fmt(t5all.exp, 1)}  z=${fmt(t5all.z, 2)}  p=${fmt(t5all.p, 4)}`)
say(`  incentive grp  clubs ${t5hi.clubs}  observed in free zone ${t5hi.obs}  expected ${fmt(t5hi.exp, 1)}  z=${fmt(t5hi.z, 2)}  p=${fmt(t5hi.p, 4)}`)
out.t5 = { all: t5all, incentiveGroup: t5hi }

// --- T6. the roster-need control --------------------------------------------
head('T6. Roster need')
say('A club with an injury promotes when it must, whatever the calendar says.')
say('IL placements by the promoting club in the 21 days before the debut, from')
say('the wire. Available from 2009 on: the wire holds 102-177 rows a season in')
say('2005-2008 against 6,055 in 2009, so no earlier season can carry it.')
say('')
const wired = panel.filter((r) => r.debutSeason >= 2009 && r.clubId != null && r.ilSameGroup21 != null)
function needSplit(rows, label) {
  const none = rows.filter((r) => r.ilSameGroup21 === 0)
  const some = rows.filter((r) => r.ilSameGroup21 > 0)
  const rn = zones(none, 0, 'addRelDay', 'addSeasonDay')
  const rs = zones(some, 0, 'addRelDay', 'addSeasonDay')
  say(`  ${label}`)
  say(`    no IL placement in 21 days  n ${String(none.length).padStart(4)}  costly ${String(rn.k2).padStart(3)}  free ${String(rn.k1).padStart(3)}  ratio ${fmt(rn.ratio, 3)}  p=${fmt(rn.p, 4)}`)
  say(`    at least one IL placement   n ${String(some.length).padStart(4)}  costly ${String(rs.k2).padStart(3)}  free ${String(rs.k1).padStart(3)}  ratio ${fmt(rs.ratio, 3)}  p=${fmt(rs.p, 4)}`)
  return { none: rn, some: rs, nNone: none.length, nSome: some.length }
}
out.t6 = {
  all: needSplit(wired, 'all debuts 2009-2025'),
  incentive: needSplit(wired.filter((r) => r.inProspectCohort && HIGH(r)), 'incentive-present group'),
}
// Is roster need itself higher in one zone? If injuries cluster after the line
// the control is doing real work; if not, it cannot explain anything.
const zB = wired.filter((r) => r.addRelDay != null && r.addRelDay <= 0 && r.addSeasonDay >= 1)
const zC = wired.filter((r) => r.addRelDay >= 1 && r.addRelDay <= POST_WIDTH)
const meanIl = (a) => (a.length ? a.reduce((x, y) => x + y.ilSameGroup21, 0) / a.length : null)
say('')
say(`  mean IL placements in the 21 days before: costly zone ${fmt(meanIl(zB), 2)} (n=${zB.length}), free zone ${fmt(meanIl(zC), 2)} (n=${zC.length})`)
out.t6.meanIl = { costly: meanIl(zB), free: meanIl(zC), nCostly: zB.length, nFree: zC.length }

// --- T7. eras and leave-one-season-out ---------------------------------------
head('T7. Era splits and leave-one-season-out')
const eras = [...new Set(panel.map((r) => eraOf(r.debutSeason)))].sort()
const eraRows = []
for (const e of eras) {
  const sel = panel.filter((r) => eraOf(r.debutSeason) === e)
  const r = zones(sel, 0, 'relDay', 'seasonDay')
  eraRows.push({ era: e, n: sel.length, ...r })
  say(`  ${e}  debuts ${String(sel.length).padStart(4)}  costly ${String(r.k2).padStart(3)}  free ${String(r.k1).padStart(3)}  ratio ${fmt(r.ratio, 3)}  p=${fmt(r.p, 4)}`)
}
say('')
const seasons = [...new Set(panel.map((r) => r.debutSeason))].sort()
const loso = []
for (const s of seasons) {
  const r = zones(panel.filter((x) => x.debutSeason !== s), 0, 'relDay', 'seasonDay')
  loso.push({ dropped: s, ratio: r.ratio, p: r.p })
}
const sig = loso.filter((l) => l.p < 0.05).length
say(`  leave-one-season-out refits: ${loso.length}`)
say(`  ratio range ${fmt(Math.min(...loso.map((l) => l.ratio)), 3)} to ${fmt(Math.max(...loso.map((l) => l.ratio)), 3)}`)
say(`  significant at p<0.05 in ${sig} of ${loso.length} refits`)
// Per-season ratios, so a single season carrying the whole thing is visible.
const perSeason = seasons.map((s) => {
  const r = zones(panel.filter((x) => x.debutSeason === s), 0, 'relDay', 'seasonDay')
  return { season: s, kB: r.k2, kC: r.k1, ratio: r.ratio, p: r.p }
})
say('')
say('  per season (costly -> free):')
for (const s of perSeason) say(`    ${s.season}  ${String(s.kB).padStart(3)} -> ${String(s.kC).padStart(3)}   ratio ${fmt(s.ratio, 3)}`)
out.t7 = { eras: eraRows, loso, significantRefits: sig, perSeason }

await writeFile(local('findings'), JSON.stringify(out, null, 1))
say('\nwrote findings.json')
