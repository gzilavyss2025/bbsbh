// Matchup callouts — a hitter and the arm he is facing, read on ONE axis, with
// a note only when the two genuinely collide.
//
// Two families:
//   SKILL (chase / whiff / hard contact) — one direction is better, so a
//     collision is strength against strength, or a strength against a hole.
//   STYLE (pull / ground ball) — neither direction is better; these are
//     tendencies, and the note fires ONLY when the two point opposite ways.
//
// SPOILER FOOTING: pure season aggregates off a nightly static file
// (./savant.js). Nothing here reads liveData, tonight's line, or the score, so
// these notes need no reveal gate of their own — they clear even Between
// Innings' stricter bar. What a CALLER must still gate is which half it is
// staging, exactly as it already does for the lineup and defense cards.
//
// THE VOICE RULES BELOW ARE NOT PREFERENCES. They came out of two blind copy
// reviews (docs/callouts.md, "Matchup callouts"), and three of them exist
// because the draft copy was WRONG, not merely plain:
//   - `chase` means "swing at a pitch OUT of the zone" and nothing else. It is
//     an axis in this very file; using it as a synonym for `swing` makes one
//     word mean two things in one product.
//   - a pitcher is never the subject of `pulled` — "gets pulled" means removed
//     from the game.
//   - "hits 29% on the ground" reads as a batting average. It is
//     "puts 29% of his batted balls on the ground".

import { SCORE_BASE, clampScore, magnitudeOf } from '../callout-notes/shared.js'
import { matchupRatesFor, zScore } from './savant.js'
import { pct, quantity, SHAPES, fitShort, emphasisFor } from './voice.js'

export { SHORT_MAX } from './voice.js'

// Both sides must clear this many SDs from their own league mean. Below it the
// two numbers are just numbers and the note is noise.
const T = 1.15
// A collision this extreme on the WEAKER of its two sides earns the full
// magnitude bonus.
const FULL_MAGNITUDE = 2.0
// A prose gloss has to clear a higher bar than the emphasis word, so it stays a
// minority of notes rather than a fixture of every one.
const GLOSS_Z = 1.75

// ---------------------------------------------------------------------------
// The axes. `bSign`/`pSign` name which DIRECTION is that side's strength, so a
// collision can be read as strength-vs-strength rather than by arithmetic.
// A style axis has no sign: neither direction is better.

// Every clause function takes the player's NAME and returns a complete clause.
// It is not a verb phrase the assembler prefixes a name onto: the pull axis
// reads "hitters pull 33% against Newcomb", where the pitcher is not the
// subject at all, and prefixing his name produced "Newcomb hitters pull 33%".
// Owning the whole clause is what makes that expressible. `bare` is the
// subjectless form the named-turn shape needs after "he".
const SKILL_AXES = [
  {
    metric: 'chase', kind: 'matchupSkill', bSign: -1, pSign: +1,
    bat: (n, v, e) => `${n} chases ${e}${pct(v)} of the pitches he sees out of the zone`,
    pit: (n, v, e) => `${n} draws a chase on ${e}${pct(v)} of his pitches out of the zone`,
    batShort: (n, v, e) => `${n} chases ${e}${pct(v)} out of the zone`,
    pitShort: (n, v, e) => `${n} draws a chase ${e}${pct(v)} of the time`,
    bare: (v, e) => `chases ${e}${pct(v)} out of the zone`,
    // The one interpretive clause this axis is allowed. It characterises a
    // player; it never forecasts the at-bat.
    batGloss: (hi) => (hi ? null : 'he makes a pitcher come to him'),
  },
  {
    metric: 'whiff', kind: 'matchupSkill', bSign: -1, pSign: +1,
    bat: (n, v, e) => `${n} misses on ${e}${pct(v)} of his swings`,
    pit: (n, v, e) => `${n} misses ${e}${pct(v)} of the swings he draws`,
    batShort: (n, v, e) => `${n} misses on ${e}${pct(v)} of his swings`,
    pitShort: (n, v, e) => `${n} misses ${e}${pct(v)} of the swings he draws`,
    bare: (v, e) => `misses on ${e}${pct(v)} of his swings`,
    batGloss: (hi) => (hi ? null : 'he is hard to beat with a swing'),
  },
  {
    metric: 'hardHit', kind: 'matchupSkill', bSign: +1, pSign: -1,
    bat: (n, v, e) => `${n} hits ${e}${pct(v)} of his batted balls hard`,
    pit: (n, v, e) => `${n} gives up hard contact on ${e}${pct(v)}`,
    batShort: (n, v, e) => `${n} hits ${e}${pct(v)} of his batted balls hard`,
    pitShort: (n, v, e) => `${n} allows hard contact on ${e}${pct(v)}`,
    bare: (v, e) => `hits ${e}${pct(v)} of his batted balls hard`,
    batGloss: (hi) => (hi ? 'that is where his power lives' : null),
  },
]

