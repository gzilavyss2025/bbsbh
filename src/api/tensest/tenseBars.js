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

// The words a screen reader hears for a meter: "Pressure 8 of 10, top 7% of the
// season". The rank comes from the bands the generator published (`cutoffs.pcts`,
// bar n starts at pcts[n-2]), so a change to the bands changes the words with it.
// Bars 1–4 name no rank: below the top 30% it says nothing worth hearing.
export function pressureLabel(bars, cutoffs) {
  if (!Number.isInteger(bars) || bars < 1 || bars > 10) return ''
  const top = pressureTop(bars, cutoffs)
  return `Pressure ${bars} of 10${top != null ? `, top ${top}% of the season` : ''}`
}

// The share of the season at or above this many bars, as the meter's caption
// shows it ("Top 7%"); null below bar 5 or without the bands.
export function pressureTop(bars, cutoffs) {
  const start = Number.isInteger(bars) && bars >= 5 && bars <= 10 ? cutoffs?.pcts?.[bars - 2] : null
  return typeof start === 'number' ? Math.round((100 - start) * 10) / 10 : null
}

// The season's cutoffs, from the small file gen-tensest.mjs writes beside
// tensest.json so a box score need not fetch the whole tensest board. Null
// before the file exists or on any failure: the caller then draws no meter.
export const loadCutoffs = staticJson('/data/tensest-cutoffs.json', {
  shape: (d) => (Array.isArray(d?.cutoffs?.li) ? d.cutoffs : null),
  fallback: null,
})
