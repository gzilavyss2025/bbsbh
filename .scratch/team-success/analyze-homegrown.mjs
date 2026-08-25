// Spike #2: does where a team's best players came from (homegrown vs.
// acquired) predict how far it goes in October? Joins the ALREADY-BUILT
// homegrown-dependence classifier (docs/homegrown-dependence.md,
// .scratch/level-benchmarks/homegrown-panel.json — a separate, earlier
// prospect-development spike) against THIS program's own outcome ladder.
// Does not rebuild the classifier; reuses its cached output and, for the
// stretch check below, its cached intermediate resolution data.
//
// homegrown-panel.json is 600 org-seasons, 2004-2023 — narrower than the
// ladder's own 2000-2025 window, so the usable sample here is smaller than
// spike #1's 750 team-seasons. Reported below, not hidden.
//
// Follows analyze-roster-age.mjs's pattern: same-season-relative comparisons
// are already baked into the share fields (a share IS relative — 0 to 1 on
// the same scale every year, unlike a raw age in years), a permutation test,
// leave-one-season-out, band comparisons, and a division-winner-vs-wild-card
// split restricted to postseason teams.
//
// STRETCH: a "postseason-actual homegrown share" — of the PA/IP a team's
// players actually got IN OCTOBER, what share came from homegrown players —
// reusing the postseason usage primitive from
// docs/team-success-postseason-usage.md (postseason-usage.json) and the
// homegrown classifier's own cached first-pro-org resolution
// (.scratch/level-benchmarks/milb-mlb-cache.json + orgmap-wide.json), so this
// needs zero new network calls. Per that document's own trap (also recorded
// in src/lib/research/contenderDiary/standingNotes.js,
// 'postseason-share-needs-a-volume-control'): any measure expressed as a
// SHARE of postseason activity is confounded with how far a team went by
// construction (total postseason volume correlates with the ladder at
// rho~0.91), so this uses the same partial-correlation control that spike's
// analyze-usage-mismatch.mjs used, not a raw correlation.
//
// Run: node .scratch/team-success/analyze-homegrown.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { firstProOrg } from '../level-benchmarks/homegrown-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const LEVEL_BENCH = join(REPO_ROOT, '.scratch', 'level-benchmarks')
const read = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))

const ladderData = read(__dirname, 'outcome-ladder.json')
const homegrownData = read(LEVEL_BENCH, 'homegrown-panel.json')
const postseasonUsage = read(__dirname, 'postseason-usage.json')

const ladderBySeason = new Map(ladderData.seasons.map((s) => [s.year, s]))
const postseasonBySeason = new Map(postseasonUsage.seasons.map((s) => [s.year, s]))

// ---------------------------------------------------------------- stats lib
function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function sd(xs) {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}
function rank(xs) {
  const idx = xs.map((v, i) => i).sort((a, b) => xs[a] - xs[b])
  const ranks = new Array(xs.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[idx[k]] = avgRank
    i = j + 1
  }
  return ranks
}
function pearson(xs, ys) {
  const mx = mean(xs)
  const my = mean(ys)
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0))
  return den === 0 ? 0 : num / den
}
function spearman(xs, ys) {
  return pearson(rank(xs), rank(ys))
}
function residualizeRanks(y, x) {
  const ry = rank(y)
  const rx = rank(x)
  const mx = mean(rx)
  const my = mean(ry)
  const b = ry.reduce((s, v, i) => s + (rx[i] - mx) * (v - my), 0) / rx.reduce((s, v) => s + (v - mx) ** 2, 0)
  const a = my - b * mx
  return ry.map((v, i) => v - (a + b * rx[i]))
}
function partialSpearman(y, x, control) {
  return pearson(residualizeRanks(y, control), residualizeRanks(x, control))
}

function permutationTest(rows, valueKey, outcomeKey, groupKey, observed, iterations = 5000) {
  const byGroup = new Map()
  for (const row of rows) {
    if (!byGroup.has(row[groupKey])) byGroup.set(row[groupKey], [])
    byGroup.get(row[groupKey]).push(row)
  }
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const xs = []
    const ys = []
    for (const groupRows of byGroup.values()) {
      const outcomes = groupRows.map((r) => r[outcomeKey])
      for (let i = outcomes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]]
      }
      groupRows.forEach((r, i) => {
        xs.push(r[valueKey])
        ys.push(outcomes[i])
      })
    }
    if (Math.abs(spearman(xs, ys)) >= Math.abs(observed)) extreme++
  }
  return extreme / iterations
}

