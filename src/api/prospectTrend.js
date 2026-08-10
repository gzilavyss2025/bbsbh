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