const STYLE_AXES = [
  {
    metric: 'pull', kind: 'matchupStyle',
    // NEVER `gets pulled` with a pitcher as the subject — that means removed
    // from the game. The pull side simply is not the pitcher's to own, so the
    // clause takes `hitters` as its subject and names him at the end.
    bat: (n, v) => `${n} pulls ${quantity(v, 'his batted balls')}`,
    pit: (n, v) => `hitters pull ${pct(v)} of what they put in play against ${n}`,
    batShort: (n, v) => `${n} pulls ${quantity(v, 'his batted balls')}`,
    pitShort: (n, v) => `hitters pull ${pct(v)} against ${n}`,
    bare: (v) => `pulls ${quantity(v, 'his batted balls')}`,
  },
  {
    metric: 'gb', kind: 'matchupStyle',
    // NEVER `hits N% on the ground` — that reads as a batting average.
    bat: (n, v) => `${n} puts ${quantity(v, 'his batted balls')} on the ground`,
    pit: (n, v) => `${n} gets a ground ball on ${pct(v)}`,
    batShort: (n, v) => `${n} puts ${pct(v)} of his batted balls on the ground`,
    pitShort: (n, v) => `${n} gets a grounder ${pct(v)} of the time`,
    bare: (v) => `puts ${pct(v)} of his batted balls on the ground`,
  },
]

// ---------------------------------------------------------------------------
// Shape rotation, the length-aware short-form assembler, and the "just"
// emphasis rule are shared mechanics — see ./voice.js, imported above.

function readAxis(data, axis, bRates, pRates) {
  const bv = bRates?.[axis.metric]
  const pv = pRates?.[axis.metric]
  if (!Number.isFinite(bv) || !Number.isFinite(pv)) return null
  const zb = zScore(data, axis.metric, 'batting', bv)
  const zp = zScore(data, axis.metric, 'pitching', pv)
  if (zb == null || zp == null) return null
  if (Math.abs(zb) < T || Math.abs(zp) < T) return null
  return { bv, pv, zb, zp, mag: Math.min(Math.abs(zb), Math.abs(zp)) }
}

