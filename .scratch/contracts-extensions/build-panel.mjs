// Builds the two panels the extension-value spike (W3.3) analyzes:
//
//   fa-war-price.json        -- a season-by-season price of one win (WAR),
//                                derived from free_agency.csv itself: every
//                                (AAV, WAR delivered that season) pair from a
//                                real free-agent contract, pooled by the
//                                PERFORMANCE season (not the signing season),
//                                so an unfinished deal still contributes its
//                                completed seasons.
//   extension-outcomes.json  -- one row per extensions.csv signing that can
//                                be scored: guarantee vs. the market value of
//                                the WAR delivered from first_year through
//                                final_year, priced season-by-season off the
//                                first panel.
//
// Run: node .scratch/contracts-extensions/build-panel.mjs
//
// Method notes (full writeup: docs/contracts-extension-value.md):
//
// PRICE OF A WIN. A dollar figure only means something next to what it
// bought. This spike prices a win using the league's own free-agent market
// in free_agency.csv -- not an outside estimate -- because that file is
// already in the repo, already identity-resolved, and is literally the
// market this program is asking whether an extension beats. For each
// USABLE free-agent contract (real numeric AAV, real numeric year count,
// resolved mlbId), every season of that deal that has already been played
// (<=2025, the last season public/data/war-history/*.json carries) becomes
// one observation: (AAV that year, WAR delivered that year). Pooling by
// PERFORMANCE season means a five-year deal signed in 2022 contributes its
// 2022-2025 seasons to those four seasons' price even though the deal
// itself will not finish until 2026 -- there is no reason to wait for a
// contract to end before its completed seasons can inform the market price
// of a win in the years they happened. Deals with a resolved mlbId but with
// unresolved/negative-WAR seasons still count -- excluding them would
// throw away exactly the observations that make the win expensive.
//
// TWO price estimates are kept per season, because the choice matters (the
// spike prompt requires testing one alternative):
//   - ratio:  sum(AAV) / sum(WAR) that season -- the average price paid per
//             win bought, including replacement-level dollars paid for
//             near-zero WAR.
//   - slope:  OLS regression of AAV on WAR within that season -- the
//             MARGINAL price of an extra win, net of the replacement-level
//             cost every player carries regardless of production (the
//             regression intercept).
// The analysis script picks the slope as PRIMARY (it is the standard
// sabermetric definition of "$/win") and reports how the extension verdict
// moves under the ratio instead.
//
// CENSORING. free_agency.csv's own AAV is fixed at signing and does not
// react to performance, so using it against THAT season's WAR is not
// circular -- but a season with too few resolved observations makes a
// noisy price. Seasons before free agency was mature (pre-1995) and 2026
// (mostly unplayed) are flagged with their N so the analysis script can
// decide whether to trust them alone or fall back to a pooled multi-season
// window.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCsv, loadIdentity, loadWarHistory, warInSeason, sumWar, REPO_ROOT } from './lib.mjs'
import { parseMoneyCell } from '../../src/lib/contracts/parseMoney.js'

const OUT_DIR = join(REPO_ROOT, '.scratch', 'contracts-extensions')
const LAST_WAR_SEASON = 2025 // last season public/data/war-history/*.json carries (verified against the shard's own `seasons` array)

// ---------------------------------------------------------------------------
// 1. Free-agent AAV-vs-WAR observations, one per (deal, played season).
// ---------------------------------------------------------------------------
const faRows = loadCsv('free_agency')
const faIdentity = loadIdentity('free_agency')

let faTotal = faRows.length
let faExcludedNoNumericAav = 0
let faExcludedNoYears = 0
let faExcludedNoIdentity = 0
let faExcludedFuzzyIdentity = 0
const faDealsUsed = []
const faObservations = [] // { season, aav, war, mlbId, rowKey }

faRows.forEach((row, i) => {
  const rowKey = `free_agency#${i}`
  const years = Number(row.years)
  const firstYear = Number(row.year)
  const aavParsed = parseMoneyCell(row.aav, 'aav', { years: row.years, details: row.details })

  if (aavParsed.status !== null || !Number.isFinite(aavParsed.amount) || aavParsed.amount <= 0) {
    faExcludedNoNumericAav += 1
    return
  }
  if (!Number.isInteger(years) || years <= 0 || !Number.isInteger(firstYear)) {
    faExcludedNoYears += 1
    return
  }
  // The identity crosswalk JSON is keyed by plain array index (0, 1, 2, ...),
  // not by the "free_agency#N" rowKey string each record itself carries --
  // verified against a real row before assuming the shape.
  const identity = faIdentity[String(i)]
  if (!identity || identity.mlbId == null) {
    faExcludedNoIdentity += 1
    return
  }
  if (identity.confidence === 'fuzzy') faExcludedFuzzyIdentity += 1 // counted, not dropped -- logged separately

  faDealsUsed.push({ rowKey, mlbId: identity.mlbId, firstYear, years, aav: aavParsed.amount })
})