function permutationTestPartial(rows, valueKey, outcomeKey, controlKey, groupKey, observed, iterations = 5000) {
  const controlRanks = rank(rows.map((r) => r[controlKey]))
  const residualizedValue = residualizeRanks(
    rows.map((r) => r[valueKey]),
    rows.map((r) => r[controlKey]),
  )
  const byGroup = new Map()
  rows.forEach((row, i) => {
    if (!byGroup.has(row[groupKey])) byGroup.set(row[groupKey], [])
    byGroup.get(row[groupKey]).push(i)
  })
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const shuffledOutcome = rows.map((r) => r[outcomeKey])
    for (const idxs of byGroup.values()) {
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const a = idxs[i]
        const b = idxs[j]
        ;[shuffledOutcome[a], shuffledOutcome[b]] = [shuffledOutcome[b], shuffledOutcome[a]]
      }
    }
    const shuffledRanks = rank(shuffledOutcome)
    const mx = mean(controlRanks)
    const my = mean(shuffledRanks)
    const b =
      shuffledRanks.reduce((s, v, i) => s + (controlRanks[i] - mx) * (v - my), 0) /
      controlRanks.reduce((s, v) => s + (v - mx) ** 2, 0)
    const a = my - b * mx
    const residualizedShuffled = shuffledRanks.map((v, i) => v - (a + b * controlRanks[i]))
    if (Math.abs(pearson(residualizedShuffled, residualizedValue)) >= Math.abs(observed)) extreme++
  }
  return extreme / iterations
}

function leaveOneSeasonOut(rows, valueKey, outcomeKey) {
  const years = [...new Set(rows.map((r) => r.year))]
  return years.map((year) => {
    const subset = rows.filter((r) => r.year !== year)
    return spearman(
      subset.map((row) => row[valueKey]),
      subset.map((row) => row[outcomeKey]),
    )
  })
}

function meanDiff(rows, valueKey, groupKey) {
  const inGroup = rows.filter((r) => r[groupKey]).map((r) => r[valueKey])
  const outGroup = rows.filter((r) => !r[groupKey]).map((r) => r[valueKey])
  return { inGroup: mean(inGroup), outGroup: mean(outGroup), n: [inGroup.length, outGroup.length] }
}

function permutationTestMeanDiff(rows, valueKey, groupKey, observedDiff, iterations = 5000) {
  const byGroup = new Map()
  for (const row of rows) {
    if (!byGroup.has(row.year)) byGroup.set(row.year, [])
    byGroup.get(row.year).push(row)
  }
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    let inSum = 0,
      inN = 0,
      outSum = 0,
      outN = 0
    for (const seasonRows of byGroup.values()) {
      const flags = seasonRows.map((r) => r[groupKey])
      for (let i = flags.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[flags[i], flags[j]] = [flags[j], flags[i]]
      }
      seasonRows.forEach((r, i) => {
        if (flags[i]) {
          inSum += r[valueKey]
          inN++
        } else {
          outSum += r[valueKey]
          outN++
        }
      })
    }
    const diff = inSum / inN - outSum / outN
    if (Math.abs(diff) >= Math.abs(observedDiff)) extreme++
  }
  return extreme / iterations
}

// ------------------------------------------------------- primary join + fit
function buildRows({ includeShortSeason }) {
  const rows = []
  for (const p of homegrownData.panel) {
    const ladderSeason = ladderBySeason.get(p.season)
    if (!ladderSeason) continue
    if (ladderSeason.shortSeason && !includeShortSeason) continue
    const outcome = ladderSeason.teams[p.orgId]
    if (!outcome) continue
    if (p.homegrownShareHit == null || p.homegrownSharePit == null) continue
    rows.push({
      year: p.season,
      teamId: p.orgId,
      ladder: outcome.ladder,
      madePostseason: outcome.madePostseason,
      wonDivision: outcome.wonDivision,
      homegrownShare: p.homegrownShare,
      homegrownShareHit: p.homegrownShareHit,
      homegrownSharePit: p.homegrownSharePit,
    })
  }
  return rows
}

