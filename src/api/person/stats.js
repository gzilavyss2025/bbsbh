// Stat aggregation, season tiles, vs-L/R + situational splits, and league rank
// chips. See ../person.js's header for the module's overall spoiler footing.

import { ipToOuts } from '../rehab-policy.js'
import { DASH, num, rate3, outsToIp } from './shared.js'
import { ordinal } from './teamPage.js'

// ---------------------------------------------------------------------------
// Stat aggregation
// ---------------------------------------------------------------------------

// A stats fetch spanning a TEAM CHANGE returns the per-team stints AND a
// synthetic, team-less row equal to their sum. Verified live on both byDateRange
// and yearByYear (Marinaccio's 2026 SD -> PIT: Padres 33 G / 47.0 IP + Pirates
// 4 G / 5.1 IP + a team-less row of 37 G / 52.1 IP). Summing every row
// double-counts the whole span — which is what printed that season as
// 74 G / 104.2 IP on the career register.
//
// The roll-up's signature is: no `team`, and `numTeams` above 1. Both halves
// matter — an ordinary stint carries a `team` and no `numTeams` at all, while
// the `stats=career` line carries the same `numTeams` but arrives ALONE and
// legitimately spans teams. So requiring a team-tagged SIBLING is the actual
// test: drop the roll-up only when the rows it summarizes are present to be
// summed instead. That also leaves alone the team-less rows callers synthesize
// by hand (mlbCareerThroughCutoff, and the register's own footer totals).
//
// Exported because the career register splits a season into its per-club rows
// (byTeamStints) BEFORE it aggregates: grouping on `team.id` would give the
// team-less roll-up a group of its own and print a phantom row equal to the sum
// of the real ones, so it has to be dropped a step earlier than usual.
export function withoutMultiTeamAggregate(splits) {
  const rows = splits ?? []
  if (!rows.some((s) => s.team?.id)) return rows
  return rows.filter((s) => s.team?.id || !(Number(s.numTeams) > 1))
}

// byDateRange emits duplicate rows (verified: two identical splits for a
// single-team player); a genuinely traded player would return distinct stints.
// So: drop the multi-team roll-up (above), dedupe identical rows, then if more
// than one remains, SUM counting stats and RECOMPUTE rates from the sums (never
// average rates). One row → passthrough (exact API values). Returns a single
// stat-like object, or null.
function statSig(s) {
  return [s.atBats, s.hits, s.inningsPitched, s.strikeOuts, s.gamesPlayed].join('|')
}
export function aggregateSplits(splits, group) {
  const stats = withoutMultiTeamAggregate(splits).map((s) => s.stat).filter(Boolean)
  if (stats.length === 0) return null
  const seen = new Set()
  const uniq = stats.filter((s) => {
    const sig = statSig(s)
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })
  if (uniq.length === 1) return uniq[0]
  const sum = (k) => uniq.reduce((t, s) => t + num(s[k]), 0)
  if (group === 'pitching') {
    const outs = uniq.reduce((t, s) => t + ipToOuts(s.inningsPitched), 0)
    const ip = outs / 3
    const er = sum('earnedRuns')
    const h = sum('hits')
    const bb = sum('baseOnBalls')
    return {
      wins: sum('wins'),
      losses: sum('losses'),
      saves: sum('saves'),
      inningsPitched: outsToIp(outs),
      strikeOuts: sum('strikeOuts'),
      baseOnBalls: bb,
      earnedRuns: er,
      gamesPlayed: sum('gamesPlayed'),
      gamesStarted: sum('gamesStarted'),
      // ERA/WHIP are 2-decimal by baseball convention ("4.27", "1.30"), matching
      // the API's own single-stint values — never rate3's three, which would make
      // a mid-season-trade season read differently from every other row.
      era: ip ? ((er * 9) / ip).toFixed(2) : DASH,
      whip: ip ? ((bb + h) / ip).toFixed(2) : DASH,
    }
  }
  const ab = sum('atBats')
  const h = sum('hits')
  const bb = sum('baseOnBalls')
  const hbp = sum('hitByPitch')
  const sf = sum('sacFlies')
  const tb = sum('totalBases')
  const obpDen = ab + bb + hbp + sf
  const obp = obpDen ? (h + bb + hbp) / obpDen : 0
  const slg = ab ? tb / ab : 0
  return {
    atBats: ab,
    hits: h,
    doubles: sum('doubles'),
    homeRuns: sum('homeRuns'),
    rbi: sum('rbi'),
    runs: sum('runs'),
    strikeOuts: sum('strikeOuts'),
    stolenBases: sum('stolenBases'),
    baseOnBalls: bb,
    gamesPlayed: sum('gamesPlayed'),
    avg: ab ? rate3(h / ab) : DASH,
    obp: rate3(obp),
    slg: rate3(slg),
    ops: rate3(obp + slg),
  }
}

