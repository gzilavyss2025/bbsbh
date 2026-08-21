// Matchup callouts, Family C — a hitter against ONE SPECIFIC PITCH, not a
// season-wide axis. Families A and B (./notes.js) compare a batter and a
// pitcher on a season aggregate; this one joins them on Savant's
// pitch-arsenal-stats board (player_id, pitch_type) — the pitcher's own pitch,
// and the batter's record against that pitch TYPE leaguewide. It also covers
// relievers, which A and B effectively do not (docs/callouts.md).
//
// WHIFF IS THE ONLY TRIGGER. A hitter has a median 36 PA against one pitch
// type — batting average there is ~12% real skill by an exact binomial model.
// Whiff is ~84%, because its denominator is pitches SEEN (median 149), not PA.
// `ba` (savant.js's `arsenalRatesFor` batter row) prints as COLOR ONLY, on a
// note whiff has already earned, past gen-savant-matchup.mjs's own PA floor —
// never as a trigger, never scored, never compared to a baseline of its own.
//
// FOUR QUADRANTS, ONE DROPPED. Both sides' whiff must clear T SDs from their
// own pitch-type baseline (readPitchType below); past that, classification is
// the raw SIGN of each side's z-score — high whiff is a STRENGTH for the
// pitcher (he gets swings-and-misses on it) and a WEAKNESS for the batter (he
// misses when he swings at it):
//   pitcher HIGH + batter HIGH -> mismatch: his best pitch, this hitter's hole.
//   pitcher HIGH + batter LOW  -> standoff: his out pitch, the one this hitter covers.
//   pitcher LOW  + batter HIGH -> weak but printable: the hitter is exposed to
//     a pitch that isn't actually a bat-misser for this arm.
//   pitcher LOW  + batter LOW  -> ambiguous. Dropped — neither side has a
//     demonstrated edge on whiff, which is the only thing this family trusts.
//
// `chase` NEVER appears here as a synonym for `swing` — see ./notes.js's
// header for why that word is reserved for the out-of-zone axis.
//
// SPOILER FOOTING, SHAPE ROTATION, THE SHORT-FORM LENGTH BUDGET: identical
// footing and mechanics to ./notes.js — see its header and ./voice.js. This
// family reuses fitShort/assemble/pct/quantity/emphasisFor rather than
// reimplementing them; only the axis (one pitch type's whiff, not a season
// rate) and the quadrant rule above are new.

import { SCORE_BASE, clampScore, magnitudeOf } from '../callout-notes/shared.js'
import { arsenalFor, arsenalLeagueFor, arsenalZScore } from './savant.js'
import { pct, quantity, SHAPES, fitShort, emphasisFor } from './voice.js'

// Both sides must clear this many SDs from their own pitch-type league mean —
// same threshold ./notes.js uses for a genuine collision.
const T = 1.15
const FULL_MAGNITUDE = 2.0
// The family's one earned interpretive clause (see the closer below) requires
// the pitcher to actually throw the pitch often enough that "he's going to see
// a lot of them" is true, not just that the whiff numbers collide.
const GLOSS_USAGE = 25
// Below this many plate appearances against the pitch type, the prose shows
// its count — scope.md's own low-PA bucket ceiling ("Print the sample when it
// is thin").
const THIN_PA = 80

// Savant's short pitch-type codes -> the word a game note says. A code this
// app has not seen yet degrades to a generic noun rather than crashing.
const PITCH_LABELS = {
  FF: 'four-seamer', SI: 'sinker', SL: 'slider', CH: 'changeup',
  ST: 'sweeper', FC: 'cutter', CU: 'curveball', FS: 'splitter', KC: 'knuckle curve',
}
const labelFor = (type) => PITCH_LABELS[type] ?? 'pitch'

const full = (p) => (p.first ? `${p.first} ${p.last}` : p.last)
const avgText = (n) => n.toFixed(3).replace(/^0\./, '.')

