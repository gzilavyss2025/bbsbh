// HOW OFTEN A MAN IS EXPOSED TO A CALL HE COULD ARGUE — the reader behind
// /abs-challenges's "How often is normal", from the static file
// scripts/gen-abs-challenges.mjs sweeps each night (--exposure).
//
// WHY THIS IS A SECOND FILE AND A SECOND READER. abs-challenges.json answers
// "who challenged and how often were they right". It cannot answer "how often
// is that", because a rate needs a denominator nobody publishes: how many
// pitches a hitter SAW and how many innings a catcher CAUGHT. Those come from
// a per-player roster sweep, they are 1,560 rows a level, and folding them into
// the season board would put 418 KB behind every figure on that page. So they
// ship beside it and the one section that needs them reads them here.
//
// SPOILER-FREE. Plate appearances, pitches seen and innings caught, over
// completed games, per player. None of it is a score and no game's result can
// be read back out of a season total.
//
// THE MEAN DESCRIBES NOBODY, which is the whole point of the section and the
// reason this module ships a DISTRIBUTION rather than two averages. Among MLB
// hitters clearing the floor the rate runs from about two per thousand pitches
// to about twelve, six of them never challenged all season, and one man called
// for 32 in 1,085. A page that printed 6.4 and stopped would have described a
// hitter who does not exist.

import { staticJson } from '../staticJson.js'

export const fetchAbsExposure = staticJson('/data/abs-exposure.json')

// MINIMUM SAMPLES. A hitter with forty plate appearances who challenged twice
// prints at a rate no full-season regular can reach, and a histogram built
// without a floor is a picture of small samples rather than of habits. Both
// floors are stated in the chart head they qualify rather than applied
// silently.
//
// THEY ARE MLB-TUNED AND USED AT BOTH LEVELS ANYWAY. Triple-A rosters churn, so
// the same floor admits a smaller share of that league's men — which is a
// statement about the league, not a distortion of it, and moving the floor per
// level would make the two boards incomparable on the one axis a reader wants
// to compare them on. The count that cleared it rides in the head at both
// levels.
export const MIN_PLATE_APPEARANCES = 200
export const MIN_CATCHER_INNINGS = 200

// THE TWO QUESTIONS, AND EVERY WAY THEY DIFFER, HELD AS DATA. A batter's
// exposure is pitches seen; a catcher's is innings caught, because NOTHING IN
// THE FEED COUNTS THE PITCHES A CATCHER RECEIVED. That makes the two rates
// different measurements which cannot be read across, and the page says so once
// rather than implying they can be by drawing them alike without a word.
//
// `step` is the histogram's bin width and it is a round number on purpose: a
// width derived from the data gives bins labelled 0.234 and a reader cannot
// hold those. `bins` caps the count so the last one absorbs the tail — one man
// at 29.5 per thousand would otherwise draw fifteen columns, thirteen of them
// empty.
export const EXPOSURE_KINDS = [
  {
    key: 'batter',
    label: 'Batters',
    // The same word written to sit mid-sentence, held rather than case-folded
    // at render for the reason `each` is (ADR-0017, check-name-casing.mjs).
    many: 'batters',
    calls: 'asBatter',
    rate: 'per1000Pitches',
    floorOn: 'plateAppearances',
    floor: MIN_PLATE_APPEARANCES,
    // The league baseline is read on plate appearances — "one every forty
    // times up" is the figure a reader can hold — while the DISTRIBUTION is
    // drawn per thousand pitches, which is the finer measure and the one that
    // separates a patient hitter from a free swinger.
    per: 'plateAppearances',
    unit: 'plate appearances',
    // The singular, held rather than stripped off `unit` at render: "innings
    // caught" does not lose an -s from its last word, and a component that
    // edits rendered words drifts from the caps invariant (ADR-0017).
    each: 'plate appearance',
    // The histogram's own axis: a different denominator from `per`, which is
    // exactly why both are named here rather than one being assumed from the
    // other.
    rateOn: 'pitches',
    ratePer: 1000,
    // `unit` names the FLOOR's denominator and `seen` names the RATE's, and on
    // a batter they are two different columns. A sentence that reached for
    // `unit` printed "32 in 1,085 plate appearances" over his PITCH count — the
    // same confusion in words that reading the rate off the wrong divisor makes
    // in arithmetic.
    seen: 'pitches seen',
    seenLabel: 'Pitches',
    // And the same denominator written to sit mid-sentence. Four word forms
    // for one column looks like a lot until a component tries to build one
    // from another and prints "1,085 plate appearances" over a pitch count.
    theirs: 'the pitches they see',
    scale: 'per 1,000 pitches seen',
    step: 2,
    bins: 9,
  },
  {
    key: 'catcher',
    label: 'Catchers',
    many: 'catchers',
    calls: 'asCatcher',
    rate: 'per9Caught',
    floorOn: 'catcherInnings',
    floor: MIN_CATCHER_INNINGS,
    per: 'catcherInnings',
    unit: 'innings caught',
    each: 'inning caught',
    // A catcher's two denominators are the same field, because no feed counts
    // the pitches he received. That is the caveat the page prints.
    rateOn: 'catcherInnings',
    ratePer: 9,
    seen: 'innings caught',
    seenLabel: 'Innings',
    theirs: 'the innings they catch',
    scale: 'per 9 innings caught',
    step: 0.2,
    bins: 8,
  },
]

