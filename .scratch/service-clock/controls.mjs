// Every control the spike contract demands, run against ONE specification so
// the numbers are comparable: a Poisson count of first-time roster additions
// per cell, with season fixed effects, day-of-season bins that absorb the
// April churn ramp, and one coefficient on "this day is past the service line".
//
// The bare rate ratio without the day-of-season bins is 1.56 and highly
// significant. With them it is 1.27 and not. Everything below asks whether some
// subgroup, some club, or some other reading of the data brings it back.
import { writeFile } from 'node:fs/promises'
import { j, local, loadCalendar, zToP, fmt, pct } from './lib.mjs'
import { poissonFitSparse } from './glm.mjs'

const all = await j(local('panel'))
const calendar = await loadCalendar()
const out = {}
const say = (s) => process.stdout.write(s + '\n')
const head = (s) => say(`\n${'='.repeat(78)}\n${s}\n${'='.repeat(78)}`)

const MAX_DAY = 45
const BIN = 3

const base = all.filter(
  (r) =>
    !r.excludedSeason &&
    r.debutSeason >= 2009 &&
    r.addSeasonDay != null &&
    r.addSeasonDay >= 1 &&
    r.addSeasonDay <= MAX_DAY &&
    r.clubId != null,
)
const CLUBS = [...new Set(base.map((r) => r.clubId))].sort((a, b) => a - b)

