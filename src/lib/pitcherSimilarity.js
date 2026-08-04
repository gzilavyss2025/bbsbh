// "Pitches like" — nearest neighbours in ARSENAL space: which other pitchers
// throw the same mix of pitches, at the same speeds. Pure and self-contained
// (no fetch, no DOM), driven entirely by the season pitch-type mix that
// public/data/pitch-arsenal.json already carries — see src/api/pitchArsenal.js
// for the reader and scripts/gen-pitch-arsenal.mjs for the sweep behind it.
//
// WHY RUNTIME, NOT A PRECOMPUTE. The pool is ~500 MLB arms with ~4 pitch types
// each. One player page needs one pass over that — microseconds against a file
// the page has already loaded for its own pitch-mix card. A precomputed
// neighbour table would be a new nightly generator and a new static file to buy
// nothing, so this deliberately stays in the browser. See
// .scratch/player-profile-card/scope.md §4.
//
// WHAT "SIMILAR" MEANS HERE is a deliberate choice among several defensible
// ones: this compares the arsenal a pitcher THROWS, not the results he gets.
// Two arms with the same repertoire and different outcomes are neighbours here,
// which is the literal reading of "pitches like" and the thing a scorekeeper
// can actually see from the stands. An outcome-similarity variant ("profiles
// like") is scoped in the same doc and is deliberately NOT what this is.

// Pitch codes that are the SAME PITCH under different labels, grouped so a
// relabeling doesn't read as a total mismatch. This is NOT api/pitchArsenal.js's
// `pitchFamily`, and the two must not be merged: that one groups by what a pitch
// is FOR (four-seam and sinker are both 'fastball') to pick a bar color, which is
// far too coarse here — a 97 mph four-seam and a 94 mph sinker are the two most
// different fastballs in the game. These groups are narrower, and each one is a
// pair of codes that genuinely describe one pitch:
//   - SI/FT: "sinker" and "two-seam fastball" are the same pitch, renamed.
//   - SL/ST/SV: the slider family — a sweeper is a slider with more horizontal
//     break, and classifiers move a given pitcher between the two year to year.
//   - CU/KC/CS: the curveball family, same story.
//   - CH/FS/FO/SC: the changeup/split family — all "slower, with fade".
// Anything unlisted (KN, EP, UN) is its own group, which is correct: a
// knuckleball is like nothing else.
const PITCH_GROUP = {
  FF: 'four-seam', FA: 'four-seam',
  SI: 'sinker', FT: 'sinker',
  FC: 'cutter',
  SL: 'slider', ST: 'slider', SV: 'slider',
  CU: 'curve', KC: 'curve', CS: 'curve',
  CH: 'change', FS: 'change', FO: 'change', SC: 'change',
}

export function pitchGroup(code) {
  return PITCH_GROUP[code] ?? code
}

// A pitcher needs enough pitches on file for his mix to mean anything.
//
// Usage share is the dominant noise term in the distance below — velocity over
// even a thin slice of one pitch type is stable to a few tenths, but a share is
// a multinomial proportion and wobbles. That's what sets this number: at 200
// pitches a 20%-usage pitch carries a standard error of 2.8 percentage points,
// comfortably finer than the ~10pp usage gaps that separate a 90-match from a
// 75-match. At 100 it's 4.0pp, which starts to be the same size as the signal.
//
// It buys that precision cheaply now: 536 of the 776 MLB arms in a full season
// clear 200. It could NOT have been set here against a partial season — when
// this card was first built the file held three weeks of games and only 151
// arms cleared 200, so the floor sat at 100 out of necessity. Anyone re-tuning
// it should re-check the pool size first.
//
// Consequence worth knowing: early in a season nobody clears this, so the card
// is sparse through April and fills in as the year goes. That's honest rather
// than broken — nobody's pitch mix is established in April either.
//
// Deliberately far above pitchArsenalFor's MIN_ARSENAL_PITCHES (15): that floor
// only has to make a mix bar honest to LOOK at, this one has to make it stable
// enough to RANK against 500 others.
export const MIN_SIMILARITY_PITCHES = 200