function report(rows, label) {
  console.log(`\n=== ${label} (n=${rows.length} team-seasons) ===`)

  for (const key of ['homegrownShare', 'homegrownShareHit', 'homegrownSharePit']) {
    const values = rows.map((r) => r[key])
    const ladders = rows.map((r) => r.ladder)
    const rho = spearman(values, ladders)
    const p = permutationTest(rows, key, 'ladder', 'year', rho)
    const loso = leaveOneSeasonOut(rows, key, 'ladder')
    const sameSign = loso.filter((r) => Math.sign(r) === Math.sign(rho)).length
    console.log(
      `${key}: Spearman rho=${rho.toFixed(4)} vs ladder (0-5), permutation p=${p.toFixed(4)}, ` +
        `same-sign in ${sameSign}/${loso.length} leave-one-season-out refits ` +
        `(range ${Math.min(...loso).toFixed(4)} to ${Math.max(...loso).toFixed(4)})`,
    )
  }

  console.log('\nBand comparisons (mean homegrown share):')
  const bands = [
    ['made the postseason at all', (r) => r.ladder >= 1],
    ['reached the LCS or better', (r) => r.ladder >= 3],
    ['won the World Series', (r) => r.ladder === 5],
  ]
  for (const [bandLabel, pred] of bands) {
    for (const key of ['homegrownShareHit', 'homegrownSharePit']) {
      const flagged = rows.map((r) => ({ ...r, __flag: pred(r) }))
      const { inGroup, outGroup, n } = meanDiff(flagged, key, '__flag')
      const diff = inGroup - outGroup
      const p = permutationTestMeanDiff(flagged, key, '__flag', diff)
      console.log(
        `  ${bandLabel} (${key}): ${(inGroup * 100).toFixed(1)}% (n=${n[0]}) vs ` +
          `${(outGroup * 100).toFixed(1)}% (n=${n[1]}) — diff ${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)}pp, permutation p=${p.toFixed(4)}`,
      )
    }
  }

  console.log('\nDivision winners vs. everyone else who made the postseason:')
  const postseasonRows = rows.filter((r) => r.madePostseason)
  for (const key of ['homegrownShareHit', 'homegrownSharePit']) {
    const flagged = postseasonRows.map((r) => ({ ...r, __flag: r.wonDivision }))
    const { inGroup, outGroup, n } = meanDiff(flagged, key, '__flag')
    const diff = inGroup - outGroup
    const p = permutationTestMeanDiff(flagged, key, '__flag', diff)
    console.log(
      `  wonDivision (${key}): ${(inGroup * 100).toFixed(1)}% (n=${n[0]}) vs ` +
        `${(outGroup * 100).toFixed(1)}% (n=${n[1]}) — diff ${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)}pp, permutation p=${p.toFixed(4)}`,
    )
  }

  console.log('\nSample stats (share spread across all rows):')
  for (const key of ['homegrownShareHit', 'homegrownSharePit']) {
    const values = rows.map((r) => r[key])
    console.log(`  ${key}: mean=${mean(values).toFixed(3)} sd=${sd(values).toFixed(3)}`)
  }
}

const primary = buildRows({ includeShortSeason: false })
report(primary, '2004-2023 excluding 2020')

const withShort = buildRows({ includeShortSeason: true })
report(withShort, 'Sensitivity check: 2020 included')

// --------------------------------------------------- stretch: postseason-actual share
console.log('\n\n=== STRETCH: postseason-actual homegrown share ===')
console.log(
  '(reuses the classifier\'s own cached first-pro-org resolution — zero new statsapi calls — ' +
    'and applies the postseason-share-needs-a-volume-control trap from ' +
    'docs/team-success-postseason-usage.md)',
)

const milbCache = read(LEVEL_BENCH, 'milb-mlb-cache.json')
const orgMapRaw = read(LEVEL_BENCH, 'orgmap-wide.json')
const orgMap = new Map(Object.entries(orgMapRaw))

const homeOrgOf = new Map()
let resolveAttempts = 0
let resolveHits = 0
function homeOrgFor(personId) {
  if (homeOrgOf.has(personId)) return homeOrgOf.get(personId)
  resolveAttempts++
  const rows = milbCache[personId]
  const got = rows ? firstProOrg(rows, (k) => orgMap.get(k)) : null
  const orgId = got && got.orgId !== 11 ? got.orgId : null
  if (orgId != null) resolveHits++
  homeOrgOf.set(personId, orgId)
  return orgId
}

