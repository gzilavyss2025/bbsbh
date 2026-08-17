// THE FARM INDEX — one number for "how good is this organisation's farm
// system", built from the facts scripts/gen-farm-system.mjs ships. Behind
// /farm ("The Farm Report", src/screens/reports/FarmSystemPage.jsx).
//
// The research pass behind every constant in this file is written up in
// docs/farm-index.md. The short version, because the numbers below are
// meaningless without it:
//
// 1. PROSPECT VALUE IS NOT LINEAR IN RANK. FanGraphs' prospect valuation work
//    puts a 70-FV prospect (roughly a top-five name) at $150–200M of surplus
//    value, a 60-FV pitcher at $60–78M, a 45-FV position player at ~$16M, and
//    a 40 FV at $3–7M. Mapped onto ordinal rank, that is an exponential decay,
//    not a straight line: the No. 1 prospect in baseball is worth something
//    like twelve No. 100s, and a system of six ranked-in-the-90s names is not
//    a better system than one holding the best player in the minors.
//    RANK_DECAY below is fitted to that spread — value(1) = 100, value(100) =
//    8, decaying smoothly between.
//
// 2. AFFILIATE WON-LOST RECORDS ARE A REAL BUT WEAK SIGNAL. The one public
//    study to regress farm-system rankings against system-wide minor-league
//    winning percentage found R² ≈ 0.11 — a gentle positive relationship
//    inside very noisy data. Affiliate rosters carry organisational filler,
//    repeat-level veterans and rehabbers, and a club that promotes
//    aggressively strips its own Triple-A team. So winning is worth having in
//    the index and is worth nothing like half of it. It is 25%.
//
// 3. THE LADDER IS NOT FLAT. A Triple-A club is one phone call from the major
//    league roster and a Single-A club is three years away, so the four
//    affiliates' records are weighted by proximity (LEVEL_WEIGHTS) rather than
//    averaged.
//
// 4. AGE IS THE CHEAPEST FORECAST IN THE MINORS. Two prospects ranked
//    identically are not identical if one is 19 and the other 24; the
//    19-year-old has more development runway and, historically, more of the
//    outcomes that matter. That is the third pillar, and it is deliberately
//    the smallest — it is a modifier on talent already counted, not talent.
//
// WHAT THIS INDEX IS NOT. It is not a scouting report. It sees ordinal ranks,
// not tools; it cannot see a system's pitching depth outside the Top 100, the
// international class it just signed, or the arm that blew out in June. The
// page says all of that in its own words, and the pillar weights are exposed
// as presets so a reader who disagrees can re-run it their way — which is the
// honest form for a composite whose weights are a judgement call.
//
// SPOILER-FREE. Minor-league season records and published prospect rankings
// are aggregates over completed games in another league (ADR-0034: a stat line
// is not a score). Nothing here touches tonight's game.

import { staticJson } from '../staticJson.js'

export const fetchFarmSystem = staticJson('/data/farm-system.json')

// value(rank) on a 100-point scale. Fitted to the FanGraphs surplus-value
// spread in note (1): the top name scores 100 and the hundredth scores ~8, so
// k = ln(100/8) / 99. A prospect ranked outside the pool scores 0 rather than
// a small positive — the list this joins against IS the definition of "ranked",
// and inventing value for names it does not carry would be inventing data.
const RANK_DECAY = Math.log(100 / 8) / 99

export function rankValue(rank) {
  if (!Number.isFinite(rank) || rank < 1) return 0
  return 100 * Math.exp(-RANK_DECAY * (rank - 1))
}

// Proximity weights on the four full-season affiliates. They sum to 1, and the
// gap between them is the point: Triple-A winning is three times the evidence
// Single-A winning is, because three times as much of it is about players who
// will be on a major league field inside two years.
export const LEVEL_WEIGHTS = { 11: 0.4, 12: 0.3, 13: 0.18, 14: 0.12 }