export function exposureKind(key) {
  return EXPOSURE_KINDS.find((k) => k.key === key) ?? EXPOSURE_KINDS[0]
}

// The level's own rows, in LEVELS order with the season board. Null for a level
// the sweep has not reached, which the page draws nothing for.
export function exposureFor(data, level) {
  return data?.levels?.[level] ?? null
}

// THE LEAGUE FIGURE, OVER EVERY MAN AND NOT OVER THE QUALIFIERS. "A batter
// challenges once every forty plate appearances" is a fact about the league, so
// the floor that makes a HISTOGRAM readable has no business in it — dropping
// part-time hitters would quietly report the habits of regulars as the league's.
//
// `per` is the denominator between calls, which is the figure the page leads
// with; `rate` is the same fact on the histogram's own scale, so a reader can
// tie the slab to the chart under it.
export function leagueBaseline(level, key) {
  const kind = exposureKind(key)
  const rows = level?.players ?? []
  let calls = 0
  let denominator = 0
  let exposure = 0
  for (const p of rows) {
    calls += p[kind.calls] ?? 0
    denominator += p[kind.per] ?? 0
    exposure += p[kind.rateOn] ?? 0
  }
  if (calls === 0 || denominator === 0) return null
  return {
    key: kind.key,
    calls,
    denominator,
    per: denominator / calls,
    // The same multiplier the file's own per-player rates were divided on, so
    // the slab and the chart under it are one measurement read twice.
    rate: exposure > 0 ? (calls / exposure) * kind.ratePer : null,
  }
}

// A count of values into bins of a fixed width, the first edge floored onto a
// step boundary and the LAST BIN ABSORBING EVERYTHING ABOVE IT.
//
// Every bin carries its own `from`/`to` rather than only an index, which is
// what lets binPosition below map a value onto the chart through the same
// arithmetic the labels are drawn from. A histogram whose marks are placed by
// index and whose labels are written by hand drifts apart the first time the
// data moves — the median rule in the first draft of this section pointed at
// 5.11 under a label reading 5.90.
export function histogram(values, step, count) {
  if (!values?.length || !(step > 0) || !(count > 0)) return []
  const from = Math.floor(Math.min(...values) / step) * step
  const bins = Array.from({ length: count }, (_, i) => ({
    from: from + i * step,
    to: from + (i + 1) * step,
    last: i === count - 1,
    n: 0,
  }))
  for (const v of values) {
    const i = Math.min(count - 1, Math.max(0, Math.floor((v - from) / step)))
    bins[i].n += 1
  }
  return bins
}

// WHERE A VALUE SITS ALONG THE DRAWN COLUMNS, as a fraction of the plot's
// width. Derived from the value and the bin edges, never from an index a caller
// counted by hand — see histogram above for what that cost.
//
// The columns are drawn at equal widths and the labels are centred under them,
// so a value lands at the centre of its own bin plus however far through the
// bin it is: `(i + 0.5) / count`, which is the same mapping LineChart uses to
// put a point over its label. Clamped into the drawn range, because the last
// bin absorbs a tail that runs well past its own edge.
export function binPosition(value, bins) {
  if (value == null || !bins?.length) return null
  const step = bins[0].to - bins[0].from
  if (!(step > 0)) return null
  const raw = (value - bins[0].from) / step
  // Clamped to the DRAWN columns, so a value the last bin swept up lands on
  // that column rather than off the right-hand end of the plot: the last bin is
  // a catch-all and a position inside it means nothing anyway.
  const i = Math.max(0, Math.min(bins.length - 1, raw))
  return (i + 0.5) / bins.length
}