const postseasonRows = []
let totalPlayerRefs = 0
let unresolvedPlayerRefs = 0

for (const p of homegrownData.panel) {
  const ladderSeason = ladderBySeason.get(p.season)
  if (!ladderSeason || ladderSeason.shortSeason) continue
  const outcome = ladderSeason.teams[p.orgId]
  if (!outcome || !outcome.madePostseason) continue
  const psSeason = postseasonBySeason.get(p.season)
  const psTeam = psSeason?.teams?.[p.orgId]
  if (!psTeam) continue

  function shareFor(kind) {
    const players = psTeam[kind] ?? []
    let own = 0
    let total = 0
    for (const player of players) {
      const weight = kind === 'hitting' ? player.pa : player.ip
      if (weight <= 0) continue
      totalPlayerRefs++
      total += weight
      const orgId = homeOrgFor(player.personId)
      if (orgId == null) {
        unresolvedPlayerRefs++
        continue
      }
      if (orgId === p.orgId) own += weight
    }
    return { share: total > 0 ? own / total : null, total }
  }

  const hit = shareFor('hitting')
  const pit = shareFor('pitching')
  if (hit.share == null || pit.share == null) continue

  postseasonRows.push({
    year: p.season,
    teamId: p.orgId,
    ladder: outcome.ladder,
    postseasonHomegrownShareHit: hit.share,
    postseasonHomegrownSharePit: pit.share,
    postseasonHomegrownShare: (hit.share + pit.share) / 2,
    totalPostseasonPA: hit.total,
    totalPostseasonIP: pit.total,
    totalPostseasonVol: hit.total + pit.total,
  })
}

console.log(
  `\nResolved first-pro-org for ${resolveHits}/${resolveAttempts} distinct postseason players referenced ` +
    `(${totalPlayerRefs - unresolvedPlayerRefs}/${totalPlayerRefs} PA/IP-weighted playing-time references), ` +
    `n=${postseasonRows.length} postseason team-seasons (2004-2023 excluding 2020, postseason teams only)`,
)

for (const [key, controlKey] of [
  ['postseasonHomegrownShareHit', 'totalPostseasonPA'],
  ['postseasonHomegrownSharePit', 'totalPostseasonIP'],
  ['postseasonHomegrownShare', 'totalPostseasonVol'],
]) {
  const rhoRaw = spearman(
    postseasonRows.map((r) => r[key]),
    postseasonRows.map((r) => r.ladder),
  )
  const pRaw = permutationTest(postseasonRows, key, 'ladder', 'year', rhoRaw)
  const rhoVsVol = spearman(
    postseasonRows.map((r) => r[key]),
    postseasonRows.map((r) => r[controlKey]),
  )
  const rhoPartial = partialSpearman(
    postseasonRows.map((r) => r.ladder),
    postseasonRows.map((r) => r[key]),
    postseasonRows.map((r) => r[controlKey]),
  )
  const pPartial = permutationTestPartial(postseasonRows, key, 'ladder', controlKey, 'year', rhoPartial)
  console.log(
    `\n  ${key}: RAW rho=${rhoRaw.toFixed(4)} vs ladder (permutation p=${pRaw.toFixed(4)}); ` +
      `${key} vs ${controlKey} rho=${rhoVsVol.toFixed(4)} (the confound itself); ` +
      `CONTROLLED partial rho=${rhoPartial.toFixed(4)}, permutation p=${pPartial.toFixed(4)}`,
  )
}

// For reference: does postseason-actual share differ much from the
// full-season share used above, for the same team-seasons?
const bySeasonTeam = new Map(homegrownData.panel.map((p) => [`${p.season}-${p.orgId}`, p]))
const deltas = postseasonRows
  .map((r) => {
    const full = bySeasonTeam.get(`${r.year}-${r.teamId}`)
    if (!full) return null
    return {
      hitDelta: r.postseasonHomegrownShareHit - full.homegrownShareHit,
      pitDelta: r.postseasonHomegrownSharePit - full.homegrownSharePit,
    }
  })
  .filter(Boolean)
console.log(
  `\n  Postseason-actual share minus full-season share, mean: hitting ${(mean(deltas.map((d) => d.hitDelta)) * 100).toFixed(2)}pp, ` +
    `pitching ${(mean(deltas.map((d) => d.pitDelta)) * 100).toFixed(2)}pp`,
)