// The age at which a ranked prospect is neither young nor old for the list.
// The Top 100's own centre of mass sits close to 21; a name younger than that
// scores above the midpoint of the youth pillar and an older one below.
const AGE_PIVOT = 21
// One year of age moves the youth pillar by this much on its own 0–100 scale.
// Twelve points a year puts the realistic 18-to-25 range across most of the
// scale without letting a single 25-year-old bottom out a whole system.
const AGE_POINTS_PER_YEAR = 12

// The three pillars, their weights, and the words the page prints for each.
// Exported as data rather than hard-coded in the page so the caption, the
// legend and the arithmetic can never drift apart.
export const PILLARS = [
  {
    key: 'capital',
    label: 'Talent',
    weight: 0.6,
    blurb: 'Ranked prospects held, on an exponential value curve — the No. 1 name is worth twelve No. 100s.',
  },
  {
    key: 'production',
    label: 'Winning',
    weight: 0.25,
    blurb: 'The four full-season affiliates’ records, weighted by how close each level is to the majors.',
  },
  {
    key: 'youth',
    label: 'Youth',
    weight: 0.15,
    blurb: 'How young that talent is for its ranking — runway, not readiness.',
  },
]

// Alternative weightings a reader can run the board under. The point is not
// that one of these is right: it is that the ORDER of the league changes when
// the weights do, and a composite that hides that is selling a judgement call
// as a measurement.
export const WEIGHT_PRESETS = [
  { key: 'balanced', label: 'Balanced', weights: { capital: 0.6, production: 0.25, youth: 0.15 } },
  { key: 'talent', label: 'Talent only', weights: { capital: 1, production: 0, youth: 0 } },
  { key: 'scoreboard', label: 'Scoreboard', weights: { capital: 0.2, production: 0.8, youth: 0 } },
  { key: 'upside', label: 'Upside', weights: { capital: 0.45, production: 0.1, youth: 0.45 } },
]

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// ---- pillar math, one organisation at a time ----

// Raw prospect capital: the summed value curve over every ranked name the org
// holds. Unbounded and unscaled — scaleTo100 turns the league's spread into a
// 0–100 pillar once every org has been measured.
export function capitalOf(org) {
  return (org?.prospects ?? []).reduce((sum, p) => sum + rankValue(p.rank), 0)
}

// Level-weighted winning percentage across the affiliates that have played.
// The weights are RENORMALISED over the levels actually present, so an org
// whose Single-A club has no record on file is not quietly scored as if that
// club went 0-for-the-season.
export function productionOf(org) {
  let weighted = 0
  let weight = 0
  for (const a of org?.affiliates ?? []) {
    const games = (a.w ?? 0) + (a.l ?? 0)
    const w = LEVEL_WEIGHTS[a.sportId]
    if (!games || !w) continue
    weighted += w * (a.w / games)
    weight += w
  }
  return weight ? weighted / weight : null
}

// Youth, 0–100, weighted by each prospect's own value — a 19-year-old at No. 1
// should move this far more than a 24-year-old at No. 96. Null for an org with
// no ranked prospect carrying an age, which scaleTo100 then fills with the
// league midpoint rather than a zero the org did not earn.
export function youthOf(org) {
  let weighted = 0
  let weight = 0
  for (const p of org?.prospects ?? []) {
    if (p.age == null) continue
    const v = rankValue(p.rank)
    weighted += v * p.age
    weight += v
  }
  if (!weight) return null
  const age = weighted / weight
  return clamp(50 + (AGE_PIVOT - age) * AGE_POINTS_PER_YEAR, 0, 100)
}