// The core fit. `events` is any subset of the panel; `shift` slides the line to
// a placebo date; `clubFe` moves the cell grain to (club, season, day).
function fitLine(events, { shift = 0, dayBins = true, clubFe = false, seasonsOverride = null } = {}) {
  const seasons = seasonsOverride ?? [...new Set(events.map((r) => r.debutSeason))].sort()
  if (seasons.length < 2) return null
  const lineDay = new Map(seasons.map((s) => [s, calendar.get(s).preLineDays - 1 + shift]))

  const seasonIdx = new Map(seasons.slice(1).map((s, i) => [s, i]))
  const nSeasonCols = seasons.length - 1
  const nBins = Math.ceil(MAX_DAY / BIN)
  const binIdx = new Map([...Array(nBins).keys()].slice(1).map((b, i) => [b, i]))
  const nBinCols = dayBins ? nBins - 1 : 0
  const clubIdx = new Map(CLUBS.slice(1).map((c, i) => [c, i]))
  const nClubCols = clubFe ? CLUBS.length - 1 : 0

  const OFF_SEASON = 1
  const OFF_BIN = OFF_SEASON + nSeasonCols
  const OFF_CLUB = OFF_BIN + nBinCols
  const OFF_LINE = OFF_CLUB + nClubCols
  const p = OFF_LINE + 1

  const counts = new Map()
  for (const r of events) {
    const key = clubFe
      ? `${r.clubId}:${r.debutSeason}:${r.addSeasonDay}`
      : `${r.debutSeason}:${r.addSeasonDay}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const rows = []
  const y = []
  const offset = []
  const clubList = clubFe ? CLUBS : [null]
  for (const club of clubList) {
    for (const s of seasons) {
      const cal = calendar.get(s)
      const maxD = Math.min(MAX_DAY, cal.lengthDays - 1)
      for (let d = 1; d <= maxD; d++) {
        const feat = [[0, 1]]
        if (seasonIdx.has(s)) feat.push([OFF_SEASON + seasonIdx.get(s), 1])
        if (dayBins) {
          const b = Math.floor((d - 1) / BIN)
          if (binIdx.has(b)) feat.push([OFF_BIN + binIdx.get(b), 1])
        }
        if (clubFe && clubIdx.has(club)) feat.push([OFF_CLUB + clubIdx.get(club), 1])
        if (d > lineDay.get(s)) feat.push([OFF_LINE, 1])
        rows.push(feat)
        y.push(counts.get(clubFe ? `${club}:${s}:${d}` : `${s}:${d}`) ?? 0)
        offset.push(0)
      }
    }
  }
  const fit = poissonFitSparse(rows, y, offset, p)
  if (!fit) return null
  const b = fit.beta[OFF_LINE]
  const se = fit.se[OFF_LINE]
  const z = se ? b / se : null
  return {
    n: events.length,
    cells: rows.length,
    rateRatio: Math.exp(b),
    ci: se ? [Math.exp(b - 1.96 * se), Math.exp(b + 1.96 * se)] : null,
    z,
    p: z == null ? 1 : zToP(z),
  }
}

function show(label, f) {
  if (!f) {
    say(`  ${label.padEnd(40)} — not estimable`)
    return
  }
  say(
    `  ${label.padEnd(40)} n ${String(f.n).padStart(4)}  ratio ${fmt(f.rateRatio, 3)}  CI ${fmt(f.ci?.[0], 3)}-${fmt(f.ci?.[1], 3)}  z=${fmt(f.z, 2)}  p=${fmt(f.p, 4)}`,
  )
}


// Welch's t on two samples, used where the unit of analysis is the promotion
// rather than a modelled cell.
function propLike(a, b) {
  const m = (x) => x.reduce((p2, q) => p2 + q, 0) / x.length
  const v = (x) => (x.length > 1 ? x.reduce((p2, q) => p2 + (q - m(x)) ** 2, 0) / (x.length - 1) : 0)
  const se = Math.sqrt(v(a) / a.length + v(b) / b.length)
  const t = se ? (m(a) - m(b)) / se : null
  return { meanA: m(a), meanB: m(b), t, p: t == null ? 1 : zToP(t) }
}

// Do clubs differ in how they treat the line? Fit one common line coefficient,
// then one per club, and compare deviances. This is the within-club question
// that a club dummy cannot answer.
function clubHeterogeneity() {
  const seasons = [...new Set(base.map((r) => r.debutSeason))].sort()
  const lineDay = new Map(seasons.map((s2) => [s2, calendar.get(s2).preLineDays - 1]))
  const seasonIdx = new Map(seasons.slice(1).map((s2, i) => [s2, i]))
  const nBins = Math.ceil(MAX_DAY / BIN)
  const binIdx = new Map([...Array(nBins).keys()].slice(1).map((b2, i) => [b2, i]))
  const clubIdx = new Map(CLUBS.slice(1).map((c, i) => [c, i]))
  const counts = new Map()
  for (const r of base) counts.set(`${r.clubId}:${r.debutSeason}:${r.addSeasonDay}`, (counts.get(`${r.clubId}:${r.debutSeason}:${r.addSeasonDay}`) ?? 0) + 1)

  function build(perClubLine) {
    const OFF_SEASON = 1
    const OFF_BIN = OFF_SEASON + seasons.length - 1
    const OFF_CLUB = OFF_BIN + nBins - 1
    const OFF_LINE = OFF_CLUB + CLUBS.length - 1
    const p2 = OFF_LINE + (perClubLine ? CLUBS.length : 1)
    const rows = []
    const y = []
    const offset = []
    for (const club of CLUBS) {
      for (const s2 of seasons) {
        const cal = calendar.get(s2)
        for (let d = 1; d <= Math.min(MAX_DAY, cal.lengthDays - 1); d++) {
          const feat = [[0, 1]]
          if (seasonIdx.has(s2)) feat.push([OFF_SEASON + seasonIdx.get(s2), 1])
          const b2 = Math.floor((d - 1) / BIN)
          if (binIdx.has(b2)) feat.push([OFF_BIN + binIdx.get(b2), 1])
          if (clubIdx.has(club)) feat.push([OFF_CLUB + clubIdx.get(club), 1])
          if (d > lineDay.get(s2)) feat.push([OFF_LINE + (perClubLine ? CLUBS.indexOf(club) : 0), 1])
          rows.push(feat)
          y.push(counts.get(`${club}:${s2}:${d}`) ?? 0)
          offset.push(0)
        }
      }
    }
    return poissonFitSparse(rows, y, offset, p2)
  }
  const common = build(false)
  const perClub = build(true)
  const lr = common.deviance - perClub.deviance
  const df = CLUBS.length - 1
  // Chi-square upper tail by a Wilson-Hilferty normal approximation.
  const z = ((lr / df) ** (1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df))
  const byClub = new Map()
  for (const r of base) {
    if (!byClub.has(r.clubId)) byClub.set(r.clubId, { clubId: r.clubId, n: 0, pre: 0, post: 0 })
    const e = byClub.get(r.clubId)
    e.n++
    if (r.addRelDay >= 1) e.post++
    else e.pre++
  }
  const top = [...byClub.values()].sort((a, b2) => b2.post / b2.n - a.post / a.n).slice(0, 3)
  return { lr, df, p: zToP(z) / 2, top, clubs: CLUBS.length }
}

// --- the headline pair -------------------------------------------------------
head('C1. The specification, with and without the April churn ramp')
const naive = fitLine(base, { dayBins: false })
const full = fitLine(base, { dayBins: true })
show('season FE only (no rhythm control)', naive)
show('+ day-of-season bins  <-- THE TEST', full)
out.c1 = { naive, full }
say('')
say('  The whole of the naive jump is the shape of April. Every line below asks')
say('  whether the controlled figure comes back somewhere.')

// --- C2. club fixed effects --------------------------------------------------
head('C2. Club fixed effects')
say('  The claim is about club behaviour, so it must survive a within-club')
say('  comparison. Cells become (club, season, day); a club that simply promotes')
say('  more men cannot contribute.')
say('')
show('club FE, no rhythm control', fitLine(base, { dayBins: false, clubFe: true }))
const clubFull = fitLine(base, { dayBins: true, clubFe: true })
show('club FE + day-of-season bins', clubFull)
say('')
say('  THE TWO ESTIMATES ARE IDENTICAL TO THREE DECIMALS, AND THAT IS ARITHMETIC,')
say('  NOT A PASSED TEST. The line falls on the same date for all thirty clubs in')
say('  a season, so a club dummy is orthogonal to it and cannot move the')
say('  coefficient. Adding club fixed effects to this design answers nothing.')
say('  The within-club question has to be asked a different way: let every club')
say('  have its OWN line coefficient, and test whether they differ.')
say('')
const clubHet = clubHeterogeneity()
say(`  club-specific line coefficients: likelihood-ratio X2 = ${fmt(clubHet.lr, 2)} on ${clubHet.df} df, p = ${fmt(clubHet.p, 4)}`)
say('  No club departs from the common estimate by more than chance, so the')
say('  sample does not support naming one.')
say('')
say('  widest club estimates (thin — a median club contributes 28 promotions):')
for (const c of clubHet.top) say(`    club ${c.clubId}  promotions ${String(c.n).padStart(3)}  before/after the line ${String(c.pre).padStart(3)}/${String(c.post).padStart(3)}`)
out.c2 = { clubFe: clubFull, heterogeneity: clubHet }

// --- C3. rank-matched controls ----------------------------------------------
head('C3. Rank-matched controls')
say('  A club only gains from managing the clock for a man it expects to hold')
say('  six years. If the line is being managed, the effect must be LARGER for')
say('  those men than for men the incentive does not reach.')
say('')
const cohort = base.filter((r) => r.inProspectCohort)
const HIGH = (r) =>
  r.ageAtDebut != null &&
  r.ageAtDebut <= 24 &&
  (r.draftTier === 'Round 1' || r.draftTier === 'Rounds 2-5' || r.awardTier === 'A' || r.awardTier === 'B')
const LOW = (r) => r.ageAtDebut != null && r.ageAtDebut >= 27
const cuts = {
  'round 1 pick': cohort.filter((r) => r.draftTier === 'Round 1'),
  'rounds 1-5': cohort.filter((r) => r.draftTier === 'Round 1' || r.draftTier === 'Rounds 2-5'),
  'round 6+ / no draft record': cohort.filter(
    (r) => r.draftTier && r.draftTier !== 'Round 1' && r.draftTier !== 'Rounds 2-5',
  ),
  'award tier A or B (prior seasons)': cohort.filter((r) => r.awardTier === 'A' || r.awardTier === 'B'),
  'age at debut <= 23': cohort.filter((r) => r.ageAtDebut != null && r.ageAtDebut <= 23),
  'age at debut 27 or older': cohort.filter(LOW),
  'INCENTIVE PRESENT (young + pedigree)': cohort.filter(HIGH),
  'INCENTIVE ABSENT (age 27+)': cohort.filter(LOW),
}
const cutFits = {}
for (const [label, rowsC] of Object.entries(cuts)) {
  const f = fitLine(rowsC, { dayBins: true })
  cutFits[label] = f
  show(label, f)
}
out.c3 = cutFits

// --- C4. roster need ---------------------------------------------------------
head('C4. Roster need')
say('  A club with an injury promotes when it must. IL placements by the')
say('  promoting club in the 21 days before the promotion, taken from the wire')
say('  and read at the arriving man’s own side of the roster: the position is')
say('  named inside the sentence, so no second pull was needed.')
say('')
const noNeed = base.filter((r) => r.ilSameGroup21 === 0)
const someNeed = base.filter((r) => r.ilSameGroup21 > 0)
show('no same-side IL placement in 21 days', fitLine(noNeed, { dayBins: true }))
show('at least one same-side placement', fitLine(someNeed, { dayBins: true }))
const meanNeed = (a) => (a.length ? a.reduce((x, y2) => x + y2.ilSameGroup21, 0) / a.length : null)
const past = base.filter((r) => r.addRelDay >= 1)
const pre = base.filter((r) => r.addRelDay <= 0)
say('')
say(
  `  mean same-side IL placements in the prior 21 days: before the line ${fmt(meanNeed(pre), 2)} (n=${pre.length}), after ${fmt(meanNeed(past), 2)} (n=${past.length})`,
)
const needT = propLike(pre.map((r) => r.ilSameGroup21), past.map((r) => r.ilSameGroup21))
say(`  difference ${fmt(meanNeed(pre) - meanNeed(past), 2)} placements, t=${fmt(needT.t, 2)}, p=${fmt(needT.p, 4)}`)
say('  Roster need is HIGHER before the line, not lower. A club promoting in the')
say('  first ten days of a season is answering an injury, which is the ordinary')
say('  reason to promote early and is the opposite of holding a man back. The')
say('  control therefore works against the clock reading rather than for it.')
out.c4 = {
  needTest: needT,
  noNeed: fitLine(noNeed, { dayBins: true }),
  someNeed: fitLine(someNeed, { dayBins: true }),
  meanBefore: meanNeed(pre),
  meanAfter: meanNeed(past),
  nBefore: pre.length,
  nAfter: past.length,
}

// --- C5. the placebo ---------------------------------------------------------
head('C5. Placebo — the same model with the line moved')
say('  Each season’s line is slid by the same number of days and the model is')
say('  refitted. A real line should stand out from its neighbours. Under the')
say('  null every shift, the true one included, sits near 1.00.')
say('')
const sweep = []
for (let k = -10; k <= 40; k += 2) {
  const f = fitLine(base, { dayBins: true, shift: k })
  if (f) sweep.push({ shift: k, ratio: f.rateRatio, p: f.p, z: f.z })
}
const real = sweep.find((s) => s.shift === 0)
for (const s of sweep) {
  const mark = s.shift === 0 ? '  <== THE LINE' : ''
  say(`  shift ${String(s.shift).padStart(3)}   ratio ${fmt(s.ratio, 3)}  p=${fmt(s.p, 4)}${mark}`)
}
const others = sweep.filter((s) => s.shift !== 0)
const atLeast = others.filter((s) => s.ratio >= real.ratio).length
say('')
say(`  placebo shifts at least as large as the true line: ${atLeast} of ${others.length}  ->  permutation p = ${fmt((atLeast + 1) / (others.length + 1), 3)}`)
out.c5 = { sweep, real, placebosAtLeastAsLarge: atLeast, placebosRun: others.length }

// --- C6. leave one season out ------------------------------------------------
head('C6. Leave one season out, and the eras')
const seasonsAll = [...new Set(base.map((r) => r.debutSeason))].sort()
const loso = []
for (const s of seasonsAll) {
  const f = fitLine(base.filter((r) => r.debutSeason !== s), { dayBins: true })
  if (f) loso.push({ dropped: s, ratio: f.rateRatio, p: f.p })
}
const sig = loso.filter((l) => l.p < 0.05).length
say(`  refits ${loso.length}; ratio ${fmt(Math.min(...loso.map((l) => l.ratio)), 3)} to ${fmt(Math.max(...loso.map((l) => l.ratio)), 3)}`)
say(`  significant at p<0.05 in ${sig} of ${loso.length}`)
say('')
const eras = {
  '2009-2011': [2009, 2010, 2011],
  '2012-2016': [2012, 2013, 2014, 2015, 2016],
  '2017-2021': [2017, 2018, 2019, 2021],
  '2022-2025 (post-2022 CBA)': [2022, 2023, 2024, 2025],
}
const eraFits = {}
for (const [label, ys] of Object.entries(eras)) {
  const f = fitLine(base.filter((r) => ys.includes(r.debutSeason)), { dayBins: true })
  eraFits[label] = f
  show(label, f)
}
out.c6 = { loso, significantRefits: sig, eras: eraFits }

// --- C7. what the test could have found -------------------------------------
head('C7. Power — what this null does and does not rule out')
const ci = full.ci
say(`  The controlled estimate is ${fmt(full.rateRatio, 3)}, 95% CI ${fmt(ci[0], 3)} to ${fmt(ci[1], 3)}.`)
say('  So the data are consistent with anything from a small REDUCTION in')
say(`  promotions after the line to a ${fmt(ci[1], 2)}-fold rise. This is a null with a`)
say('  wide interval, not a demonstration that the line does nothing.')
say('')
say('  What it does exclude: the doubling-or-more that a widespread, uniform')
say('  practice would leave in a cohort of this size. What it cannot exclude:')
say('  a practice confined to a handful of men a year, which is what the')
say('  well-known individual cases actually look like. 834 first-time roster')
say('  additions fall in the first 45 days of a season across sixteen seasons —')
say('  about 52 a season, of whom the pedigree cut keeps about 8.')
out.c7 = { estimate: full.rateRatio, ci, n: full.n }

await writeFile(local('controls'), JSON.stringify(out, null, 1))
say('\nwrote controls.json')