const warById = loadWarHistory()

let faSeasonsSkippedUnplayed = 0
let faSeasonsSkippedNoWarRow = 0
for (const deal of faDealsUsed) {
  const finalYear = deal.firstYear + deal.years - 1
  for (let season = deal.firstYear; season <= finalYear; season += 1) {
    if (season > LAST_WAR_SEASON) {
      faSeasonsSkippedUnplayed += 1
      continue
    }
    const war = warInSeason(warById, deal.mlbId, season)
    if (war === null) {
      // No war-history row at all for this player-season -- almost always a
      // season he did not appear in the majors (hurt, released, minors).
      // Zero WAR is a fact this loop keeps (a real observation of money paid
      // for nothing); NO row is not the same fact and is dropped instead of
      // silently defaulting to zero, which would fabricate a data point.
      faSeasonsSkippedNoWarRow += 1
      continue
    }
    faObservations.push({ season, aav: deal.aav, war, mlbId: deal.mlbId, rowKey: deal.rowKey })
  }
}

// ---------------------------------------------------------------------------
// 2. Per-season price of a win: ratio and OLS slope.
// ---------------------------------------------------------------------------
function olsSlope(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  if (sxx === 0) return { slope: null, intercept: null }
  const slope = sxy / sxx
  const intercept = my - slope * mx
  return { slope, intercept }
}

const bySeason = new Map()
for (const obs of faObservations) {
  if (!bySeason.has(obs.season)) bySeason.set(obs.season, [])
  bySeason.get(obs.season).push(obs)
}

const seasonPrices = {}
for (const [season, obs] of [...bySeason.entries()].sort((a, b) => a[0] - b[0])) {
  const sumAav = obs.reduce((a, o) => a + o.aav, 0)
  const sumWarSeason = obs.reduce((a, o) => a + o.war, 0)
  const { slope, intercept } = olsSlope(
    obs.map((o) => o.war),
    obs.map((o) => o.aav),
  )
  seasonPrices[season] = {
    n: obs.length,
    ratioDollarsPerWar: sumWarSeason !== 0 ? sumAav / sumWarSeason : null,
    slopeDollarsPerWar: slope,
    intercept,
    sumAav,
    sumWar: sumWarSeason,
  }
}

const faPricePanel = {
  generatedAt: new Date().toISOString(),
  method:
    'Season = performance year (not signing year). Observation = one (AAV, WAR delivered) pair from a free-agent contract with a resolved mlbId, real numeric AAV, real numeric year count, and a played season <=2025. ratioDollarsPerWar = sum(AAV)/sum(WAR) that season. slopeDollarsPerWar = OLS slope of AAV on WAR that season (marginal price net of replacement-level pay).',
  lastWarSeason: LAST_WAR_SEASON,
  counts: {
    faCsvRows: faTotal,
    excludedNoNumericAav: faExcludedNoNumericAav,
    excludedNoYearsOrFirstYear: faExcludedNoYears,
    excludedNoIdentity: faExcludedNoIdentity,
    fuzzyIdentityIncluded: faExcludedFuzzyIdentity,
    dealsUsed: faDealsUsed.length,
    seasonObservations: faObservations.length,
    seasonsSkippedUnplayed: faSeasonsSkippedUnplayed,
    seasonsSkippedNoWarRow: faSeasonsSkippedNoWarRow,
  },
  bySeason: seasonPrices,
}
writeFileSync(join(OUT_DIR, 'fa-war-price.json'), JSON.stringify(faPricePanel, null, 2))

// ---------------------------------------------------------------------------
// 3. Extension outcomes.
// ---------------------------------------------------------------------------
const extRows = loadCsv('extensions')
const extIdentity = loadIdentity('extensions')

let extTotal = extRows.length
let extExcludedNoIdentity = 0
let extExcludedFuzzyIdentity = 0
let extExcludedCensored = 0
let extExcludedNoWar = 0
let extExcludedBadGuarantee = 0
let extExcludedBadYears = 0
const outcomes = []

