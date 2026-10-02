// Matchup Scout, head-to-head data (#1408, phase 1 #1410): every past plate
// appearance between one hitter and one pitcher, regular season and postseason,
// from Baseball Savant's pitch-level CSV. No UI here; the page reads this later.
//
// OUTPUT SHAPE. `fetchHeadToHead(hitterId, pitcherId, cutoff)` resolves to:
//
//   null                        any Savant failure (network, HTTP, the row cap,
//                               a bad CSV). The page says "no head-to-head on file".
//   { pas, totals }             a good answer. An empty `pas` is a pair with no
//                               meetings: show an empty list, not an error.
//
//   pas      newest first. One entry per plate appearance:
//              { key        '{game_pk}-{at_bat_number}', the unique id
//                gamePk     number
//                atBat      number, the at-bat's order in its game
//                date       'YYYY-MM-DD'
//                round      Savant game_type: R regular season, F wild card,
//                           D division series, L league championship series,
//                           W world series
//                roundLabel 'Regular season' | 'Wild Card' | 'Division Series' |
//                           'League Championship Series' | 'World Series'
//                event      Savant `events` ('single', 'strikeout', 'field_out', ...)
//                description  the play's text, '' when Savant sends none
//                pitches    tracked pitches in the plate appearance (rows with a
//                           plate_x), a number; 0 for a walk by the pitch clock }
//   totals   `totalsOf(pas)`:
//              { pa, ab, h, hr, bb, k, hbp, sf, tb,       counts
//                avg, obp, slg }                          raw ratios, or null when
//                                                         the denominator is 0.
//              Print them with rate3 (person/shared.js); a null prints as a dash.
//
// SCOPE CONTROL. The page filters `pas` by `round` and calls `totalsOf` on the
// result, so the list and the totals always come from the same plate appearances.
//
// CUTOFF. `cutoff` is the first date held OUT ('YYYY-MM-DD'): today, or `?d=`.
// Savant's date bounds are inclusive, so the request sends the day before it.
// The module clamps a later cutoff to baseballToday() (US Pacific, the last zone
// to roll over), so no caller can ask Savant for today (the live-read leak,
// careerMatchups.js).
//
// THE TRAPS, all verified 2026-10-02:
//   - Savant caps a response at 25,000 rows, keeps the newest, and sends no error.
//     A pair never nears that, so a response that size is a bad query: throw.
//   - It adds pitch-clock rows (description 'automatic_ball' / 'automatic_strike')
//     with no plate_x. They are not pitches, so they never count in `pitches`
//     and the parser drops them. EXCEPT a row that ends the plate appearance
//     (a strike-three or ball-four by the clock, 2 of 6 such rows on 2026-09-20):
//     it has `events`, so it stays, or the plate appearance vanishes.
//   - Do not plot these pitches. Savant's 2026 plate_z frame differs from the feed's.
//   - statsapi `vsPlayer` is not the source: it lists each plate appearance twice
//     (a per-season entry and a `vsPlayerTotal` entry), so a sum doubles them.
//
// SPOILER CLASSIFICATION: spoiler-free. Only games before the cutoff, from a
// network-only fetch (vite.config.js). An open surface (ADR-0034): no SealBox.

import { csvObjects } from '../../lib/csv/parse.js'
import { isRealDate } from '../../lib/dates.js'
import { baseballToday, shiftDays } from '../../lib/time/standingsDates.js'
import { HIT_EVENT_TYPES, NON_PA_EVENT_TYPES } from '../playbyplay/eventTypes.js'
import { NON_AB_EVENTS } from '../scorecard/notation.js'

export const SAVANT_ROW_CAP = 25000

const ROUND_LABELS = {
  R: 'Regular season',
  F: 'Wild Card',
  D: 'Division Series',
  L: 'League Championship Series',
  W: 'World Series',
}

// An `events` value that ends no plate appearance. truncated_pa is Savant's mark
// on the last pitch of a cut-short at-bat (4 of 4,265 rows on 2026-09-20); the
// batter bats again under a new at_bat_number. NON_PA_EVENT_TYPES is the feed's
// baserunning set, kept here in case Savant ever stamps one on a pitch.
const NOT_A_PA = new Set([...NON_PA_EVENT_TYPES, 'truncated_pa'])

