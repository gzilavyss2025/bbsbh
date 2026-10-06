// Fetching + pure selectors over bbsbh's own stats-based prospect signal
// (public/data/prospect-trend.json, gen-prospect-trend.mjs) — a
// level-relative OPS/ERA percentile, NOT a Major League Equivalency and not
// third-party (it is bbsbh's own number computed straight from statsapi
// splits). Meant
// to complement the weekly-refreshed rank in prospects.js, not replace it.
// ProspectTrendPill (src/components/badges/ProspectTrendPill.jsx) is the
// only consumer, wired onto /prospects.

const SNAPSHOT_URL = '/data/prospect-trend.json'
const EMPTY_SNAPSHOT = { generatedAt: null, dataThrough: null, players: [] }

// The file on disk is packed (#1269) so the phone parses 0.65 MB, not 3.2: week
// dates once in `historyDates`, a history row as [dateIndex, sportId, percentile],
// `packed: 2` as version. A 4th item, `flags`, comes only when the row is not the
// usual case. The usual case is "qualified is percentile !== null" and
// "atLevel is true". flags is a bit set: 1 = qualified, 2 = atLevel (#1358).
// Version 1 had no atLevel, and its 4th item was the `qualified` boolean.
const QUALIFIED = 1
const AT_LEVEL = 2
export function packProspectTrend(snapshot) {
  const historyDates = [...new Set(snapshot.players.flatMap((p) => p.history.map((h) => h.date)))].sort()
  const index = new Map(historyDates.map((date, i) => [date, i]))
  const players = snapshot.players.map((p) => ({
    ...p,
    history: p.history.map((h) => {
      const row = [index.get(h.date), h.sportId, h.percentile]
      if (h.qualified === (h.percentile !== null) && h.atLevel === true) return row
      return [...row, (h.qualified ? QUALIFIED : 0) | (h.atLevel === true ? AT_LEVEL : 0)]
    }),
  }))
  return { ...snapshot, packed: 2, historyDates, players }
}

// Version 1 rows carry no atLevel, so each one unpacks as atLevel: false. The
// chart then drops it: a row with no proof that it read one level is not drawn
// (deriveTrendMarks). The next nightly run writes version 2.
function unpackRow(version, [i, sportId, percentile, extra], historyDates) {
  const usual = percentile !== null
  if (version === 1) {
    return { date: historyDates[i], sportId, percentile, qualified: extra ?? usual, atLevel: false }
  }
  return {
    date: historyDates[i],
    sportId,
    percentile,
    qualified: extra == null ? usual : (extra & QUALIFIED) !== 0,
    atLevel: extra == null ? true : (extra & AT_LEVEL) !== 0,
  }
}

export function unpackProspectTrend(raw) {
  // Old shape passes through (#1269): drop this line once a nightly run has
  // written the packed shape. Until then a deploy and a nightly run work in either order.
  if (raw?.packed !== 1 && raw?.packed !== 2) return raw
  const { historyDates, players, packed, ...rest } = raw
  return {
    ...rest,
    players: players.map((p) => ({
      ...p,
      history: p.history.map((row) => unpackRow(packed, row, historyDates)),
    })),
  }
}

// Session-memoized, same pattern as fetchTopProspects (prospects.js). Degrades to an empty snapshot on any
// failure (404 before the first nightly run, network, malformed JSON) — no
// caller needs its own try/catch.
let trendPromise = null
export function fetchProspectTrend() {
  if (!trendPromise) {
    trendPromise = fetch(SNAPSHOT_URL)
      .then((res) => (res.ok ? res.json().then(unpackProspectTrend) : EMPTY_SNAPSHOT))
      .catch(() => EMPTY_SNAPSHOT)
  }
  return trendPromise
}

// A player's trend row, or null when he has no current-level line (not a
// prospect in the source snapshot, or a two-way edge case gen-prospect-trend
// couldn't attribute to one group).
export function prospectTrendById(snapshot, playerId) {
  return (snapshot?.players ?? []).find((p) => p.playerId === playerId) ?? null
}