// ---------------------------------------------------------------------------
// Season tiles — the finalized card set
// ---------------------------------------------------------------------------

function tile(k, v, tone) {
  return { k, v: v === undefined || v === null || v === '' ? DASH : String(v), tone }
}

// WAR (season, FanGraphs) for the tile — MLB-only, so it's null on a MiLB tile
// and renders as a dash. A number formats to one decimal ("4.2", "-0.3").
function warTile(war) {
  return tile('WAR', war == null ? null : war.toFixed(1))
}

// Batter: AVG · HR · RBI · SO · WAR. WAR takes SB's slot (the least essential of
// the old five) so the row stays five-across on a phone.
export function hitterTiles(stat, war) {
  if (!stat) return []
  return [
    tile('AVG', stat.avg),
    tile('HR', stat.homeRuns, 'run'),
    tile('RBI', stat.rbi),
    tile('SO', stat.strikeOuts),
    warTile(war),
  ]
}

// Pitcher: closer => SV·IP·ERA·K·WAR; everyone else (SP + swing/RP) =>
// W-L·IP·ERA·K·WAR. Only the lead tile differs. WAR takes BB's slot to keep the
// row five-across.
export function pitcherTiles(stat, role, war) {
  if (!stat) return []
  const lead =
    role === 'CL'
      ? tile('SV', stat.saves)
      : tile('W–L', `${num(stat.wins)}–${num(stat.losses)}`)
  return [
    lead,
    tile('IP', stat.inningsPitched),
    tile('ERA', stat.era),
    tile('K', stat.strikeOuts, 'run'),
    warTile(war),
  ]
}

// ---------------------------------------------------------------------------
// vs-L/R splits (full season — the UI labels them so, not "entering today")
// ---------------------------------------------------------------------------

// One side (vs L or vs R) as a full stat line: the AVG/OBP/OPS slash plus HR,
// RBI, XBH, and the strikeout/walk RATES. The rates need a plate-appearance
// denominator, which the API names differently by group — `plateAppearances`
// on a hitter's line, `battersFaced` on a pitcher's opponent line (verified
// live) — so the group picks the field. A side the player never saw (faced
// only righties, say) has no stat and renders as all dashes.
function splitSide(stat, group) {
  if (!stat) {
    return { count: DASH, slash: DASH, hr: DASH, rbi: DASH, xbh: DASH, soPct: DASH, bbPct: DASH }
  }
  const pa = group === 'pitching' ? num(stat.battersFaced) : num(stat.plateAppearances)
  const pct = (x) => (pa ? `${Math.round((num(x) / pa) * 100)}%` : DASH)
  const slash = [stat.avg, stat.obp, stat.ops].map((v) => v ?? DASH).join('/')
  return {
    count: group === 'pitching' ? num(stat.battersFaced) : num(stat.atBats),
    slash,
    hr: num(stat.homeRuns),
    rbi: num(stat.rbi),
    xbh: num(stat.doubles) + num(stat.triples) + num(stat.homeRuns),
    soPct: pct(stat.strikeOuts),
    bbPct: pct(stat.baseOnBalls),
  }
}

export function splitsView(lrSplits, group) {
  const byCode = {}
  for (const s of lrSplits ?? []) {
    const code = s.split?.code
    if (code) byCode[code] = s.stat
  }
  const l = byCode.vl
  const r = byCode.vr
  if (!l && !r) return null
  return { left: splitSide(l, group), right: splitSide(r, group) }
}

