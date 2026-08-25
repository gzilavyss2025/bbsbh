// Spike #3: is a team's value concentrated in one or two standout players, or
// spread across the roster — and does that concentration predict postseason
// depth, or separate division winners from wild-card teams? Joins THREE
// existing datasets, none newly pulled:
//   - roster-age-cache.json (built for spike #1) — the personId -> team-season
//     roster join, already resolved against the teamId-filtered statsapi
//     endpoint (so it does NOT have the traded-player-collapses-to-last-team
//     bug a league-wide pull would — src/lib/research/contenderDiary/standingNotes.js).
//   - public/data/war-history/ (sharded on personId % 100) — season WAR per
//     player, bat/pit split, keyed by FanGraphs' xMLBAMID == statsapi personId,
//     2010-2025 only (src/api/war.js, scripts/gen-war-history.mjs).
//   - public/data/all-star-rosters.json — a secondary "how many recognized
//     stars" measure alongside WAR concentration, back to 1933 so no window
//     problem there.
//
// war-history starts at 2010, six years later than roster-age-cache/the
// ladder's 2000 floor — so the usable sample here is capped at 2010-2025 (16
// seasons), the SAME kind of reused-dataset window mismatch already
// catalogued as a trap ('reused-panels-have-their-own-season-window') after
// spike #2 hit it with the homegrown panel. Cited, not re-explained.
//
// A SECOND, NEW trap surfaced building this join: war-history's WAR number is
// a season TOTAL with no team split (src/api/war.js's own header: "no team
// attribution"). A player traded mid-season shows up in roster-age-cache
// under BOTH teams, correctly split by PA/IP share — but war-history has only
// ONE combined-season WAR number for him. Crediting that whole number to both
// teams would double it. Fixed by prorating: each player's credited WAR at a
// team is his season WAR times (his PA/IP weight at that team ÷ his total
// PA/IP weight across every team he played for that season, group-wise).
// Recorded in src/lib/research/contenderDiary/standingNotes.js as
// 'traded-player-war-has-no-team-split'.
//
// Concentration measures (computed over each team-season's POSITIVE-WAR
// players only — a bench player at -0.3 WAR isn't "diluting" the stars, he's
// just replacement level or worse, and negative shares make the measures
// nonsensical):
//   - top1Share: the single highest-WAR player's share of team positive WAR
//   - top2Share: the top two players' combined share
//   - hhi: a Herfindahl-style index, sum of (each positive player's share)^2
//     — ranges from ~1/n (evenly spread) to 1 (all in one player)
// Split hitting vs. pitching, not combined — both prior spikes in this
// program found the split mattered.
//
// Follows analyze-homegrown.mjs's pattern: Spearman correlation against the
// ladder, within-season permutation test, leave-one-season-out, band
// comparisons, and a division-winner-vs-wild-card split restricted to
// postseason teams. STRETCH: All-Star count as a second, independent measure of
// "how many recognized stars," not concentration — simpler check, single
// correlation + leave-one-season-out, no full band suite.
//
// Run: node .scratch/team-success/analyze-star-diversity.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const read = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))

const ladderData = read(__dirname, 'outcome-ladder.json')
const rosterAgeCache = read(__dirname, 'roster-age-cache.json')
const warHistoryDir = join(REPO_ROOT, 'public', 'data', 'war-history')
const allStarData = read(join(REPO_ROOT, 'public', 'data'), 'all-star-rosters.json')

const ladderBySeason = new Map(ladderData.seasons.map((s) => [s.year, s]))

// ------------------------------------------------------------ stats library
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

// ------------------------------------------------------ load war-history
// One shard per personId % 100. Merge into a single personId -> {bat, pit}
// map (each a {season: war} object). Same warShardKey arithmetic as the
// reader (src/api/war.js) and the generator (scripts/gen-war-history.mjs);
// this script just reads every shard rather than one at a time.
const warByPerson = new Map() // personId -> { bat: {season: war}, pit: {season: war} }
for (const file of readdirSync(warHistoryDir)) {
  if (!file.endsWith('.json')) continue
  const shard = read(warHistoryDir, file)
  for (const [group, byId] of [
    ['bat', shard.bat],
    ['pit', shard.pit],
  ]) {
    for (const [id, bySeason] of Object.entries(byId ?? {})) {
      if (!warByPerson.has(id)) warByPerson.set(id, { bat: {}, pit: {} })
      warByPerson.get(id)[group] = bySeason
    }
  }
}
function seasonWarFor(personId, group, year) {
  const rec = warByPerson.get(String(personId))
  if (!rec) return undefined
  const key = group === 'pitching' ? 'pit' : 'bat'
  const w = rec[key]?.[String(year)]
  return typeof w === 'number' ? w : undefined
}