// The band edges for standingLabel. Everything from 41 through 59 reads
// "Middle" rather than a printed "Top 43%" / "Bottom 47%", both of which are
// true and neither of which means anything — a player one point either side of
// the median is not doing two different things, and a column full of near-50
// figures reads as precision the underlying sample cannot support.
const TOP_FROM = 60
const BOTTOM_TO = 40

// Buckets a percentile into the five standing bands used by the board filter
// and the Prospect Card — built by splitting standingLabel's own
// Bottom/Middle/Top bands in
// half rather than inventing a fresh set of edges, so the two stay in step:
// tier 3 is exactly the Middle band (41-59), and 1/2 and 4/5 split the Bottom
// and Top bands at their own midpoints (20 and 80). 1-2 mark him below his
// level's pack, 4-5 above it. Null mirrors standingLabel's own empty state.
export function levelTier(percentile) {
  if (!Number.isFinite(percentile)) return null
  if (percentile <= BOTTOM_TO) return percentile <= 20 ? 1 : 2
  if (percentile >= TOP_FROM) return percentile >= 80 ? 5 : 4
  return 3
}

// The stat each group is ranked on. It is printed in EVERY cell, not defined
// once in a caption under the table: the column has to say what it measures on
// its own, and this column measures two different things depending on the row.
const METRIC = { hitting: 'OPS', pitching: 'ERA' }

// A percentile said the way a broadcast says it, with the stat it is about.
// The /prospects cell used to print the raw ordinal ("93rd"), which asked a
// reader to know that an ordinal in this column meant a percentile and not a
// rank — with an actual rank column two cells to its left — then which end was
// the good one, and then what stat it was even about.
//
//   93, hitting  -> "Top 7% OPS"
//   54, hitting  -> "Middle OPS"
//   12, pitching -> "Bottom 12% ERA"
//
// Under the "vs. Level" head, each of those is a complete sentence: this stat,
// this standing, against everyone else at his level. Higher is always better —
// percentileRank (scripts/lib/prospectPercentile.mjs) already inverts ERA — so
// "Top 2% ERA" means the ERA is among the level's best, which is also how a fan
// would hear it.
//
// Null for a percentile that isn't a number, which the caller renders as its
// own "Too early" empty state.
export function standingLabel(percentile, group) {
  if (!Number.isFinite(percentile)) return null
  const metric = METRIC[group]
  const band =
    percentile >= TOP_FROM
      ? `Top ${100 - percentile}%`
      : percentile <= BOTTOM_TO
        ? `Bottom ${percentile}%`
        : 'Middle'
  return metric ? `${band} ${metric}` : band
}

// One user-facing vocabulary for the five level-relative standing bands. The
// board, filter, and Prospect Card all read these labels from this map.
const TIER_LABELS = {
  1: 'Bottom',
  2: 'Below',
  3: 'Middle',
  4: 'Above',
  5: 'Top',
}
export function tierLabel(tier) {
  return TIER_LABELS[tier] ?? null
}

export const LEVEL_STANDING_BANDS = ['All', ...Object.values(TIER_LABELS)]

// Sample-size honesty for every level-relative standing: the same
// qualification floor (40 PA / 30 IP-outs, scripts/lib/prospectPercentile.mjs
// — mirrored here rather than imported, same cross-boundary-constant
// convention prospects.js's rate3/num2 already use, since scripts/ isn't part
// of the client bundle) gates whether a percentile exists at all; THIS scales
// how much confidence the sample supports once a percentile exists. The UI
// states this in text; marker fill does not carry a second meaning.
export const QUALIFICATION_FLOOR = { hitting: 40, pitching: 30 }
export function confidenceState(sampleSize, group) {
  const floor = QUALIFICATION_FLOOR[group]
  if (!floor || !Number.isFinite(sampleSize) || sampleSize < floor) return null
  if (sampleSize < floor * 1.5) return 'early'
  if (sampleSize < floor * 3) return 'building'
  return 'established'
}

