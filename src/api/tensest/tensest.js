// The Tensest Moments page's data: the season's tensest at-bats by MLB's own pressure
// score (leverage index), read from a static same-origin file
// (public/data/tensest.json) that scripts/gen-tensest.mjs keeps on the nightly cron.
//
// Cost-driven: the pressure of every at-bat lives in one winProbability feed per game,
// more than 2,400 games a season, so the generator reads each game once and keeps only
// every play at LI 4 or more, which the page ranks and slices (slices.js). Spoiler-free in the
// sense the rule means it: this page is not one of the four scoring surfaces, and a
// stat line is not a score (ADR-0034).
//
// Degrades to an empty board before the file exists or on any failure: the page shows
// a friendly empty state, not a broken page.

import { staticJson } from '../staticJson.js'

const EMPTY = { season: null, generatedAt: null, through: null, plays: [] }

export const loadTensest = staticJson('/data/tensest.json', {
  shape: (d) => ({
    season: d.season ?? null,
    generatedAt: d.generatedAt ?? null,
    through: d.through ?? null,
    // Every play at LI >= 4, tensest first; the page ranks and slices it (slices.js).
    plays: d.plays ?? [],
  }),
  fallback: EMPTY,
})

// A rank as a reader sees it: "T3" when another row in the list shares it.
export function rankLabel(row, rows) {
  const tied = rows.some((r) => r !== row && r.rank === row.rank)
  return `${tied ? 'T' : ''}${row.rank}`
}

// A postseason game is any game type but the regular season ('R').
export const isPostseason = (row) => row.gt !== 'R'
