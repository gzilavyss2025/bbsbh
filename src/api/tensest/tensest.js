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

// Each tense play's clip id (`pk:i` -> playId), from its own file so the board's load
// never pays for it: the first ▶ tap reads it, once (staticJson memoizes the request).
export const loadTensestClips = staticJson('/data/tensest-clips.json', {
  shape: (d) => d.clips ?? {},
  fallback: {},
})

// "9th", "10th", "11th", "21st": an inning as a game story writes it.
export function ordinal(n) {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

// What the batter did, as the generator wrote it, against the words around it. A hit
// came OFF the pitcher; anything else, a walk included, came AGAINST him ("walked off"
// is a game-ending hit, not ball four). A walk and a hit batter still count as the
// batter's success (SUCCEEDED), which is a separate question from the preposition.
const BATTER_VERB = /^(singled|doubled|tripled|hit |grounded|flew|lined|popped|struck|walked|was |reached|bunted)/
const OFF = /^(singled|doubled|tripled|hit a (solo|two-run|three-run) homer|hit a grand slam)/
const SUCCEEDED = /^(walked|was intentionally walked|was walked|was hit|reached)/

// One row as one sentence (a baseball writer's review, 2026-11-17): the batter, what he
// did, off whom, any runs, and the inning. Parts, so the page can link the two names:
// { lead, verb, prep, scoring, when }. A play the batter did not make (a wild pitch, a
// pickoff) leads with the play. `runners` is [[id, full name], …] when the file names
// who scored (the page links each); null on an older file, which keeps `scoring` text.
export function momentParts(row) {
  const what = String(row?.what ?? '').trim()
  const cut = what.search(/,\s*scoring /)
  let verb = (cut === -1 ? what : what.slice(0, cut)).replace(/,\s*$/, '')
  // A clause after the verb ("…, forcing in a run") follows the pitcher, not the verb.
  const comma = verb.indexOf(', ')
  const after = comma === -1 ? '' : verb.slice(comma)
  if (comma !== -1) verb = verb.slice(0, comma)
  verb = verb.replace(/^was walked on purpose$/, 'was intentionally walked')
  const scoring = cut === -1 ? '' : what.slice(cut).replace(/^,\s*/, ', ')
  const runners = scoring && Array.isArray(row?.sc) && row.sc.length ? row.sc : null
  const when = `in the ${row?.top ? 'top' : 'bottom'} of the ${ordinal(row?.inn ?? 9)}`
  if (!BATTER_VERB.test(verb)) {
    return { lead: 'play', verb: verb.charAt(0).toUpperCase() + verb.slice(1), prep: 'with', after, scoring, runners, when } // caps-js-exempt: sentence case
  }
  // The pitcher's preposition as a writer says it: a hit OFF him, an intentional walk BY
  // him, a hit batter FROM him ("was hit by a pitch from"), anything else AGAINST him.
  const prep = OFF.test(verb) ? 'off' : /^was intentionally walked$/.test(verb) ? 'by' : /^was hit by a pitch$/.test(verb) ? 'from' : 'against'
  return { lead: 'batter', verb, prep, after, scoring, runners, when }
}

// "NLDS Game 2": the round written out for the citation line under a moment.
export const postseasonCitation = (row) => postseasonLabel(row).replace(/ G(\d+)$/, ' Game $1')

// Whether the picked club's side won the at-bat: 'up' or 'down', null with no club.
// The batter wins it with a hit, a walk, a hit-by-pitch, a run that scored or a time he
// reached; anything else is the pitcher's. On the Pitching view that flips.
export function batterWon(row) {
  const m = momentParts(row)
  return m.prep === 'off' || Boolean(m.scoring) || SUCCEEDED.test(m.verb)
}
export function swingFor(row, teamId, side = 'bat') {
  if (teamId == null) return null
  return batterWon(row) === (side === 'bat') ? 'up' : 'down'
}

// The club's record in the at-bats on its board, by the same rule as the row tints:
// how many its side succeeded in, of how many. `tone` is 'up' past half, 'down' under.
export function boardRecord(rows, side = 'bat') {
  const list = rows ?? []
  const of = list.length
  const succeeded = list.filter((r) => batterWon(r) === (side === 'bat')).length
  const tone = succeeded * 2 > of ? 'up' : succeeded * 2 < of ? 'down' : null
  return { succeeded, of, tone }
}

// The MLB rate for one side across every tense at-bat in the file (the record's yardstick):
// how often the batter succeeded, or the pitcher. A whole percent; null with no plays.
export function mlbRate(plays, side = 'bat') {
  const list = plays ?? []
  if (!list.length) return null
  const bat = list.filter(batterWon).length / list.length
  return Math.round((side === 'bat' ? bat : 1 - bat) * 100)
}

// The record against that yardstick, in words a reader can say aloud (copy review,
// 2026-11-17). Within 5 points is "near": 25 at-bats swing about that much by chance, so
// it takes no colour. 5-10 is above/below, past 10 "well". `tone` colours the line.
export function versusMlb(pct, mlb) {
  if (pct == null || mlb == null) return null
  const gap = pct - mlb
  const size = Math.abs(gap)
  if (size < 5) return { text: `Near the MLB average of ${mlb}%`, tone: null }
  const dir = gap > 0 ? 'above' : 'below'
  const word = size > 10 ? `Well ${dir}` : dir.charAt(0).toUpperCase() + dir.slice(1) // caps-js-exempt: sentence case
  return { text: `${word} the MLB average of ${mlb}%`, tone: gap > 0 ? 'up' : 'down' }
}
