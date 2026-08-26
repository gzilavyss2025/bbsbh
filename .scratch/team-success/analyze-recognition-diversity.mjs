// Spike: does the star-diversity finding (docs/team-success-star-diversity.md)
// replicate on an INDEPENDENT measure — recognition (All-Star selections +
// major awards) instead of WAR? Same statistical template as that spike
// (Spearman vs the 0-5 ladder, within-season permutation test,
// leave-one-season-out, band comparisons, division-winner split), same
// hitting/pitching side split, swapping the underlying "value" resource from
// WAR to a "recognition honor."
//
// Two data sources, both already in this repo, neither newly pulled:
//   - public/data/all-star-rosters.json — All-Star selections, 1933-2026.
//     Each selection is a single yes/no per player per season: a player is
//     either on the roster or not, once. That means an All-Star-ONLY
//     concentration index carries NO information beyond the plain COUNT of
//     All-Stars already tested in the original spike's stretch section
//     (rho=0.5568) — with one honor per player, top1Share is just 1/n by
//     construction. A genuine "recognition CONCENTRATION" measure — some
//     players stacking several honors while others get none or one — needs a
//     second, stackable source of recognition. That is the reason this script
//     also pulls awards, not just All-Star nods.
//   - public/data/awards-history.json — MVP, Cy Young, Rookie of the Year,
//     Silver Slugger, Gold Glove, Platinum Glove, Reliever of the Year,
//     Comeback Player, Hank Aaron, Roberto Clemente, All-MLB First/Second
//     Team. THE constraint this spike runs into: this file is a hand-run,
//     rolling 5-season window (scripts/gen-awards-history.mjs), not a
//     historical archive — it currently covers 2022-2025 only, four seasons.
//     Every headline number below is therefore n=120 team-seasons at most,
//     the thinnest primary sample in this program (thinner than the
//     WAR-based spike's own World Series cut, n=15, only in the sense that
//     the WAR spike's THIN cuts were sub-slices of a 450-team-season base —
//     here the WHOLE base is this thin). Stated loudly throughout, not just
//     here.
//
// Recognition-honor definition, per player per team-season, per side
// (hitting/pitching, split on award/roster position — P/SP/RP/CP counts as
// pitching, everything else as hitting; a "TWP" (two-way player) recipient —
// Ohtani, the only case in this window — is credited on BOTH sides, since
// war-history and roster-age-cache already carry him on both sides
// separately):
//   honors = (1 if named to that season's All-Star roster) +
//            (1 per major award won that season, uniform weight)
// Deliberately UNWEIGHTED across award types (MVP counts the same as a
// Silver Slugger) rather than inventing a value scale with no baseline to
// calibrate it against — see the note in "What this does not settle."
//
// Concentration measures, computed over each team-season's POSITIVE-honors
// players only (mirrors the WAR spike's "only positive WAR counts" rule —
// here the natural floor is 0 honors, not a negative number, but the same
// logic: an unrecognized player isn't "diluting" the team's stars):
//   top1Share, top2Share, hhi — identical definitions to
//   analyze-star-diversity.mjs, over honors-share instead of WAR-share.
//
// Run: node .scratch/team-success/analyze-recognition-diversity.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const read = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))

const ladderData = read(__dirname, 'outcome-ladder.json')
const rosterAgeCache = read(__dirname, 'roster-age-cache.json')
const allStarData = read(join(REPO_ROOT, 'public', 'data'), 'all-star-rosters.json')
const awardsData = read(join(REPO_ROOT, 'public', 'data'), 'awards-history.json')
const warHistoryDir = join(REPO_ROOT, 'public', 'data', 'war-history')

const ladderBySeason = new Map(ladderData.seasons.map((s) => [s.year, s]))