// ---------------------------------------------- traded-player WAR proration
// war-history has one combined-season WAR per player with no team split;
// roster-age-cache splits a traded player's PA/IP correctly by team. Prorate
// his season WAR across teams by his weight share at each, so the sum
// credited across all his teams equals his real season total exactly once.
const WAR_HISTORY_SEASONS = new Set()
for (const rec of warByPerson.values()) {
  for (const y of Object.keys(rec.bat)) WAR_HISTORY_SEASONS.add(Number(y))
  for (const y of Object.keys(rec.pit)) WAR_HISTORY_SEASONS.add(Number(y))
}
const MIN_SEASON = Math.min(...WAR_HISTORY_SEASONS)
const MAX_SEASON = Math.max(...WAR_HISTORY_SEASONS)

const totalWeightByPersonGroupSeason = new Map() // `${group}-${year}-${personId}` -> summed weight
for (const [key, players] of Object.entries(rosterAgeCache)) {
  const [group, , yearStr] = key.split('-')
  const year = Number(yearStr)
  if (year < MIN_SEASON || year > MAX_SEASON) continue
  for (const p of players) {
    const k = `${group}-${year}-${p.personId}`
    totalWeightByPersonGroupSeason.set(k, (totalWeightByPersonGroupSeason.get(k) ?? 0) + p.weight)
  }
}

// --------------------------------------------------- build team-season rows
function buildGroupRows(group, { includeShortSeason }) {
  const rows = []
  let coveredWeight = 0
  let totalWeight = 0
  let excludedNoPositiveWar = 0
  for (const [key, players] of Object.entries(rosterAgeCache)) {
    const [rowGroup, teamIdStr, yearStr] = key.split('-')
    if (rowGroup !== group) continue
    const year = Number(yearStr)
    if (year < MIN_SEASON || year > MAX_SEASON) continue
    const teamId = Number(teamIdStr)
    const ladderSeason = ladderBySeason.get(year)
    if (!ladderSeason) continue
    if (ladderSeason.shortSeason && !includeShortSeason) continue
    const outcome = ladderSeason.teams[teamId]
    if (!outcome) continue

    const credited = []
    for (const p of players) {
      totalWeight += p.weight
      const seasonWar = seasonWarFor(p.personId, group, year)
      if (seasonWar === undefined) continue
      coveredWeight += p.weight
      const totalPersonWeight = totalWeightByPersonGroupSeason.get(`${group}-${year}-${p.personId}`) ?? p.weight
      const share = totalPersonWeight > 0 ? p.weight / totalPersonWeight : 1
      credited.push(seasonWar * share)
    }
    const positive = credited.filter((w) => w > 0).sort((a, b) => b - a)
    const totalPos = positive.reduce((a, b) => a + b, 0)
    if (positive.length === 0 || totalPos <= 0) {
      excludedNoPositiveWar++
      continue
    }
    const top1Share = positive[0] / totalPos
    const top2Share = (positive[0] + (positive[1] ?? 0)) / totalPos
    const hhi = positive.reduce((s, w) => s + (w / totalPos) ** 2, 0)

    rows.push({
      year,
      teamId,
      ladder: outcome.ladder,
      madePostseason: outcome.madePostseason,
      wonDivision: outcome.wonDivision,
      totalPositiveWar: totalPos,
      nPositivePlayers: positive.length,
      top1Share,
      top2Share,
      hhi,
    })
  }
  return { rows, coveredWeight, totalWeight, excludedNoPositiveWar }
}

function report(rows, label) {
  console.log(`\n=== ${label} (n=${rows.length} team-seasons) ===`)

  for (const key of ['top1Share', 'top2Share', 'hhi']) {
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

  console.log('\nBand comparisons (mean value):')
  const bands = [
    ['made the postseason at all', (r) => r.ladder >= 1],
    ['reached the LCS or better', (r) => r.ladder >= 3],
    ['won the World Series', (r) => r.ladder === 5],
  ]
  for (const [bandLabel, pred] of bands) {
    for (const key of ['top1Share', 'top2Share', 'hhi']) {
      const flagged = rows.map((r) => ({ ...r, __flag: pred(r) }))
      const { inGroup, outGroup, n } = meanDiff(flagged, key, '__flag')
      const diff = inGroup - outGroup
      const p = permutationTestMeanDiff(flagged, key, '__flag', diff)
      console.log(
        `  ${bandLabel} (${key}): ${inGroup.toFixed(4)} (n=${n[0]}) vs ` +
          `${outGroup.toFixed(4)} (n=${n[1]}) — diff ${diff >= 0 ? '+' : ''}${diff.toFixed(4)}, permutation p=${p.toFixed(4)}`,
      )
    }
  }

  console.log('\nDivision winners vs. wild-card teams, restricted to postseason teams:')
  const postseasonRows = rows.filter((r) => r.madePostseason)
  for (const key of ['top1Share', 'top2Share', 'hhi']) {
    const flagged = postseasonRows.map((r) => ({ ...r, __flag: r.wonDivision }))
    const { inGroup, outGroup, n } = meanDiff(flagged, key, '__flag')
    const diff = inGroup - outGroup
    const p = permutationTestMeanDiff(flagged, key, '__flag', diff)
    console.log(
      `  wonDivision (${key}): ${inGroup.toFixed(4)} (n=${n[0]}) vs ` +
        `${outGroup.toFixed(4)} (n=${n[1]}) — diff ${diff >= 0 ? '+' : ''}${diff.toFixed(4)}, permutation p=${p.toFixed(4)}`,
    )
  }

  console.log('\nSample stats:')
  for (const key of ['top1Share', 'top2Share', 'hhi']) {
    const values = rows.map((r) => r[key])
    console.log(`  ${key}: mean=${mean(values).toFixed(4)} sd=${sd(values).toFixed(4)}`)
  }
}

for (const group of ['hitting', 'pitching']) {
  const { rows, coveredWeight, totalWeight, excludedNoPositiveWar } = buildGroupRows(group, {
    includeShortSeason: false,
  })
  console.log(
    `\n\n########## ${group.toUpperCase()} ##########`,
  )
  console.log(
    `WAR coverage: ${coveredWeight}/${totalWeight} PA/IP-weighted playing time resolved to a WAR value ` +
      `(${((coveredWeight / totalWeight) * 100).toFixed(1)}%). ${excludedNoPositiveWar} team-seasons excluded ` +
      `for having no player with positive WAR (or unresolved-only rosters).`,
  )
  report(rows, `${group}, ${MIN_SEASON}-${MAX_SEASON} excluding 2020`)

  const { rows: withShort } = buildGroupRows(group, { includeShortSeason: true })
  report(withShort, `${group}, sensitivity check: 2020 included`)
}

// --------------------------------------------------- stretch: All-Star count
console.log('\n\n=== STRETCH: All-Star count as a second, independent star measure ===')
console.log('(counts distinct players on a team\'s All-Star roster that season — starters + bullpen + substitutes)')

function allStarCountsForSeason(year) {
  const season = allStarData.rosters[String(year)]
  const counts = new Map()
  if (!season) return counts
  for (const league of Object.values(season)) {
    for (const group of Object.values(league)) {
      if (!Array.isArray(group)) continue
      for (const player of group) {
        counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1)
      }
    }
  }
  return counts
}