// Rescale a league's raw pillar values onto 0–100, worst org at 0 and best at
// 100. MIN-MAX RATHER THAN A PERCENTILE, deliberately: percentiles would space
// thirty orgs evenly apart and hide the thing this index is for — that the top
// two or three systems are not marginally ahead of the field, they are a
// different distance from it. A null (an org that could not be measured on
// this pillar) becomes the midpoint.
export function scaleTo100(values) {
  const usable = values.filter((v) => v != null)
  if (!usable.length) return values.map(() => 50)
  const lo = Math.min(...usable)
  const hi = Math.max(...usable)
  // Every org identical on this pillar: nobody is ahead, so nobody is scored
  // ahead. Flat 50 rather than a flat 100 that would read as thirty perfect
  // systems.
  if (hi === lo) return values.map(() => 50)
  return values.map((v) => (v == null ? 50 : ((v - lo) / (hi - lo)) * 100))
}

// ---- the board ----

// Every organisation, scored and ranked, under one set of weights.
// `weights` is a { capital, production, youth } map — one of WEIGHT_PRESETS'
// or anything else summing to whatever the caller likes (the total is
// normalised, so a caller passing 60/25/15 and one passing 6/2.5/1.5 get the
// same board).
export function farmBoard(data, weights = WEIGHT_PRESETS[0].weights) {
  const entries = Object.entries(data?.orgs ?? {})
  if (!entries.length) return null

  const raw = entries.map(([orgId, org]) => ({
    orgId: Number(orgId),
    org,
    capitalRaw: capitalOf(org),
    productionRaw: productionOf(org),
    youthRaw: youthOf(org),
  }))

  const capital = scaleTo100(raw.map((r) => r.capitalRaw))
  const production = scaleTo100(raw.map((r) => r.productionRaw))
  const youth = scaleTo100(raw.map((r) => r.youthRaw))

  const total = (weights.capital ?? 0) + (weights.production ?? 0) + (weights.youth ?? 0)
  const norm = total > 0 ? total : 1

  const scored = raw.map((r, i) => {
    const pillars = { capital: capital[i], production: production[i], youth: youth[i] }
    const index =
      (pillars.capital * (weights.capital ?? 0) +
        pillars.production * (weights.production ?? 0) +
        pillars.youth * (weights.youth ?? 0)) /
      norm
    const played = r.org.affiliates.reduce(
      (acc, a) => ({ w: acc.w + (a.w ?? 0), l: acc.l + (a.l ?? 0) }),
      { w: 0, l: 0 },
    )
    return {
      orgId: r.orgId,
      index: Math.round(index * 10) / 10,
      pillars: {
        capital: Math.round(pillars.capital),
        production: Math.round(pillars.production),
        youth: Math.round(pillars.youth),
      },
      capitalRaw: Math.round(r.capitalRaw * 10) / 10,
      // The system's combined won-lost record across all four affiliates —
      // printed as a plain record beside the weighted pillar, because a reader
      // wants to see the games as well as the score they became.
      record: played,
      pct: played.w + played.l ? played.w / (played.w + played.l) : null,
      affiliates: r.org.affiliates,
      prospects: r.org.prospects,
      // The best rank the org holds, which is what a farm system is usually
      // argued about in one word.
      topRank: r.org.prospects.length ? Math.min(...r.org.prospects.map((p) => p.rank)) : null,
    }
  })

  scored.sort((a, b) => b.index - a.index)
  return scored.map((row, i) => ({ ...row, rank: i + 1 }))
}

// Pearson correlation between two pillars across the board, and its square.
// The page prints THIS — measured on the data in front of the reader — beside
// the published R² ≈ 0.11 that set the winning pillar's weight, because a
// stated caveat a page can check on its own numbers is worth more than one it
// only cites. Null when there is not enough spread to correlate.
export function correlate(board, a = 'capital', b = 'production') {
  const xs = (board ?? []).map((r) => r.pillars[a])
  const ys = (board ?? []).map((r) => r.pillars[b])
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  if (dx === 0 || dy === 0) return null
  const r = num / Math.sqrt(dx * dy)
  return { r: Math.round(r * 1000) / 1000, r2: Math.round(r * r * 1000) / 1000 }
}
