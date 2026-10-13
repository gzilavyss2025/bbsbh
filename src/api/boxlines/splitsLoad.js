// The Splits card's loaders for a season other than the current one, and for the career
// (#1910). Both return a raw splits array, [{ split: { code }, stat }], the shape
// `splitsView` and `situationalSplitsView` read, so a scope is a different array and no
// change to the views. MLB only, like the live card. Open surface (ADR-0034): full-season and
// career aggregates, no game result, no cutoff.
import { fetchPersonStats } from '../person-fetch.js'
import { fetchCareerSplits, mergeCareerSplits } from './careerSplits.js'
import { SITUATIONAL_SIT_CODES } from '../person/stats.js'

const CODES = `vl,vr,${SITUATIONAL_SIT_CODES}`

// One request: vs L/R and the situational set share one statSplits call, and both views pick
// their rows out by code.
export function loadSeasonSplits(personId, group, season) {
  return fetchPersonStats(personId, { type: 'statSplits', group, sitCodes: CODES, season })
}

// His career: scope 'R' is the regular season (one request), 'A' adds the postseason (two
// requests, R and P at once). The Postseason rows are merged per code from components
// (`mergeCareerSplits`); a code with no October row keeps its regular-season line.
export async function loadCareerSplits(personId, group, scope = 'R') {
  const [regular, post] = await Promise.all([
    fetchCareerSplits(personId, group, CODES.split(',')),
    scope === 'A' ? fetchCareerSplits(personId, group, CODES.split(','), 'P') : new Map(),
  ])
  // No regular season means that request failed (fetchCareerSplits says so with an empty Map): the
  // postseason alone is not a career.
  if (!regular.size) return []
  return [...new Set([...regular.keys(), ...post.keys()])].map((code) => ({
    split: { code },
    stat: mergeCareerSplits(regular.get(code), post.get(code), group),
  }))
}