const asRows = []
for (const season of ladderData.seasons) {
  if (season.shortSeason) continue
  if (season.year < MIN_SEASON || season.year > MAX_SEASON) continue
  const counts = allStarCountsForSeason(season.year)
  for (const [teamId, outcome] of Object.entries(season.teams)) {
    asRows.push({
      year: season.year,
      teamId: Number(teamId),
      ladder: outcome.ladder,
      madePostseason: outcome.madePostseason,
      wonDivision: outcome.wonDivision,
      allStarCount: counts.get(Number(teamId)) ?? 0,
    })
  }
}
console.log(`n=${asRows.length} team-seasons, ${MIN_SEASON}-${MAX_SEASON} excluding 2020`)
{
  const rho = spearman(
    asRows.map((r) => r.allStarCount),
    asRows.map((r) => r.ladder),
  )
  const p = permutationTest(asRows, 'allStarCount', 'ladder', 'year', rho)
  const loso = leaveOneSeasonOut(asRows, 'allStarCount', 'ladder')
  const sameSign = loso.filter((r) => Math.sign(r) === Math.sign(rho)).length
  console.log(
    `allStarCount: Spearman rho=${rho.toFixed(4)} vs ladder, permutation p=${p.toFixed(4)}, ` +
      `same-sign in ${sameSign}/${loso.length} leave-one-season-out refits`,
  )
  const postseasonRows = asRows.filter((r) => r.madePostseason)
  const { inGroup, outGroup, n } = meanDiff(
    postseasonRows.map((r) => ({ ...r, __flag: r.wonDivision })),
    'allStarCount',
    '__flag',
  )
  const diff = inGroup - outGroup
  const pDiv = permutationTestMeanDiff(
    postseasonRows.map((r) => ({ ...r, __flag: r.wonDivision })),
    'allStarCount',
    '__flag',
    diff,
  )
  console.log(
    `wonDivision: ${inGroup.toFixed(2)} All-Stars (n=${n[0]}) vs ${outGroup.toFixed(2)} (n=${n[1]}) ` +
      `— diff ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}, permutation p=${pDiv.toFixed(4)}`,
  )
}

// Does All-Star count correlate with the concentration measures themselves?
// (a sanity check on what "star count" is actually picking up — more
// All-Stars could mean more TOP talent regardless of concentration, or it
// could mean less concentration if All-Star nods spread across the roster)
{
  const { rows: hitRows } = buildGroupRows('hitting', { includeShortSeason: false })
  const byKey = new Map(asRows.map((r) => [`${r.year}-${r.teamId}`, r.allStarCount]))
  const paired = hitRows
    .map((r) => ({ top1Share: r.top1Share, allStarCount: byKey.get(`${r.year}-${r.teamId}`) }))
    .filter((r) => r.allStarCount !== undefined)
  const rho = spearman(
    paired.map((r) => r.top1Share),
    paired.map((r) => r.allStarCount),
  )
  console.log(
    `\nFor reference — hitting top1Share vs. All-Star count, same team-seasons (n=${paired.length}): ` +
      `Spearman rho=${rho.toFixed(4)} (not a hypothesis test, just checking what the two measures track)`,
  )
}