// How many mph apart two versions of the same pitch have to be before they
// count as maximally different. Eight is about the full major-league spread of
// a given pitch type: a 92 mph four-seam and a 100 mph four-seam are not
// meaningfully "the same pitch thrown a bit harder."
const VELO_SPREAD_MPH = 8

// Shape vs. speed. The arsenal's SHAPE is the primary claim — "pitches like"
// is first a statement about what he throws and how often — with velocity as
// the modulation on top. A 60/40 split keeps a same-mix/different-speed pair
// (a 97 mph sinkerballer vs. an 89 mph one) clearly apart without letting
// velocity alone pair two pitchers who throw nothing in common.
const SHAPE_WEIGHT = 0.6
const VELO_WEIGHT = 0.4

// Vectorise one pitcher's pitch-type rows (the {code, pitches, avgVelo} shape
// pitch-arsenal.json stores) into shares that sum to 1, keyed both by exact
// code and by the relabeling group above. Null when he's under the floor —
// callers treat that as "not comparable", not as an empty arsenal.
export function arsenalVector(types) {
  const rows = (types ?? []).filter((t) => t?.code && t.pitches > 0)
  const total = rows.reduce((sum, t) => sum + t.pitches, 0)
  if (total < MIN_SIMILARITY_PITCHES) return null

  const byCode = new Map()
  const byGroup = new Map()
  for (const t of rows) {
    const share = t.pitches / total
    byCode.set(t.code, (byCode.get(t.code) ?? 0) + share)
    const g = pitchGroup(t.code)
    const prev = byGroup.get(g)
    // Velocity is pooled at the GROUP level and weighted by pitch count, so a
    // pitcher whose slider and sweeper are classified apart still compares as
    // one breaking ball at its true average speed rather than as two thin ones.
    // A row with no tracked velocity contributes its share but no speed.
    const velo = Number.isFinite(t.avgVelo) ? t.avgVelo : null
    byGroup.set(g, {
      share: (prev?.share ?? 0) + share,
      veloSum: (prev?.veloSum ?? 0) + (velo == null ? 0 : velo * t.pitches),
      veloN: (prev?.veloN ?? 0) + (velo == null ? 0 : t.pitches),
    })
  }
  const groups = new Map()
  for (const [g, v] of byGroup) {
    groups.set(g, { share: v.share, velo: v.veloN > 0 ? v.veloSum / v.veloN : null })
  }
  return { total, byCode, groups }
}

// Total-variation distance between two share maps: half the sum of absolute
// differences, which lands in 0..1 for any pair of distributions summing to 1.
// 0 = identical mixes, 1 = no pitch in common at all.
//
// The keys are SORTED before summing, which looks like fussiness and isn't: a
// Set built from [...a, ...b] iterates in a different order than one built
// from [...b, ...a], and floating-point addition isn't associative, so without
// this `distance(a, b)` and `distance(b, a)` disagree in the last bit. A
// distance that isn't symmetric would make the neighbour list depend on which
// side of the comparison a pitcher happened to land on.
function shareDistance(a, b) {
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort()
  let sum = 0
  for (const key of keys) {
    sum += Math.abs((a.get(key) ?? 0) - (b.get(key) ?? 0))
  }
  return sum / 2
}

// The shape half of the distance: the mean of an exact-code comparison and a
// relabeling-group one. Averaging the two is what stops a sweeper-vs-slider
// pair from reading as a total mismatch (the group comparison forgives it)
// while still charging something for the difference (the code comparison
// doesn't) — a pitcher genuinely throwing a sweeper and one genuinely throwing
// a gyro slider are similar, not identical.
function shapeDistance(a, b) {
  const codeD = shareDistance(a.byCode, b.byCode)
  const groupShares = (v) => new Map([...v.groups].map(([g, x]) => [g, x.share]))
  const groupD = shareDistance(groupShares(a), groupShares(b))
  return (codeD + groupD) / 2
}

