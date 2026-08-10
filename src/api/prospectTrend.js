// Fetching + pure selectors over bbsbh's own stats-based prospect signal
// (public/data/prospect-trend.json, gen-prospect-trend.mjs) — a
// level-relative OPS/ERA percentile, NOT a Major League Equivalency and not
// third-party (contrast feverRadar.js: that's an outside scouting opinion,
// this is bbsbh's own number computed straight from statsapi splits). Meant
// to complement the weekly-refreshed rank in prospects.js, not replace it.
// ProspectTrendPill (src/components/badges/ProspectTrendPill.jsx) is the
// only consumer, wired onto /prospects.

const SNAPSHOT_URL = '/data/prospect-trend.json'
const EMPTY_SNAPSHOT = { generatedAt: null, dataThrough: null, players: [] }

// Session-memoized, same pattern as fetchTopProspects (prospects.js) and
// fetchFeverRadar (feverRadar.js). Degrades to an empty snapshot on any
// failure (404 before the first nightly run, network, malformed JSON) — no
// caller needs its own try/catch.
let trendPromise = null
export function fetchProspectTrend() {
  if (!trendPromise) {
    trendPromise = fetch(SNAPSHOT_URL)
      .then((res) => (res.ok ? res.json() : EMPTY_SNAPSHOT))
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

// Buckets a percentile into the 1-5 rating ProspectTrendPill draws as a dot
// row — built by splitting standingLabel's own Bottom/Middle/Top bands in
// half rather than inventing a fresh set of edges, so the two stay in step:
// tier 3 is exactly the Middle band (41-59), and 1/2 and 4/5 split the Bottom
// and Top bands at their own midpoints (20 and 80). 1-2 mark him below his
// level's pack, 4-5 above it — ProspectTrendPill colors on that split, not on
// the tier number itself. Null mirrors standingLabel's own empty state.
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