function quantile(sorted, q) {
  if (!sorted.length) return null
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

// ONE KIND'S DISTRIBUTION, as the section draws it: the men who cleared the
// floor, the shape of their rates, the middle eight in ten of them, and the two
// rules the chart carries.
//
// `never` is the men who cleared the floor and did not challenge once. They are
// IN the histogram, in its first bin, because a full season of chances taken
// none of the time is the most extreme habit on the board and dropping it would
// make the league look more uniform than it is.
//
// Null when nobody clears the floor, which is a board to draw nothing for
// rather than an empty one.
export function exposureBoard(level, key) {
  const kind = exposureKind(key)
  const qualified = (level?.players ?? []).filter(
    (p) => (p[kind.floorOn] ?? 0) >= kind.floor && p[kind.rate] != null,
  )
  if (qualified.length === 0) return null
  const rates = qualified.map((p) => p[kind.rate]).sort((a, b) => a - b)
  const bins = histogram(rates, kind.step, kind.bins)
  return {
    key: kind.key,
    kind,
    qualified: qualified.length,
    never: qualified.filter((p) => (p[kind.calls] ?? 0) === 0).length,
    bins,
    peak: bins.reduce((m, b) => (b.n > m ? b.n : m), 0),
    median: quantile(rates, 0.5),
    mean: rates.reduce((t, x) => t + x, 0) / rates.length,
    low: quantile(rates, 0.1),
    high: quantile(rates, 0.9),
    // The man at the top of the board, carried whole so a sentence can say what
    // his rate is made of: a rate on its own is not evidence of anything.
    leader: qualified.reduce((best, p) => (best && best[kind.rate] >= p[kind.rate] ? best : p), null),
  }
}

// ---------------------------------------------------------------------------
// THE PER-CLUB CUT — the team hub's challenge card, and a THIRD file.
// ---------------------------------------------------------------------------
//
// The list above is folded across clubs, which is right for a season floor and
// wrong for a club board: a man traded in July would be counted in full against
// whichever club holds him now. `abs-exposure-clubs.json` is the same sweep cut
// by `team_id` instead (scripts/lib/abs/export.mjs), 95 KB against the folded
// file's 418, fetched by ONE club's hub tab and by nothing else — ADR-0076
// applied a second time.
//
// It ships COUNTS AND DENOMINATORS AND NO RATES, because a rate prints as
// eleven significant figures and the arithmetic is one line. That line is
// `EXPOSURE_KINDS` above, so the card and the league board divide identically.

export const fetchAbsExposureClubs = staticJson('/data/abs-exposure-clubs.json')

// MLB only today. The file's level loop is the generator's, so a Triple-A
// board is a one-word change there and a null here until then.
export function clubRowsFor(data, teamId, level = 'MLB') {
  return data?.levels?.[level]?.byTeam?.[String(teamId)] ?? null
}

// One club's rate for one kind, over EVERY man on it who had a denominator —
// the same construction as the league figure, and deliberately not the
// floored population the board below draws. "This club challenges once every N
// times up" is a fact about the club, and a floor applied to it would report
// the habits of its regulars as the whole roster's.
function clubRate(rows, kind) {
  let calls = 0
  let exposure = 0
  for (const r of rows ?? []) {
    if (!((r[kind.rateOn] ?? 0) > 0)) continue
    calls += r[kind.calls] ?? 0
    exposure += r[kind.rateOn]
  }
  return exposure > 0 ? (calls / exposure) * kind.ratePer : null
}

// THE CARD, for one club and one kind.
//
// `rank` is among every club in the file, counted on the same rate — so the
// figure a reader sees and the figure they are ranked on cannot come apart.
// Ties share the better rank, the way every other board in this app does it.
//
// `players` is the men who clear the LEAGUE BOARD'S floor, reused rather than
// invented: a man with forty pitches who never argued is not a habit, and a
// card with its own private floor would be a second answer to a question the
// league page has already answered. The count that cleared it is printed.
//
// Null for a club the file has no rows for, which is every affiliate — the
// card then draws nothing, the way TeamRunValueCard does for a club Savant
// runs no board for.
export function clubChallengeBoard(data, teamId, key, level = 'MLB') {
  const kind = exposureKind(key)
  const mine = clubRowsFor(data, teamId, level)
  if (!mine) return null

  // Every club in the file, on the same rate, so the figure a reader sees and
  // the figure they are ranked on cannot come apart.
  const clubs = Object.values(data?.levels?.[level]?.byTeam ?? {})
  const rates = clubs.map((rows) => clubRate(rows, kind)).filter((r) => r != null)
  const rate = clubRate(mine, kind)
  const ahead = rate == null ? null : rates.filter((r) => r > rate).length

  // The league figure off the same file, so the card never fetches the 418 KB
  // league list to print the line its own dots are measured against.
  const league = clubRate(clubs.flat(), kind)

  const players = mine
    .filter((r) => (r[kind.floorOn] ?? 0) >= kind.floor && (r[kind.rateOn] ?? 0) > 0)
    .map((r) => ({
      playerId: r.playerId,
      name: r.name,
      exposure: r[kind.rateOn],
      calls: r[kind.calls] ?? 0,
      rate: ((r[kind.calls] ?? 0) / r[kind.rateOn]) * kind.ratePer,
    }))
    .sort((a, b) => b.exposure - a.exposure)

  return {
    key: kind.key,
    kind,
    rate,
    league,
    rank: ahead == null ? null : ahead + 1,
    of: rates.length,
    players,
    roster: mine.filter((r) => (r[kind.rateOn] ?? 0) > 0).length,
    // The one dot worth a direct label, and the count the sentence needs: a
    // club whose hitters nearly all sit under the league line is the card's
    // whole finding, and it has to be read off the drawn population.
    leader: players.reduce((best, p) => (best && best.rate >= p.rate ? best : p), null),
    below: league == null ? 0 : players.filter((p) => p.rate < league).length,
  }
}