// The one shared pitch type between what he throws and what he's faced,
// scored the same way readAxis in ./notes.js scores a season axis: both sides
// must clear T, and the weaker side's magnitude drives the score/gloss bonus.
function readPitchType(data, type, pStats, bStats) {
  const zp = arsenalZScore(data, type, 'pitching', pStats.whiff)
  const zb = arsenalZScore(data, type, 'batting', bStats.whiff)
  if (zp == null || zb == null) return null
  if (Math.abs(zp) < T || Math.abs(zb) < T) return null
  const pHigh = zp > 0
  const bHigh = zb > 0
  if (!pHigh && !bHigh) return null // both low on whiff — ambiguous, drop
  const quadrant = pHigh && bHigh ? 'mismatch' : pHigh ? 'standoff' : 'weak'
  return { zp, zb, pHigh, bHigh, quadrant, mag: Math.min(Math.abs(zp), Math.abs(zb)) }
}

// Polarity lives in the TURN word, same rule ./notes.js's skillNote follows —
// the reader never subtracts to learn which way the note points.
const TURN_FOR = {
  mismatch: 'is no exception',
  standoff: 'is the exception',
  weak: 'is exposed either way',
}

export function buildArsenalNote({ data, batter, pitcher, index = 0 }) {
  if (!data || !batter?.id || !pitcher?.id) return []
  const pArsenal = arsenalFor(data, pitcher.id, 'pitching')
  const bArsenal = arsenalFor(data, batter.id, 'batting')
  if (!pArsenal || !bArsenal) return []

  // At most one note per matchup — the strongest shared pitch type wins, same
  // "best axis" pick buildMatchupNotes makes across SKILL_AXES/STYLE_AXES.
  let best = null
  for (const [type, pStats] of Object.entries(pArsenal)) {
    const bStats = bArsenal[type]
    if (!bStats) continue
    const read = readPitchType(data, type, pStats, bStats)
    if (!read) continue
    if (!best || read.mag > best.read.mag) best = { type, pStats, bStats, read }
  }
  if (!best) return []

  const { type, pStats, bStats, read } = best
  const { bHigh, quadrant, mag } = read
  const label = labelFor(type)
  const [be, pe] = emphasisFor(read.zb, read.zp)
  const bLg = arsenalLeagueFor(data, type, 'batting')

  const bClause = (e) => `${batter.last} misses ${e}${pct(bStats.whiff)} of ${label} swings`
  const bBare = (e) => `misses ${e}${pct(bStats.whiff)} of ${label} swings`
  const pClause = (e) =>
    `${pitcher.last} throws his ${label} ${quantity(pStats.usage, 'the time')}, missing ${e}${pct(pStats.whiff)}`

  const text = fitShort(index % SHAPES, {
    bName: batter.last,
    bClause: bClause(be),
    pClause: pClause(pe),
    bPlain: bClause(''),
    pPlain: pClause(''),
    bareClause: bBare(be),
    lgText: bLg ? `league average is ${pct(bLg.m)}` : null,
    turn: TURN_FOR[quadrant],
  })
  if (!text) return []

  // The wrong-end/well-under framing has to track which side of the mean the
  // batter's whiff sits on (pHigh/bHigh above), not always read as a warning —
  // "polarity in the verb, never arithmetic the reader must do".
  const bLgClause = bLg
    ? bHigh
      ? `, the wrong end of a league average of ${pct(bLg.m)}`
      : `, well under a league average of ${pct(bLg.m)}`
    : ''
  const thin = bStats.pa < THIN_PA
  const baClause = bStats.ba != null
    ? `, hitting ${avgText(bStats.ba)} against it this season${thin ? ` (${bStats.pa} PA)` : ''}`
    : ''
  // The family's one allowed interpretive clause, earned only in the
  // strongest quadrant and only when the pitch is thrown often enough that
  // seeing it again is actually likely — it fails the paste test everywhere
  // else in the family.
  const gloss = quadrant === 'mismatch' && pStats.usage >= GLOSS_USAGE
    ? ' He is going to see a lot of them.'
    : ''

  const prose =
    `${full(pitcher)} throws his ${label} ${quantity(pStats.usage, 'the time')} and misses ${pe}${pct(pStats.whiff)} ` +
    `of the bats that swing at it. ` +
    `${full(batter)} misses on ${be}${pct(bStats.whiff)} of the ${label}s he swings at${bLgClause}${baClause}.` +
    gloss

  return [{
    kind: 'matchupArsenal',
    dedupeKey: `matchup-arsenal-${type}-${batter.id}-${pitcher.id}`,
    text,
    prose,
    score: clampScore(SCORE_BASE.matchupArsenal + magnitudeOf(mag, FULL_MAGNITUDE)),
  }]
}
