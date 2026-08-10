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

// One side (vs L or vs R) as a full stat line: the TRUE slash (AVG/OBP/SLG),
// OPS as its own figure, plus HR, XBH, and the strikeout/walk RATES. The rates
// need a plate-appearance denominator, which the API names differently by
// group — `plateAppearances` on a hitter's line, `battersFaced` on a pitcher's
// opponent line (verified live) — so the group picks the field. A side the
// player never saw (faced only righties, say) has no stat and renders as all
// dashes.
//
// `slash` prints SLG third, NOT OPS. It used to print OPS, which is the one
// substitution a slash line cannot survive: every reader of a three-number
// slash reads the third field as slugging by convention, so ".238/.315/.703"
// silently claimed a .703 SLG. OPS keeps its own labelled column instead — and
// unlike the other two it can exceed 1.000, which is also why it never sat
// comfortably inside a leading-dot slash.
function splitSide(stat, group) {
  if (!stat) {
    return { count: DASH, slash: DASH, ops: DASH, hr: DASH, rbi: DASH, xbh: DASH, soPct: DASH, bbPct: DASH, opsNum: null }
  }
  const pa = group === 'pitching' ? num(stat.battersFaced) : num(stat.plateAppearances)
  const pct = (x) => (pa ? `${Math.round((num(x) / pa) * 100)}%` : DASH)
  const slash = [stat.avg, stat.obp, stat.slg].map((v) => v ?? DASH).join('/')
  const opsNum = Number.parseFloat(stat.ops)
  return {
    // PLATE APPEARANCES, not at-bats — and the column is labelled PA to match.
    // SO% and BB% divide by PA (the correct convention), so a table printing an
    // AB count beside them invited the reader to multiply 28% by 80 at-bats and
    // land four strikeouts short: the denominator changed silently mid-row. PA
    // is also the better sample-size signal, since it counts the walks. The
    // pitching side already did this — `battersFaced` IS the PA equivalent.
    count: group === 'pitching' ? num(stat.battersFaced) : num(stat.plateAppearances),
    slash,
    ops: stat.ops ?? DASH,
    opsNum: Number.isFinite(opsNum) ? opsNum : null,
    hr: num(stat.homeRuns),
    rbi: num(stat.rbi),
    xbh: num(stat.doubles) + num(stat.triples) + num(stat.homeRuns),
    soPct: pct(stat.strikeOuts),
    bbPct: pct(stat.baseOnBalls),
  }
}

// The OVERALL line a split table is read against, summed from the very rows it
// sits under rather than taken from the season tile. A split is only legible as
// a difference from a reference, and the reference has to share the split's own
// scope exactly — the season tile can be a different LEVEL (a promoted big
// leaguer's MLB line over a MiLB split set), which would print a baseline the
// rows do not sum to. Both curated sets partition every plate appearance, so
// summing them is exact: vL + vR is every PA, and bases-empty + runners-on is
// every PA. Counting stats sum, rates are RECOMPUTED from those sums — never
// averaged, which is the classic weighted-mean error (a .400 over 5 AB and a
// .200 over 200 AB do not average to .300).
function overallSide(stats, group) {
  const rows = (stats ?? []).filter(Boolean)
  if (rows.length === 0) return null
  const sum = (k) => rows.reduce((t, s) => t + num(s[k]), 0)
  const ab = sum('atBats')
  const h = sum('hits')
  const bb = sum('baseOnBalls')
  const hbp = sum('hitByPitch')
  const sf = sum('sacFlies')
  const obpDen = ab + bb + hbp + sf
  const obp = obpDen ? (h + bb + hbp) / obpDen : 0
  const slg = ab ? sum('totalBases') / ab : 0
  // OPS from the ROUNDED obp/slg, not from the full-precision pair. This row
  // prints its own OBP and SLG one column to the left, and OPS is defined as
  // their sum, so a reader can and will add them up: .3155 + .3694 rounds to
  // .685 while the .315 and .369 on the page add to .684. The third decimal
  // that buys is worth less than a table that fails its own arithmetic.
  const obp3 = rate3(obp)
  const slg3 = rate3(slg)
  return splitSide(
    {
      atBats: ab,
      battersFaced: sum('battersFaced'),
      plateAppearances: sum('plateAppearances'),
      doubles: sum('doubles'),
      triples: sum('triples'),
      homeRuns: sum('homeRuns'),
      rbi: sum('rbi'),
      strikeOuts: sum('strikeOuts'),
      baseOnBalls: bb,
      avg: ab ? rate3(h / ab) : DASH,
      obp: obp3,
      slg: slg3,
      ops: rate3(Number.parseFloat(obp3) + Number.parseFloat(slg3)),
    },
    group,
  )
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
  return { left: splitSide(l, group), right: splitSide(r, group), all: overallSide([l, r], group) }
}

// ---------------------------------------------------------------------------
// Situational splits — a curated slice of the API's sitCodes menu, same
// splitSide shape and ledger columns as the vs-L/R card so the two read as one
// family. Full-season figures, same spoiler footing as splitsView.
//
// The six rows are TWO families, not one list: where the runners are (a fact
// about the inning) and who is ahead in the count (a fact about the at-bat).
// They were a flat six-row table, which invited a reader to compare "RISP" with
// "Two strikes" as though they were alternatives — they are not, they overlap
// freely. `family` is carried on every row so the UI can rule them apart, and
// the base-state trio still comes first (empty → on → RISP mirrors escalating
// danger).
//
// Only the BASE-STATE pair partitions every plate appearance, so only it can
// produce an exact overall line; the count rows overlap each other and are read
// against that same overall. RISP is a subset of runners-on and is deliberately
// left out of the sum.
// ---------------------------------------------------------------------------

// Labels are as short as they can be and still be read cold, because the label
// is the widest cell in a seven-column table that has to fit a phone: the
// family heading standing over each trio ("Base state", "Count") carries the
// context the old "Ahead in count" / "Bases empty" spelled out per row.
const SITUATIONAL_CODES = [
  ['r0', 'Empty', 'base'],
  ['ron', 'Runners on', 'base'],
  // RISP is a SUBSET of runners-on, not a third alternative beside it, and it
  // is the one overlap in this table a reader is likely to get wrong. The UI
  // indents it under its parent (`ledger__nested`) rather than explaining the
  // containment in a footnote — the indent is the older and shorter way to say
  // "part of the row above", and it needs no prose.
  ['risp', 'RISP', 'base', true],
  ['ac', 'Ahead', 'count'],
  ['bc', 'Behind', 'count'],
  ['2s', '2 strikes', 'count'],
]
export const SITUATIONAL_SIT_CODES = SITUATIONAL_CODES.map(([code]) => code).join(',')

export function situationalSplitsView(splits, group) {
  const byCode = {}
  for (const s of splits ?? []) {
    const code = s.split?.code
    if (code) byCode[code] = s.stat
  }
  const rows = SITUATIONAL_CODES.filter(([code]) => byCode[code]).map(
    ([code, label, family, sub]) => ({
      code,
      label,
      family,
      // True for a row contained by the one above it (RISP inside Runners on).
      sub: Boolean(sub),
      side: splitSide(byCode[code], group),
    }),
  )
  // A couple of stray rows (a September call-up who's barely pitched) read
  // as noise, not a table — require most of the set before rendering.
  if (rows.length < 4) return null
  const all = byCode.r0 && byCode.ron ? overallSide([byCode.r0, byCode.ron], group) : null
  return { rows, all }
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
