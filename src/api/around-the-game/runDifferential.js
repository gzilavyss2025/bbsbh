// The reader behind /run-differential — "the run differential report".
//
// SPOILER-FREE, on the same footing as around-the-game/doubleheaders.js. Every
// figure here is a season aggregate over finished games, plus completed
// postseason series from seasons that are over. Nothing in this module can name
// what happened in any one game, and the page it feeds prints records, run
// totals and series lines, never a score. The one season still being played
// carries no postseason line at all, because its generator counts only games
// that have a winner (scripts/gen-run-differential.mjs).
//
// THE GENERATOR SHIPS CLUB SEASONS; THE GROUPING LIVES HERE.
// public/data/run-differential.json holds one row per club season over the cut,
// and per-season denominators — nothing per era. Every number the page prints
// about an era is folded from those rows HERE, because the page's threshold
// control changes all of them. A generator that precomputed era totals would
// have to precompute them once per threshold, and the control would be a page
// reload.
//
// AN ERA IS A BRACKET DEPTH, NOT A DATE RANGE. The page's whole argument is
// that a deeper bracket is harder to survive, so the grouping has to be the
// depth itself. Grouping by decade would put 1994 (no postseason) next to 1993
// (two rounds) and split 1995–2011 down the middle. Depth comes off each
// season's own record, so 1981's extra round files itself correctly without a
// rule, and each group's SPAN is printed back as the ranges its seasons
// actually occupy — "1981, 1995–2011", gap and all.

import { staticJson } from '../staticJson.js'

export const fetchRunDifferential = staticJson('/data/run-differential.json', { fallback: null })

// What the threshold control offers. +200 is the question people ask, so the
// page opens there; the rest bracket it closely enough that each step visibly
// moves the board. The floor the file was built at clamps the low end
// (`data.floor`), so a control step can never point past the end of the data.
export const THRESHOLDS = [150, 175, 200, 250, 300]
export const DEFAULT_THRESHOLD = 200

// A bucket key per season, and what it is called. The first and last are not
// depths at all — they are the two states a depth cannot describe.
const NO_POSTSEASON = 'none'
const IN_PROGRESS = 'now'

const ERA_ORDER = [NO_POSTSEASON, '1', '2', '3', '4', IN_PROGRESS]

// The names carry the ARGUMENT, so they say what each era added rather than
// naming its years — the years are printed beside them, derived.
const ERA_LABEL = {
  [NO_POSTSEASON]: 'No postseason at all',
  1: 'The World Series only',
  2: 'Plus the Championship Series',
  3: 'Plus the Division Series',
  4: 'Plus the Wild Card round',
  [IN_PROGRESS]: 'Being played now',
}

// How many series a club had to win to be champion. Printed as the era's cost,
// and it is the one number the page's whole point turns on. An era with no
// postseason costs nothing; the season being played has not set its price yet.
const ERA_ROUNDS = {
  [NO_POSTSEASON]: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  [IN_PROGRESS]: null,
}

function eraKey(season) {
  if (!season.held) return NO_POSTSEASON
  if (!season.complete) return IN_PROGRESS
  return String(season.rounds)
}

// A club's differential stretched to a 162-game season — the same arithmetic
// the generator filters on, repeated here because the page prints it per row.
export function per162(row) {
  const played = row.w + row.l
  if (!played) return 0
  return Math.round((row.diff * 162) / played)
}