// ---------------------------------------------------------------------------
// Situational splits (pitching) — a curated slice of the API's sitCodes menu
// (base state, count leverage, two strikes), same splitSide shape and ledger
// columns as the vs-L/R card so the two read as one family. Full-season
// figures, same spoiler footing as splitsView. The base-state trio comes
// first (empty → on → RISP mirrors escalating danger), then count leverage.
// ---------------------------------------------------------------------------

const SITUATIONAL_CODES = [
  ['r0', 'Bases empty'],
  ['ron', 'Runners on'],
  ['risp', 'RISP'],
  ['ac', 'Ahead in count'],
  ['bc', 'Behind in count'],
  ['2s', 'Two strikes'],
]
export const SITUATIONAL_SIT_CODES = SITUATIONAL_CODES.map(([code]) => code).join(',')

export function situationalSplitsView(splits, group) {
  const byCode = {}
  for (const s of splits ?? []) {
    const code = s.split?.code
    if (code) byCode[code] = s.stat
  }
  const rows = SITUATIONAL_CODES.filter(([code]) => byCode[code]).map(([code, label]) => ({
    code,
    label,
    side: splitSide(byCode[code], group),
  }))
  // A couple of stray rows (a September call-up who's barely pitched) read
  // as noise, not a table — require most of the set before rendering.
  return rows.length >= 4 ? rows : null
}

// ---------------------------------------------------------------------------
// League ranks (pitching) — stats=rankings returns the player's rank within
// his own league for each standard stat. Curated to the headline stats and
// gated to top-10 ranks: "1st in NL ERA" is a fact worth a chip; "38th in
// wins" is not. Live full-season ranks with no as-of history, so the strip
// is current-day only (loadPlayer skips the fetch under a spoiler cutoff,
// same rule as FoulCard/Recent workload).
// ---------------------------------------------------------------------------

const RANK_STATS = [
  ['era', 'ERA'],
  ['whip', 'WHIP'],
  ['strikeOuts', 'K'],
  ['wins', 'Wins'],
  ['saves', 'Saves'],
  ['avg', 'Opp. AVG'],
  ['inningsPitched', 'IP'],
]
const RANK_FLOOR = 10
const RANK_MAX_CHIPS = 4

export function pitchingRanksView(splits) {
  const s = (splits ?? [])[0]
  if (!s?.stat) return null
  const leagueName = s.league?.name ?? ''
  const league =
    leagueName === 'National League' ? 'NL' : leagueName === 'American League' ? 'AL' : leagueName
  const items = []
  for (const [key, label] of RANK_STATS) {
    const rank = Number(s.stat[key])
    if (Number.isFinite(rank) && rank >= 1 && rank <= RANK_FLOOR) {
      items.push({ label, rank, text: ordinal(rank) })
    }
  }
  if (!items.length) return null
  items.sort((a, b) => a.rank - b.rank)
  return { league, items: items.slice(0, RANK_MAX_CHIPS) }
}

// Hitting counterpart to pitchingRanksView — same top-10-only gate and chip
// cap, curated to the headline hitting stats instead. Shares RANK_FLOOR /
// RANK_MAX_CHIPS with the pitching version rather than a hitting-specific
// pair, since the "worth a chip" bar doesn't change by group.
const HITTING_RANK_STATS = [
  ['homeRuns', 'HR'],
  ['rbi', 'RBI'],
  ['avg', 'AVG'],
  ['ops', 'OPS'],
  ['stolenBases', 'SB'],
  ['hits', 'H'],
]

export function hittingRanksView(rankSplits) {
  const s = (rankSplits ?? [])[0]
  if (!s?.stat) return null
  const leagueName = s.league?.name ?? ''
  const league =
    leagueName === 'National League' ? 'NL' : leagueName === 'American League' ? 'AL' : leagueName
  const items = []
  for (const [key, label] of HITTING_RANK_STATS) {
    const rank = Number(s.stat[key])
    if (Number.isFinite(rank) && rank >= 1 && rank <= RANK_FLOOR) {
      items.push({ label, rank, text: ordinal(rank) })
    }
  }
  if (!items.length) return null
  items.sort((a, b) => a.rank - b.rank)
  return { league, items: items.slice(0, RANK_MAX_CHIPS) }
}
