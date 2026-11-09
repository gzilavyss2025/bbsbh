import { staticJson } from '../staticJson.js'

// How many of the tension meter's 10 bars a play lights: 1 plus the season edges
// (tensest.json `cutoffs.li`, from scripts/lib/tensest/cutoffs.mjs) its leverage
// index reaches. The cutoffs are season-wide and spoiler-free; the LI itself is not,
// so a caller passes only an LI its reveal has already let through (ADR-0001).
// No LI (a game's first play) or no cutoffs: null, so the caller draws no meter.
export function tenseBars(li, cutoffs) {
  const edges = cutoffs?.li
  if (typeof li !== 'number' || !Number.isFinite(li) || !edges?.length) return null
  return 1 + edges.filter((e) => li >= e).length
}

// The season's cutoffs, from the small file gen-tensest.mjs writes beside
// tensest.json so a box score need not fetch the whole tensest board. Null
// before the file exists or on any failure: the caller then draws no meter.
export const loadCutoffs = staticJson('/data/tensest-cutoffs.json', {
  shape: (d) => (Array.isArray(d?.cutoffs?.li) ? d.cutoffs : null),
  fallback: null,
})