// The velocity half: for every pitch group BOTH throw, how far apart they
// throw it, weighted by how much the two actually lean on that pitch
// (min-share overlap — the speed of a pitch one of them throws 2% of the time
// shouldn't decide the match) and capped at VELO_SPREAD_MPH.
//
// Returns 1 (maximally different) when there is no shared, velocity-tracked
// pitch at all. That's the honest reading rather than 0: two pitchers with no
// pitch in common are not "identical on velocity", and scoring them 0 would
// let a total shape mismatch collect a perfect half-score.
function veloDistance(a, b) {
  let weighted = 0
  let weight = 0
  for (const [g, av] of a.groups) {
    const bv = b.groups.get(g)
    if (!bv || av.velo == null || bv.velo == null) continue
    const w = Math.min(av.share, bv.share)
    if (w <= 0) continue
    weighted += w * Math.min(Math.abs(av.velo - bv.velo), VELO_SPREAD_MPH) / VELO_SPREAD_MPH
    weight += w
  }
  return weight > 0 ? weighted / weight : 1
}

// 0 (same arsenal) .. 1 (nothing in common). Both inputs must be arsenalVector
// output; a null vector has no distance and callers skip it.
export function arsenalDistance(a, b) {
  if (!a || !b) return null
  return SHAPE_WEIGHT * shapeDistance(a, b) + VELO_WEIGHT * veloDistance(a, b)
}

// Distance read as a 0-100 match score, purely for display. Deliberately NOT a
// percentile or a probability — it's the complement of the distance above, and
// the card labels it as a match, never as "x% likely to be the same pitcher".
export function matchScore(distance) {
  return Math.round((1 - distance) * 100)
}

// The card itself: the `limit` closest arms to `personId` in the pool.
//
// `pool` is a list of {personId, types, throws, name, teamId} — the caller
// (src/api/pitchArsenal.js) is what knows how to flatten pitch-arsenal.json's
// per-level shape into that, so this stays a pure ranking over whatever pool
// it's handed and can be tested with three hand-written pitchers.
//
// HANDEDNESS IS A HARD FILTER when it's known for both sides. A lefty and a
// righty with the same repertoire are not a useful answer to "who pitches like
// this guy" — the ball moves the other way and the platoon math inverts, and a
// reader who knows the game reads a mixed-hand list as a bug. It stays a filter
// rather than a distance TERM deliberately: as a term, a big enough arsenal
// match would eventually outvote it and a lefty would surface anyway.
// `throws` is absent for a pitcher the source file has no hand for, and an
// unknown hand is skipped rather than guessed.
// The worst match still worth calling a comparison. Past a half-unit of
// distance the two arsenals disagree more than they agree, and printing that
// pairing under the words "pitches like" asserts something the data doesn't
// support. A pitcher with a genuinely unusual repertoire is meant to come back
// with fewer than `limit` neighbours — or none — rather than with filler.
export const MIN_MATCH = 50

export function similarPitchers(pool, personId, { limit = 3 } = {}) {
  const subject = pool.find((p) => String(p.personId) === String(personId))
  if (!subject) return []
  const subjectVec = arsenalVector(subject.types)
  if (!subjectVec) return []
  const hand = subject.throws || null

  const scored = []
  for (const cand of pool) {
    if (String(cand.personId) === String(personId)) continue
    if (hand && cand.throws && cand.throws !== hand) continue
    if (hand && !cand.throws) continue
    const vec = arsenalVector(cand.types)
    if (!vec) continue
    const distance = arsenalDistance(subjectVec, vec)
    scored.push({
      personId: cand.personId,
      name: cand.name ?? '',
      teamId: cand.teamId ?? null,
      throws: cand.throws || null,
      distance,
      match: matchScore(distance),
    })
  }
  // Ties broken by personId so the list is stable run to run rather than
  // reordering on whatever order the source file happened to serialise in.
  scored.sort((a, b) => a.distance - b.distance || String(a.personId).localeCompare(String(b.personId)))
  return scored.filter((p) => p.match >= MIN_MATCH).slice(0, limit)
}