export function confidenceLabel(confidence) {
  if (confidence === 'early') return 'Early sample'
  if (confidence === 'building') return 'Building sample'
  if (confidence === 'established') return 'Established sample'
  return null
}

// A percentile can move by a point or two after one game. Both prospect
// surfaces call moves below five points steady, so the board and card cannot
// make different claims from the same snapshot.
export const MOVEMENT_FLOOR = 5
export function movementState(movement) {
  if (!Number.isFinite(movement?.delta)) return null
  if (Math.abs(movement.delta) < MOVEMENT_FLOOR) {
    return { direction: 'steady', amount: Math.abs(movement.delta), sinceDate: movement.sinceDate ?? null }
  }
  return {
    direction: movement.delta > 0 ? 'up' : 'down',
    amount: Math.abs(movement.delta),
    sinceDate: movement.sinceDate ?? null,
  }
}

// A birth date as decimal years at `asOf` — the ONE age formula behind the
// Prospect Card's age fact. The level average (prospectAgeBenchmark.mjs) and
// the player page both use it; the page passes the snapshot's `generatedAt`
// as `asOf`, so both read one clock. statsapi's whole-year `currentAge` biased
// the gap by up to a year (#1278). Null for a missing or bad date or clock.
const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000
export function decimalAge(birthDate, asOf) {
  if (!birthDate || asOf == null) return null
  const years = (new Date(asOf).getTime() - new Date(birthDate).getTime()) / MS_PER_YEAR
  return Number.isFinite(years) ? years : null
}

// The Prospect Card's age-vs-level fact: how many years younger/older a
// player is than the average QUALIFIED player at his level
// (gen-prospect-trend.mjs's `levelAverageAge`, itself a real birthDate
// average, not an estimate); `ageYears` must be a decimal (decimalAge).
// Renders only past a 1-year edge — a 0.3-year gap is noise, not a fact worth
// a row, same "don't print false precision" stance standingLabel's own Middle
// band already takes.
const AGE_EDGE_FLOOR_YEARS = 1.0
export function ageEdgeFact(ageYears, levelAverageAge) {
  if (!Number.isFinite(ageYears) || !Number.isFinite(levelAverageAge)) return null
  const delta = levelAverageAge - ageYears
  if (Math.abs(delta) < AGE_EDGE_FLOOR_YEARS) return null
  return { years: Math.round(Math.abs(delta) * 10) / 10, direction: delta > 0 ? 'younger' : 'older' }
}

// The Prospect Card's whole view model, assembled from one player's trend
// `entry` (prospectTrendById) plus the facts it can't carry on its own (his
// real age and his level's average, and — see docs/level-tenure-benchmark.md —
// how his current sample compares with a typical STAY at this level, not
// just how he's performing in it) — pure, so
// the component only ever renders what this returns rather than re-deriving
// any of it inline. `tenure` is the caller's own `tenureFact` result
// (src/api/levelTenure.js) or null; passed through untouched since it's
// already a plain view object.
//
//   'none'        — no trend row at all (entry == null): off the board,
//                    complex ball, or a fresh promotion the generator hasn't
//                    caught up to yet. The caller still shows an age-edge fact
//                    if one exists — partial information beats an all-or-
//                    nothing blank — but nothing else. No tenure fact either:
//                    it needs entry.sampleSize, the same count the "Building
//                    sample" line already prints, so the two numbers can never
//                    disagree.
//   'unqualified'  — a real row, under the PA/outs floor. Says why, with the
//                    real count and the real floor, not just "not yet." This
//                    is exactly where a tenure fact earns its place — it
//                    explains WHY the sample is still small.
//   'qualified'    — the full card: standing, tier, confidence, movement,
//                    trend series, plus tenure.
export function prospectCardView(entry, ageYears, levelAverageAge, tenure = null) {
  const ageEdge = ageEdgeFact(ageYears, levelAverageAge)
  if (!entry) return { state: 'none', ageEdge }
  if (!entry.qualified) {
    return {
      state: 'unqualified',
      metric: METRIC[entry.group],
      sampleSize: entry.sampleSize,
      floor: QUALIFICATION_FLOOR[entry.group],
      ageEdge,
      tenure,
    }
  }
  const tier = levelTier(entry.percentile)
  return {
    state: 'qualified',
    percentile: entry.percentile,
    metric: METRIC[entry.group],
    standing: standingLabel(entry.percentile, entry.group),
    tier,
    tierLabel: tierLabel(tier),
    confidence: confidenceState(entry.sampleSize, entry.group),
    sampleSize: entry.sampleSize,
    floor: QUALIFICATION_FLOOR[entry.group],
    populationSize: entry.populationSize,
    movement: entry.movement,
    ageEdge,
    tenure,
    trend: deriveTrendMarks(entry.history),
  }
}

