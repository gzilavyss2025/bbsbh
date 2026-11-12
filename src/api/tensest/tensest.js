// The Pressure Moments page's (/pressure-moments) data: the season's tensest at-bats by MLB's own pressure
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
import { roundTag } from '../../lib/postseason/roundTag.js'

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

// A postseason row's round and game, as a scorer writes it: "NLDS G1", "WS G7". '' for the
// regular season; the round alone when the file has no game number for it.
export function postseasonLabel(row) {
  if (!isPostseason(row)) return ''
  const round = roundTag(row.gt, row.aw, row.d)
  return row.sg ? `${round} G${row.sg}` : round
}

// The meter on this page only. The season meter (tenseBars.js) is full from LI 4.56, the top
// 1%, and every play here is past that, so it read full on every row (Gary, 2026-11-12).
// Here the 10 bars spread across the board's own range instead: one bar at the file's floor
// (LI 4), one more every 0.6, all ten at the feed's 9.99 cap. null for a missing LI.
const BOARD_FLOOR = 4
const BOARD_STEP = 0.6
export function boardBars(li) {
  if (typeof li !== 'number' || !Number.isFinite(li)) return null
  return Math.min(10, Math.max(1, 1 + Math.floor((li - BOARD_FLOOR + 1e-9) / BOARD_STEP)))
}
