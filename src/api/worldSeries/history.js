// Static world-series/series.json: every finished World Series, one row per game
// (contract in .scratch/world-series-callouts/contract.md). Null until the
// generator has written it. Callers MUST read it through lib/worldSeries/lastBefore.js
// with the game's own date (ADR-0087).
import { staticJson } from '../staticJson.js'

export const loadSeriesHistory = staticJson('/data/world-series/series.json', {
  shape: (d) => (Array.isArray(d?.series) ? d : null),
  fallback: null,
})