// The Prospect Card for one player, as both player-page loaders build it
// (src/api/player/analytics.js and overview.js). `snapshot` is the trend file,
// `entry` his row in it (or null), `liveSportId` the level of his live team.
// Returns the card's view and `sportId`, the level the card names.
//
// The percentile, population and tenure come from `entry.sportId`, so the
// level label and the level-average age come from it too. The live team can be
// at another level: a fall or winter club, or a promotion the nightly run has
// not read yet. Core Jackson's card said "640 qualified WINTER hitters" for
// the AA population (#1359). With no trend row, the live level is all there
// is; with neither, null, and the caller prints no level.
export function prospectCardFor(snapshot, entry, birthDate, liveSportId, tenure = null) {
  const sportId = entry?.sportId ?? liveSportId ?? null
  const view = prospectCardView(
    entry,
    decimalAge(birthDate, snapshot?.generatedAt),
    snapshot?.levelAverageAge?.[sportId] ?? null,
    tenure,
  )
  return { view, sportId }
}

// Turns a player's full `history` (gen-prospect-trend.mjs's export, oldest
// first: { date, sportId, percentile, qualified, atLevel }) into what the Prospect
// Card's expanded Trend panel draws — chart points, and the level-change
// events worth a marker on the axis. Pure: no chart math (that's the
// component's job), just the two derived facts a raw history array doesn't
// hand over directly.
//
// A week the player didn't qualify contributes a point with `percentile:
// null` rather than being dropped — the caller draws a gap there (a dashed
// connector, never an interpolated or fabricated value), same "omit under the
// sample floor" rule PercentileStrip/ADR-0040 already established for a
// single strip row, applied here across a time axis instead.
//
// A row without `atLevel: true` is dropped, not drawn as a gap. Before #1279
// each row summed his season over every level; the rows after it read one
// level. Joined as one line, the change of method read as a change in play
// (Josue Briceño, AAA: 80, 80, then 8 — #1358). A gap would still join them
// with a dashed connector, so the old rows leave the series. A level change
// across them has no point to stand on, so it is not a marker either.
export function deriveTrendMarks(rawHistory) {
  const history = (rawHistory ?? []).filter((h) => h.atLevel === true)
  if (!history.length) return { points: [], promotions: [] }
  const points = history.map((h) => ({ date: h.date, percentile: h.qualified ? h.percentile : null }))
  const promotions = []
  for (let i = 1; i < history.length; i++) {
    const from = history[i - 1].sportId
    const to = history[i].sportId
    if (to != null && from != null && to !== from) {
      // Level numbering runs opposite to level rank (AAA=11 down to A=14,
      // src/lib/teams.js's SPORT_IDS) — a LOWER sportId is a HIGHER level, so
      // a promotion is a decrease.
      promotions.push({ date: history[i].date, fromSportId: from, toSportId: to, direction: to < from ? 'up' : 'down' })
    }
  }
  return { points, promotions }
}