function skillNote(data, axis, read, batter, pitcher, index) {
  const { bv, pv, zb, zp, mag } = read
  const bStrong = Math.sign(zb) === axis.bSign
  const pStrong = Math.sign(zp) === axis.pSign
  // Weakness against weakness says nothing. Drop it rather than print it.
  if (!bStrong && !pStrong) return null

  const [be, pe] = emphasisFor(zb, zp)
  const lg = data?.league?.bat?.[axis.metric]
  const full = (p) => (p.first ? `${p.first} ${p.last}` : p.last)

  // Polarity lives in the TURN word, so the reader is never left doing
  // subtraction to learn which way the note points.
  const turn = bStrong && pStrong ? 'is the exception'
    : bStrong ? 'is exactly the wrong hitter for it'
      : 'is who he wants'

  const text = fitShort(index % SHAPES, {
    bName: batter.last,
    bClause: axis.batShort(batter.last, bv, be),
    pClause: axis.pitShort(pitcher.last, pv, pe),
    bPlain: axis.batShort(batter.last, bv, ''),
    pPlain: axis.pitShort(pitcher.last, pv, ''),
    bareClause: axis.bare(bv, be),
    lgText: lg ? `league average is ${pct(lg.m)}` : null,
    turn,
  })
  if (!text) return null

  // The one interpretive clause a note may carry, and it has to EARN the slot:
  // a gloss that fires on every instance of its axis is filler by the reviewers'
  // own paste test ("could this be pasted onto any other note in the family?").
  // Gating it on the hitter being both extreme and the more extreme SIDE means
  // it shows up on a minority of notes, which is the point of saying it at all.
  const glossEarned = Math.abs(zb) >= GLOSS_Z && Math.abs(zb) > Math.abs(zp)
  const gloss = glossEarned ? axis.batGloss?.(zb > 0) : null
  const prose =
    `${axis.bat(full(batter), bv, be)} this season` +
    `${lg ? ` — league average is ${pct(lg.m)}` : ''}` +
    `${gloss ? `, and ${gloss}` : ''}. ` +
    `${axis.pit(full(pitcher), pv, pe)}.`

  return {
    kind: axis.kind,
    dedupeKey: `matchup-${axis.metric}-${batter.id}-${pitcher.id}`,
    text,
    prose,
    score: clampScore(SCORE_BASE[axis.kind] + magnitudeOf(mag, FULL_MAGNITUDE)),
  }
}

function styleNote(data, axis, read, batter, pitcher, index) {
  const { bv, pv, zb, zp, mag } = read
  // A style axis is only a story when the two point OPPOSITE ways. Both pulling
  // hard is agreement, not a collision.
  if (Math.sign(zb) === Math.sign(zp)) return null
  const lg = data?.league?.bat?.[axis.metric]
  const full = (p) => (p.first ? `${p.first} ${p.last}` : p.last)

  const text = fitShort(index % SHAPES, {
    bName: batter.last,
    bClause: axis.batShort(batter.last, bv),
    pClause: axis.pitShort(pitcher.last, pv),
    bPlain: axis.batShort(batter.last, bv),
    pPlain: axis.pitShort(pitcher.last, pv),
    bareClause: axis.bare(bv),
    lgText: lg ? `league average is ${pct(lg.m)}` : null,
    turn: 'goes the other way',
  })
  if (!text) return null

  const prose =
    `${axis.bat(full(batter), bv)} this season` +
    `${lg ? `, against a league average of ${pct(lg.m)}` : ''}. ` +
    `${axis.pit(full(pitcher), pv)}.`

  return {
    kind: axis.kind,
    dedupeKey: `matchup-${axis.metric}-${batter.id}-${pitcher.id}`,
    text,
    prose,
    score: clampScore(SCORE_BASE[axis.kind] + magnitudeOf(mag, FULL_MAGNITUDE)),
  }
}

// The public builder. Returns at most ONE note per family (the strongest axis
// in each), so a single matchup can contribute a skill note and a style note
// but never three of one. `index` rotates the sentence shape — pass the batting
// slot or the half index; anything stable and incrementing works.
//
// Pure: it is HANDED the data and the two players, and reads nothing else. That
// is what keeps it callable from any surface without a gate of its own.
export function buildMatchupNotes({ data, batter, pitcher, index = 0 }) {
  if (!data || !batter?.id || !pitcher?.id) return []
  const bRates = matchupRatesFor(data, batter.id, 'batting')
  const pRates = matchupRatesFor(data, pitcher.id, 'pitching')
  if (!bRates || !pRates) return []

  const out = []
  for (const [axes, make] of [[SKILL_AXES, skillNote], [STYLE_AXES, styleNote]]) {
    let best = null
    for (const axis of axes) {
      const read = readAxis(data, axis, bRates, pRates)
      if (!read) continue
      if (!best || read.mag > best.read.mag) best = { axis, read }
    }
    if (!best) continue
    const note = make(data, best.axis, best.read, batter, pitcher, index)
    if (note) out.push(note)
  }
  return out
}