// Bases per hit, for SLG. Searched src/api for a bases table (boxscore.js,
// hitterForm.js, playbyplay/eventTypes.js, scorecard/notation.js): none. Hits and
// non-at-bats reuse HIT_EVENT_TYPES and NON_AB_EVENTS.
const BASES = { single: 1, double: 2, triple: 3, home_run: 4 }

export function savantUrl(hitterId, pitcherId, cutoff, today = baseballToday()) {
  const params = new URLSearchParams({
    all: 'true',
    type: 'details',
    player_type: 'batter',
    hfGT: 'R|F|D|L|W|',
    'batters_lookup[]': hitterId,
    'pitchers_lookup[]': pitcherId,
    game_date_lt: shiftDays(cutoff < today ? cutoff : today, -1),
  })
  return `https://baseballsavant.mlb.com/statcast_search/csv?${params}`
}

// CSV text -> rows. Throws at the cap, counting BEFORE the skip: the cap is on
// rows Savant sent, not rows we keep. Keeps a row that has a location or ends a
// plate appearance; a pitch-clock row that does neither is dropped.
export function parseSavantRows(text) {
  const rows = csvObjects(text)
  if (rows.length >= SAVANT_ROW_CAP) {
    throw new Error(`Savant sent ${rows.length} rows, the ${SAVANT_ROW_CAP} cap: the query is too wide`)
  }
  return rows.filter((r) => r.plate_x || r.events)
}

export function plateAppearances(rows) {
  const keyOf = (r) => `${r.game_pk}-${r.at_bat_number}`
  const pitches = new Map()
  for (const r of rows) if (r.plate_x) pitches.set(keyOf(r), (pitches.get(keyOf(r)) ?? 0) + 1)
  return rows
    .filter((r) => r.events && !NOT_A_PA.has(r.events))
    .map((r) => ({
      key: keyOf(r),
      gamePk: Number(r.game_pk),
      atBat: Number(r.at_bat_number),
      date: r.game_date,
      round: r.game_type,
      roundLabel: ROUND_LABELS[r.game_type] ?? r.game_type,
      event: r.events,
      description: r.des ?? '',
      pitches: pitches.get(keyOf(r)) ?? 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.gamePk - a.gamePk || b.atBat - a.atBat)
}

export function totalsOf(pas) {
  const t = { pa: 0, ab: 0, h: 0, hr: 0, bb: 0, k: 0, hbp: 0, sf: 0, tb: 0 }
  for (const { event: e } of pas) {
    t.pa += 1
    if (!NON_AB_EVENTS.has(e)) t.ab += 1
    if (HIT_EVENT_TYPES.has(e)) t.h += 1
    if (e === 'home_run') t.hr += 1
    if (e === 'walk' || e === 'intent_walk') t.bb += 1
    if (e === 'strikeout' || e === 'strikeout_double_play') t.k += 1
    if (e === 'hit_by_pitch') t.hbp += 1
    if (e === 'sac_fly' || e === 'sac_fly_double_play') t.sf += 1
    t.tb += BASES[e] ?? 0
  }
  const ratio = (n, d) => (d ? n / d : null)
  return {
    ...t,
    avg: ratio(t.h, t.ab),
    obp: ratio(t.h + t.bb + t.hbp, t.ab + t.bb + t.hbp + t.sf),
    slg: ratio(t.tb, t.ab),
  }
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Savant HTTP ${res.status}`)
  return res.text()
}

export async function fetchHeadToHead(hitterId, pitcherId, cutoff) {
  if (!hitterId || !pitcherId || !isRealDate(cutoff)) return null
  const url = savantUrl(hitterId, pitcherId, cutoff)
  try {
    // One retry, for the cold-connection refusal scripts/lib/savant.mjs records.
    // The parse sits outside it: a capped response would only cap again.
    const text = await fetchText(url).catch(() => fetchText(url))
    const pas = plateAppearances(parseSavantRows(text))
    return { pas, totals: totalsOf(pas) }
  } catch (err) {
    console.error('scout head-to-head:', err)
    return null
  }
}
