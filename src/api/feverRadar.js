// Fetching + pure selectors over Fever Baseball's breakout/fade prospect
// radar (public/data/fever-radar.json, gen-fever-radar.mjs). This is an
// OUTSIDE scouting opinion, not one of bbsbh's own callout families — see
// the generator's header and docs/callouts.md's worthiness rubric for why it
// stays out of that scoring table. RadarPill (src/components/RadarPill.jsx)
// is the only consumer, wired onto batting-order rows in TeamInfo.jsx; there
// is no MLB pitcher board, so it never appears on the opposing-pitcher card.

const SNAPSHOT_URL = '/data/fever-radar.json'
const EMPTY_SNAPSHOT = { generatedAt: null, dataThrough: null, source: null, attribution: null, boards: {} }

// Session-memoized, same pattern as fetchTopProspects (prospects.js).
// Degrades to an empty snapshot on any failure (404 before the first nightly
// run, network, malformed JSON) — callers never need their own try/catch.
let radarPromise = null
export function fetchFeverRadar() {
  if (!radarPromise) {
    radarPromise = fetch(SNAPSHOT_URL)
      .then((res) => (res.ok ? res.json() : EMPTY_SNAPSHOT))
      .catch(() => EMPTY_SNAPSHOT)
  }
  return radarPromise
}

// The MLB hitter boards, in the priority order a player should show as
// (breakout is the more actionable "watch him" signal; fade a distant
// second) — a player is never on both in the same snapshot.
const MLB_BATTER_BOARDS = ['mlb_breakout', 'mlb_fade']

// A player's radar entry for RadarPill, or null when he's on neither MLB
// board tonight (true for the overwhelming majority of any lineup — each
// board carries only a couple dozen names league-wide).
export function radarEntryFor(snapshot, playerId) {
  for (const board of MLB_BATTER_BOARDS) {
    const row = (snapshot?.boards?.[board] ?? []).find((p) => p.playerId === playerId)
    if (row) return { board, ...row }
  }
  return null
}
