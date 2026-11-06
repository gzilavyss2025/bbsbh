// The "Kept it in the infield" page's data: every team-game since 2021 in which a
// club made no out to an outfielder (#2976). One static file per season,
// public/data/outfield-outs/{season}.json, written by scripts/gen-outfield-outs.mjs.
// Not a scoring surface, and the files hold no scores or winners (ADR-0034).
//
// A missing season (a new year before its first run) resolves to null and drops out.

import { staticJson } from '../staticJson.js'

export const FIRST_SEASON = 2021

const loaders = new Map()
function loaderFor(season) {
  if (!loaders.has(season)) {
    loaders.set(season, staticJson(`/data/outfield-outs/${season}.json`, { shape: (d) => d, fallback: null }))
  }
  return loaders.get(season)
}

export async function loadInfield(lastSeason = new Date().getFullYear()) {
  const seasons = []
  for (let s = FIRST_SEASON; s <= lastSeason; s++) seasons.push(s)
  return buildInfield(await Promise.all(seasons.map((s) => loaderFor(s)())))
}

// Season docs → the page's census and its seasons, newest first, each season's
// rows newest first. Pure, so the unit suite covers it.
export function buildInfield(docs) {
  const seasons = docs
    .filter((d) => d && Array.isArray(d.qualifiers))
    .map((d) => ({
      season: d.season,
      teamGames: d.teamGames ?? 0,
      nearMiss: d.nearMiss ?? 0,
      rows: [...d.qualifiers].sort((a, b) => (a.date === b.date ? b.gamePk - a.gamePk : a.date < b.date ? 1 : -1)),
    }))
    .sort((a, b) => b.season - a.season)
  const sum = (k) => seasons.reduce((n, s) => n + (k === 'rows' ? s.rows.length : s[k]), 0)
  return {
    seasons,
    qualifiers: sum('rows'),
    teamGames: sum('teamGames'),
    nearMiss: sum('nearMiss'),
    first: seasons.at(-1)?.season ?? null,
    last: seasons[0]?.season ?? null,
  }
}