// A list of seasons written back as the ranges it occupies: [1981, 1995, 1996]
// becomes "1981, 1995–1996". The Division Series era really is discontinuous
// (1981's split season, then 1995 onward) and 1994 really is a hole in the
// middle of the Championship Series era, so a plain first–last would print two
// spans that never happened.
export function seasonSpan(seasons) {
  const sorted = [...seasons].sort((a, b) => a - b)
  const ranges = []
  for (const season of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && season === last.to + 1) last.to = season
    else ranges.push({ from: season, to: season })
  }
  return ranges.map((r) => (r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`)).join(', ')
}

// What became of one club season. Six outcomes, and the three that look alike
// on a bare row are exactly the three the page has to keep apart:
// `none` (no postseason was played that year), `pending` (this season's is
// still to come) and `missed` (there was one and the club was not in it).
export function outcomeOf(row, season) {
  // The season's own flags answer the first two, because the generator writes
  // no postseason line at all for either case — it ships a season's bracket
  // only once the whole bracket is over, the same policy the bracket page
  // uses. A row alone cannot tell "there was none" from "not yet".
  if (season && !season.held) return 'none'
  if (season && !season.complete) return 'pending'
  if (!row.postseason) return 'none'
  if (!row.postseason.made) return 'missed'
  if (row.postseason.ring) return 'ring'
  if (row.postseason.reachedWS) return 'lostWS'
  // A club that played one series and lost it went out at the first hurdle,
  // whatever that hurdle was called in its era. Counting by round NAME instead
  // would file a 1997 Wild Card exit and a 1980 Championship Series exit as
  // different things when they are the same thing: one series, then home.
  if (row.postseason.rounds.length === 1) return 'firstExit'
  return 'lostLater'
}

// The round a club went out in, as the page prints it — the last series it
// played, or null for the three outcomes that have no such series.
export function exitRound(row) {
  const rounds = row.postseason?.rounds ?? []
  return rounds.length ? rounds[rounds.length - 1] : null
}

const COUNTED = ['ring', 'lostWS', 'lostLater', 'firstExit', 'missed']

function emptyTally() {
  return { ring: 0, lostWS: 0, lostLater: 0, firstExit: 0, missed: 0, none: 0, pending: 0 }
}

// The board. One pass over the rows at the chosen threshold, folded into the
// three things the page shows: the list itself, the per-era table, and the
// headline totals.
//
// TWO COUNTS PER ERA, not one. `over` counts clubs that cleared the bar as the
// season was actually played; `overPer162` counts the same bar after every
// season is stretched to 162 games. They differ most where they matter most —
// 1901-1960 played 140 to 154 games, so its raw count understates the era, and
// 2020 played 60, so its raw count reports nobody at all.
export function buildReport(data, threshold = DEFAULT_THRESHOLD) {
  const seasons = data?.seasons ?? {}
  const all = data?.rows ?? []

  // SORTED HERE, not trusted from the file. The generator does write its rows
  // widest first, and the board's own caption says "widest first" — so the
  // order is a claim the page makes, and it belongs with the code that makes
  // it rather than resting on a convention two files away. The season breaks
  // ties, so two clubs at the same margin read oldest first instead of in
  // whatever order the fold happened to reach them.
  const rows = all
    .filter((r) => r.diff >= threshold)
    .slice()
    .sort((a, b) => b.diff - a.diff || a.season - b.season)
    .map((r) => {
      const season = seasons[r.season]
      return {
        ...r,
        per162: per162(r),
        outcome: outcomeOf(r, season),
        exit: exitRound(r),
        eraKey: eraKey(season ?? { held: false, complete: true, rounds: 0 }),
      }
    })

  const buckets = new Map()
  for (const key of ERA_ORDER) {
    buckets.set(key, { key, label: ERA_LABEL[key], rounds: ERA_ROUNDS[key], seasons: [], clubSeasons: 0, over: 0, overPer162: 0, ...emptyTally() })
  }

  for (const [seasonKey, season] of Object.entries(seasons)) {
    const bucket = buckets.get(eraKey(season))
    bucket.seasons.push(Number(seasonKey))
    bucket.clubSeasons += season.clubs ?? 0
  }
  // Both counts come off the full row set, not off `rows`, because `rows` is
  // already cut on the raw bar and the prorated count needs the clubs that
  // cleared only the other one.
  for (const row of all) {
    const season = seasons[row.season]
    if (!season) continue
    const bucket = buckets.get(eraKey(season))
    if (row.diff >= threshold) bucket.over += 1
    if (per162(row) >= threshold) bucket.overPer162 += 1
  }
  for (const row of rows) buckets.get(row.eraKey)[row.outcome] += 1

  const eras = ERA_ORDER.map((key) => buckets.get(key))
    .filter((era) => era.seasons.length)
    .map((era) => ({
      ...era,
      span: seasonSpan(era.seasons),
      // The denominator every rate on the row is taken over: club seasons whose
      // postseason has been played and settled. An era's `over` can exceed it
      // only in the season being played, which is why that row prints no rates.
      decided: COUNTED.reduce((n, key) => n + era[key], 0),
    }))

  const totals = rows.reduce((t, row) => ({ ...t, [row.outcome]: t[row.outcome] + 1 }), emptyTally())
  totals.n = rows.length
  totals.decided = COUNTED.reduce((n, key) => n + totals[key], 0)

  return {
    threshold,
    rows,
    eras,
    totals,
    // The clubs that were this good and never played a postseason game. All of
    // them are pre-1969 — one pennant per league, no wild card, second place
    // goes home — which is the page's sharpest single fact and its own section.
    missed: rows.filter((r) => r.outcome === 'missed'),
  }
}

// A rate as a whole percent, or null when there is nothing to take it over.
// Every rate the page prints goes through here so an era with no settled club
// seasons prints a dash rather than a confident 0%.
export function rate(part, whole) {
  if (!whole) return null
  return Math.round((part / whole) * 100)
}