extRows.forEach((row, i) => {
  const rowKey = `extensions#${i}`
  const guaranteeParsed = parseMoneyCell(row.guarantee, 'guarantee', { years: row.years, details: '' })
  const aavParsed = parseMoneyCell(row.aav, 'aav', { years: row.years, details: '' })
  const firstYear = Number(row.first_year)
  const finalYear = Number(row.final_year)
  const years = Number(row.years)
  const mls = row.mls === '' ? null : Number(row.mls)

  // Same indexing note as the free-agency loop above: keyed by plain index.
  const identity = extIdentity[String(i)]
  if (!identity || identity.mlbId == null) {
    extExcludedNoIdentity += 1
    return
  }

  if (guaranteeParsed.status !== null || !Number.isFinite(guaranteeParsed.amount) || guaranteeParsed.amount <= 0) {
    extExcludedBadGuarantee += 1
    return
  }
  if (!Number.isInteger(firstYear) || !Number.isInteger(finalYear) || finalYear < firstYear) {
    extExcludedBadYears += 1
    return
  }
  if (finalYear > LAST_WAR_SEASON) {
    // The deal's own window has not finished playing out. Scoring it now
    // would compare a full guarantee to a partial WAR total -- exactly the
    // bias the dispatch calls out. Excluded, not truncated.
    extExcludedCensored += 1
    return
  }

  const totalWar = sumWar(warById, identity.mlbId, firstYear, finalYear)
  if (totalWar === null) {
    // Resolved identity, but not one war-history row anywhere in the window
    // -- e.g. an extension signed just before a career-ending injury with no
    // MLB game ever played inside the window.
    extExcludedNoWar += 1
    return
  }

  if (identity.confidence === 'fuzzy') extExcludedFuzzyIdentity += 1 // counted, not dropped

  // Market value of the delivered WAR, priced season-by-season off the FA
  // panel above. Two versions kept side by side: `slope` (primary) and
  // `ratio` (the plausible alternative the spike prompt asks for). A season
  // with zero FA observations (n=0) has no local price at all -- rather than
  // inventing one, that season's WAR carries no market value and is logged
  // under `unpricedWar`/`unpricedSeasons` on the row, and the row itself is
  // still scored on however many priced seasons it has (if any).
  let marketValueSlope = 0
  let marketValueRatio = 0
  let unpricedWar = 0
  let unpricedSeasons = 0
  const perSeason = []
  for (let season = firstYear; season <= finalYear; season += 1) {
    const warThatSeason = warInSeason(warById, identity.mlbId, season) ?? 0
    const price = seasonPrices[season]
    if (!price || price.n < 5) {
      // Fewer than 5 FA observations that season is too thin a market to
      // price off of alone -- see docs/contracts-extension-value.md for the
      // count by season. That season's WAR is logged as unpriced rather
      // than priced at a noisy or nonexistent rate.
      unpricedWar += warThatSeason
      unpricedSeasons += 1
      perSeason.push({ season, war: warThatSeason, priced: false })
      continue
    }
    const slopeValue = price.slopeDollarsPerWar != null ? warThatSeason * price.slopeDollarsPerWar : 0
    const ratioValue = price.ratioDollarsPerWar != null ? warThatSeason * price.ratioDollarsPerWar : 0
    marketValueSlope += slopeValue
    marketValueRatio += ratioValue
    perSeason.push({ season, war: warThatSeason, priced: true, slopeValue, ratioValue })
  }

  outcomes.push({
    rowKey,
    player: row.player,
    mlbId: identity.mlbId,
    identityConfidence: identity.confidence,
    position: row.position,
    ageAtSigning: Number(row.age) || null,
    serviceTimeAtSigning: mls,
    club: row.club,
    years,
    guarantee: guaranteeParsed.amount,
    aav: aavParsed.status === null ? aavParsed.amount : null,
    firstYear,
    finalYear,
    signedDate: row.signed_date || null,
    option: row.option || null,
    agent: row.agent || null,
    clubOwner: row.club_owner || null,
    gm: row.gm || null,
    totalWar,
    marketValueSlope,
    marketValueRatio,
    surplusSlope: marketValueSlope - guaranteeParsed.amount,
    surplusRatio: marketValueRatio - guaranteeParsed.amount,
    unpricedWar,
    unpricedSeasons,
    seasonsInWindow: finalYear - firstYear + 1,
    perSeason,
  })
})

const extensionPanel = {
  generatedAt: new Date().toISOString(),
  lastWarSeason: LAST_WAR_SEASON,
  counts: {
    extensionsCsvRows: extTotal,
    excludedNoIdentity: extExcludedNoIdentity,
    fuzzyIdentityIncluded: extExcludedFuzzyIdentity,
    excludedBadGuarantee: extExcludedBadGuarantee,
    excludedBadYears: extExcludedBadYears,
    excludedCensoredStillActive: extExcludedCensored,
    excludedNoWarRowInWindow: extExcludedNoWar,
    scored: outcomes.length,
  },
  outcomes,
}
writeFileSync(join(OUT_DIR, 'extension-outcomes.json'), JSON.stringify(extensionPanel, null, 2))

console.log('FA price panel:', faPricePanel.counts)
console.log('Extension outcomes panel:', extensionPanel.counts)