// ------------------------------------------------------------ stats library
// (identical to analyze-star-diversity.mjs — small, generic, self-contained;
// not worth importing across spike scripts per this repo's own convention of
// small deliberate mirrors)
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
// Only 4 seasons exist in the primary window (see header), so
// leave-one-season-out is a weak check on its own here (4 folds instead of
// the 15-26 every earlier spike in this program used). Leave-one-club-out
// (30 folds, one per franchise) is the sturdier robustness check for THIS
// spike specifically, and is run alongside it below.
function leaveOneClubOut(rows, valueKey, outcomeKey) {
  const teamIds = [...new Set(rows.map((r) => r.teamId))]
  return teamIds.map((teamId) => {
    const subset = rows.filter((r) => r.teamId !== teamId)
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

// -------------------------------------------------------- honors bookkeeping
const PITCHING_POSITIONS = new Set(['P', 'SP', 'RP', 'CP'])
function sidesFor(position) {
  if (position === 'TWP') return ['hitting', 'pitching']
  return [PITCHING_POSITIONS.has(position) ? 'pitching' : 'hitting']
}

// honorsByKey: `${side}-${teamId}-${year}` -> Map<personId, {name, honors}>
const honorsByKey = new Map()
function addHonor(side, teamId, year, personId, name) {
  const key = `${side}-${teamId}-${year}`
  if (!honorsByKey.has(key)) honorsByKey.set(key, new Map())
  const players = honorsByKey.get(key)
  if (!players.has(personId)) players.set(personId, { name, honors: 0 })
  players.get(personId).honors += 1
}

// All-Star selections, ALL years present (1933-2026) — used both for the
// full-window sanity check (mechanically ~1/count, see header) and folded
// into the combined honors measure for the years awards data also covers.
const ALL_STAR_GROUPS = ['starters', 'bullpen', 'substitutes']
let allStarYearMin = Infinity
let allStarYearMax = -Infinity
for (const [yearStr, season] of Object.entries(allStarData.rosters)) {
  const year = Number(yearStr)
  allStarYearMin = Math.min(allStarYearMin, year)
  allStarYearMax = Math.max(allStarYearMax, year)
  for (const league of Object.values(season)) {
    for (const groupName of ALL_STAR_GROUPS) {
      const group = league[groupName]
      if (!Array.isArray(group)) continue
      for (const player of group) {
        for (const side of sidesFor(player.position)) {
          addHonor(side, player.teamId, year, player.playerId, player.name)
        }
      }
    }
  }
}

// Awards — every family, every year present (2022-2025 as of this run).
let awardsYearMin = Infinity
let awardsYearMax = -Infinity
const awardYearsSeen = new Set()
for (const family of awardsData.families) {
  for (const [yearStr, recipients] of Object.entries(family.years)) {
    const year = Number(yearStr)
    awardsYearMin = Math.min(awardsYearMin, year)
    awardsYearMax = Math.max(awardsYearMax, year)
    awardYearsSeen.add(year)
    for (const r of recipients) {
      for (const side of sidesFor(r.position)) {
        addHonor(side, r.teamId, year, r.playerId, r.name)
      }
    }
  }
}
const AWARD_YEARS = [...awardYearsSeen].sort((a, b) => a - b)
console.log(
  `All-Star data: ${allStarYearMin}-${allStarYearMax}. Award data: ${awardsYearMin}-${awardsYearMax} ` +
    `(years present: ${AWARD_YEARS.join(', ')}).`,
)

// --------------------------------------------------- build team-season rows
// Combined honors (All-Star + awards) for the years both sources cover. The
// All-Star-only cross-check below uses a separate, dedicated builder rather
// than this one — see its own comment.
function buildGroupRows(side, { years }) {
  const rows = []
  let excludedNoHonors = 0
  for (const year of years) {
    const ladderSeason = ladderBySeason.get(year)
    if (!ladderSeason) continue
    if (ladderSeason.shortSeason) continue
    for (const teamIdStr of Object.keys(ladderSeason.teams)) {
      const teamId = Number(teamIdStr)
      const outcome = ladderSeason.teams[teamId]
      const key = `${side}-${teamId}-${year}`
      const players = honorsByKey.get(key)
      let counts = players ? [...players.values()].map((p) => p.honors) : []
      counts = counts.filter((c) => c > 0).sort((a, b) => b - a)
      const total = counts.reduce((a, b) => a + b, 0)
      if (counts.length === 0 || total <= 0) {
        excludedNoHonors++
        continue
      }
      const top1Share = counts[0] / total
      const top2Share = (counts[0] + (counts[1] ?? 0)) / total
      const hhi = counts.reduce((s, c) => s + (c / total) ** 2, 0)
      rows.push({
        year,
        teamId,
        ladder: outcome.ladder,
        madePostseason: outcome.madePostseason,
        wonDivision: outcome.wonDivision,
        totalHonors: total,
        nRecognizedPlayers: counts.length,
        top1Share,
        top2Share,
        hhi,
      })
    }
  }
  return { rows, excludedNoHonors }
}

// Dedicated All-Star-only builder (recomputed straight off the roster file,
// not filtered from the combined honors map) for the full-window sanity
// check described in the header.
function buildAllStarOnlyRows(side, years) {
  const rows = []
  for (const year of years) {
    const ladderSeason = ladderBySeason.get(year)
    if (!ladderSeason) continue
    if (ladderSeason.shortSeason) continue
    const season = allStarData.rosters[String(year)]
    const byTeam = new Map() // teamId -> Set(personId) (dedupe: a player named to
    // more than one bucket in error, or picked as both an original starter and
    // a late injury replacement, should not double-count)
    if (season) {
      for (const league of Object.values(season)) {
        for (const groupName of ALL_STAR_GROUPS) {
          const group = league[groupName]
          if (!Array.isArray(group)) continue
          for (const player of group) {
            for (const s of sidesFor(player.position)) {
              if (s !== side) continue
              if (!byTeam.has(player.teamId)) byTeam.set(player.teamId, new Set())
              byTeam.get(player.teamId).add(player.playerId)
            }
          }
        }
      }
    }
    for (const teamIdStr of Object.keys(ladderSeason.teams)) {
      const teamId = Number(teamIdStr)
      const outcome = ladderSeason.teams[teamId]
      const n = byTeam.get(teamId)?.size ?? 0
      if (n === 0) continue
      // Every honor = 1 by definition here, so top1Share = 1/n exactly —
      // stated in the header, verified by the printed check below.
      rows.push({
        year,
        teamId,
        ladder: outcome.ladder,
        madePostseason: outcome.madePostseason,
        wonDivision: outcome.wonDivision,
        allStarCount: n,
        top1Share: 1 / n,
      })
    }
  }
  return rows
}

function report(rows, label) {
  console.log(`\n=== ${label} (n=${rows.length} team-seasons) ===`)

  for (const key of ['top1Share', 'top2Share', 'hhi']) {
    const values = rows.map((r) => r[key])
    const ladders = rows.map((r) => r.ladder)
    const rho = spearman(values, ladders)
    const p = permutationTest(rows, key, 'ladder', 'year', rho)
    const loso = leaveOneSeasonOut(rows, key, 'ladder')
    const sameSignSeason = loso.filter((r) => Math.sign(r) === Math.sign(rho)).length
    const loco = leaveOneClubOut(rows, key, 'ladder')
    const sameSignClub = loco.filter((r) => Math.sign(r) === Math.sign(rho)).length
    console.log(
      `${key}: Spearman rho=${rho.toFixed(4)} vs ladder (0-5), permutation p=${p.toFixed(4)}, ` +
        `same-sign in ${sameSignSeason}/${loso.length} leave-one-season-out refits ` +
        `(range ${Math.min(...loso).toFixed(4)} to ${Math.max(...loso).toFixed(4)}), ` +
        `same-sign in ${sameSignClub}/${loco.length} leave-one-club-out refits ` +
        `(range ${Math.min(...loco).toFixed(4)} to ${Math.max(...loco).toFixed(4)})`,
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

// =========================================================================
// PRIMARY: combined honors (All-Star + awards), the only years both exist.
console.log('\n\n########## PRIMARY: combined recognition honors, ' + AWARD_YEARS.join('/') + ' ##########')
for (const side of ['hitting', 'pitching']) {
  const { rows, excludedNoHonors } = buildGroupRows(side, { years: AWARD_YEARS })
  console.log(`\n-- ${side.toUpperCase()} -- (${excludedNoHonors} team-seasons excluded for zero recognized players)`)
  report(rows, `${side}, combined honors, ${AWARD_YEARS[0]}-${AWARD_YEARS[AWARD_YEARS.length - 1]}`)
}

// =========================================================================
// SANITY CHECK: All-Star selections alone are mechanically ~1/count — shown
// explicitly so the primary result above isn't mistaken for telling us
// something a raw All-Star count wouldn't.
console.log('\n\n########## SANITY CHECK: All-Star selections alone (mechanical, not a new measure) ##########')
{
  const fullLadderYears = ladderData.seasons.filter((s) => !s.shortSeason).map((s) => s.year)
  for (const side of ['hitting', 'pitching']) {
    const rows = buildAllStarOnlyRows(side, fullLadderYears)
    const rho = spearman(
      rows.map((r) => r.top1Share),
      rows.map((r) => r.ladder),
    )
    const rhoCount = spearman(
      rows.map((r) => r.allStarCount),
      rows.map((r) => r.ladder),
    )
    // Confirm the mechanical identity: top1Share*allStarCount should equal 1
    // for every row (within floating-point tolerance).
    const identityHolds = rows.every((r) => Math.abs(r.top1Share * r.allStarCount - 1) < 1e-9)
    console.log(
      `${side}: n=${rows.length}, All-Star-count rho=${rhoCount.toFixed(4)} vs ladder, ` +
        `All-Star-only top1Share rho=${rho.toFixed(4)} (identity top1Share=1/count holds: ${identityHolds})`,
    )
  }
}

// =========================================================================
// CROSS-CHECK: does the combined-honors concentration measure line up with
// the ORIGINAL spike's WAR-based concentration, on the same team-seasons?
// If the two "which players are the stars" measures disagree, a null here
// would carry less weight; if they agree, that is itself informative.
console.log('\n\n########## CROSS-CHECK: honors-based vs WAR-based top1Share, same team-seasons ##########')
{
  const warByPerson = new Map()
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
  const totalWeightByPersonGroupSeason = new Map()
  for (const [key, players] of Object.entries(rosterAgeCache)) {
    const [group, , yearStr] = key.split('-')
    const year = Number(yearStr)
    if (!AWARD_YEARS.includes(year)) continue
    for (const p of players) {
      const k = `${group}-${year}-${p.personId}`
      totalWeightByPersonGroupSeason.set(k, (totalWeightByPersonGroupSeason.get(k) ?? 0) + p.weight)
    }
  }
  function warTop1Share(group, teamId, year) {
    const key = `${group}-${teamId}-${year}`
    const players = rosterAgeCache[key]
    if (!players) return undefined
    const credited = []
    for (const p of players) {
      const seasonWar = seasonWarFor(p.personId, group, year)
      if (seasonWar === undefined) continue
      const totalPersonWeight = totalWeightByPersonGroupSeason.get(`${group}-${year}-${p.personId}`) ?? p.weight
      const share = totalPersonWeight > 0 ? p.weight / totalPersonWeight : 1
      credited.push(seasonWar * share)
    }
    const positive = credited.filter((w) => w > 0).sort((a, b) => b - a)
    const totalPos = positive.reduce((a, b) => a + b, 0)
    if (positive.length === 0 || totalPos <= 0) return undefined
    return positive[0] / totalPos
  }
  for (const side of ['hitting', 'pitching'] ) {
    const { rows: honorsRows } = buildGroupRows(side, { years: AWARD_YEARS })
    const paired = []
    for (const r of honorsRows) {
      const w = warTop1Share(side, r.teamId, r.year)
      if (w !== undefined) paired.push({ honors: r.top1Share, war: w })
    }
    const rho = spearman(
      paired.map((p) => p.honors),
      paired.map((p) => p.war),
    )
    console.log(
      `${side}: n=${paired.length} team-seasons with both measures, ` +
        `Spearman rho(honors top1Share, WAR top1Share)=${rho.toFixed(4)}`,
    )
  }
}
